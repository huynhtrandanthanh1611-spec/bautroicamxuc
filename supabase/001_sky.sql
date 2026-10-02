-- Chạy toàn bộ tệp một lần trong Supabase > SQL Editor > New query > Run.
-- Dùng một project riêng cho Bầu trời cảm xúc. Không cần tắt RLS.
-- Ảnh được tạo qua Storage API; không ghi trực tiếp vào storage.objects.
BEGIN;

CREATE SCHEMA IF NOT EXISTS sky_app;
REVOKE ALL ON SCHEMA sky_app FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA sky_app TO service_role;

CREATE TABLE IF NOT EXISTS sky_app.rooms (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 70),
  buttons jsonb NOT NULL CHECK (jsonb_typeof(buttons) = 'array' AND jsonb_array_length(buttons) = 3),
  version integer NOT NULL DEFAULT 1,
  counts jsonb NOT NULL DEFAULT '[0,0,0]' CHECK (jsonb_array_length(counts) = 3),
  count_seq bigint NOT NULL DEFAULT 0,
  epoch integer NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sky_app.media (
  id uuid PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES sky_app.rooms(id),
  object_path text NOT NULL UNIQUE,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  mime text NOT NULL DEFAULT 'image/webp' CHECK (mime = 'image/webp'),
  credit jsonb,
  ready boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sky_media_room ON sky_app.media(room_id);
CREATE INDEX IF NOT EXISTS sky_media_age ON sky_app.media(created_at);
CREATE TABLE IF NOT EXISTS sky_app.sessions (
  hash text PRIMARY KEY,
  fingerprint text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sky_sessions_expiry ON sky_app.sessions(expires_at);
CREATE TABLE IF NOT EXISTS sky_app.events (
  room_id uuid NOT NULL REFERENCES sky_app.rooms(id),
  event_id uuid NOT NULL,
  button jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY(room_id, event_id)
);
CREATE INDEX IF NOT EXISTS sky_events_age ON sky_app.events(created_at);

ALTER TABLE sky_app.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sky_app.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE sky_app.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sky_app.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sky_app FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sky_app TO service_role;
-- service_role của Supabase có BYPASSRLS. Không cấp policy cho trình duyệt.

CREATE OR REPLACE FUNCTION sky_app.public_room(r sky_app.rooms)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id', r.id, 'name', r.name, 'version', r.version, 'epoch', r.epoch,
    'buttons', (
      SELECT jsonb_agg(
        b.value || jsonb_build_object(
          'imageUrl', CASE WHEN m.id IS NOT NULL THEN '/media/' || m.id::text ELSE NULL END,
          'credit', m.credit
        ) ORDER BY b.ord
      )
      FROM jsonb_array_elements(r.buttons) WITH ORDINALITY AS b(value, ord)
      LEFT JOIN sky_app.media m ON m.id::text = b.value->>'imageId'
        AND m.room_id = r.id AND m.ready
    )
  );
$$;

CREATE OR REPLACE FUNCTION sky_app.room_record(r sky_app.rooms)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT to_jsonb(r) || jsonb_build_object('public_room', sky_app.public_room(r));
$$;

-- Chỉ máy chủ dùng Secret key/service_role mới được gọi hàm này.
-- Mỗi lần gọi là một transaction PostgreSQL; khóa hàng phòng ngăn mất lượt bấm.
CREATE OR REPLACE FUNCTION public.sky_app_rpc(action text, payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  r sky_app.rooms%ROWTYPE;
  m sky_app.media%ROWTYPE;
  e sky_app.events%ROWTYPE;
  now_ms bigint := floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  room_key uuid;
  idx integer;
  next_counts jsonb;
  button jsonb;
  result jsonb;
BEGIN
  IF action = 'health' THEN
    PERFORM 1 FROM sky_app.rooms LIMIT 1;
    RETURN '{"ok":true,"schemaVersion":1}'::jsonb;
  ELSIF action = 'initialize' THEN
    DELETE FROM sky_app.sessions WHERE fingerprint <> payload->>'fingerprint' OR expires_at < now_ms;
    RETURN '{"ok":true}'::jsonb;
  ELSIF action = 'session_get' THEN
    SELECT jsonb_build_object('hash', s.hash, 'expires_at', s.expires_at) INTO result
    FROM sky_app.sessions s WHERE s.hash = payload->>'hash'
      AND s.fingerprint = payload->>'fingerprint' AND s.expires_at > now_ms;
    RETURN result;
  ELSIF action = 'session_create' THEN
    INSERT INTO sky_app.sessions(hash, fingerprint, expires_at)
      VALUES(payload->>'hash', payload->>'fingerprint', (payload->>'expiresAt')::bigint);
    RETURN '{"ok":true}'::jsonb;
  ELSIF action = 'session_delete' THEN
    DELETE FROM sky_app.sessions WHERE hash = payload->>'hash';
    RETURN '{"ok":true}'::jsonb;
  ELSIF action = 'list' THEN
    SELECT coalesce(jsonb_agg(sky_app.public_room(t) || jsonb_build_object(
      'counts', jsonb_build_object('values', t.counts, 'seq', t.count_seq, 'epoch', t.epoch)
    ) ORDER BY t.created_at DESC), '[]'::jsonb) INTO result FROM sky_app.rooms t;
    RETURN result;
  ELSIF action = 'create' THEN
    INSERT INTO sky_app.rooms(id, name, buttons, created_at, updated_at)
      VALUES((payload->>'id')::uuid, payload->>'name', payload->'buttons', now_ms, now_ms)
      RETURNING * INTO r;
    RETURN sky_app.public_room(r);
  ELSIF action = 'get' THEN
    SELECT * INTO r FROM sky_app.rooms WHERE rooms.id = (payload->>'id')::uuid;
    IF NOT FOUND THEN RETURN NULL; END IF;
    RETURN sky_app.room_record(r);
  ELSIF action = 'media_get' THEN
    SELECT to_jsonb(t) INTO result FROM sky_app.media t
      WHERE t.id = (payload->>'id')::uuid AND t.ready;
    RETURN result;
  ELSIF action = 'media_ready' THEN
    UPDATE sky_app.media SET ready = true WHERE media.id = (payload->>'id')::uuid;
    RETURN '{"ok":true}'::jsonb;
  ELSIF action = 'clean' THEN
    DELETE FROM sky_app.sessions WHERE expires_at < now_ms;
    DELETE FROM sky_app.events WHERE created_at < now_ms - 86400000;
    -- Khóa từng phòng theo cùng thứ tự trước khi xét ảnh để không đua với thao tác lưu.
    FOR r IN SELECT * FROM sky_app.rooms ORDER BY rooms.id FOR UPDATE LOOP
      UPDATE sky_app.media SET ready = false
      WHERE media.room_id = r.id AND media.created_at < now_ms - 86400000
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r.buttons) b
                        WHERE b->>'imageId' = media.id::text);
    END LOOP;
    SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO result
      FROM (SELECT * FROM sky_app.media WHERE NOT ready AND created_at < now_ms - 86400000
            ORDER BY created_at LIMIT 100) t;
    RETURN result;
  ELSIF action = 'media_deleted' THEN
    DELETE FROM sky_app.media WHERE NOT ready AND media.id IN (
      SELECT value::uuid FROM jsonb_array_elements_text(payload->'ids')
    );
    RETURN '{"ok":true}'::jsonb;
  END IF;

  room_key := (payload->>'id')::uuid;
  -- Upload giữ chỗ trước khi tải ảnh; giới hạn tổng dưới quota Storage Free.
  IF action = 'media_reserve' THEN
    PERFORM pg_advisory_xact_lock(75201926);
  END IF;
  SELECT * INTO r FROM sky_app.rooms WHERE rooms.id = room_key FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"error":"Không tìm thấy phòng.","status":404}'::jsonb; END IF;

  IF action = 'save' THEN
    IF r.version <> (payload->>'version')::integer THEN
      RETURN '{"error":"Phòng đã được lưu từ một cửa sổ khác. Hãy tải lại trang trước khi sửa tiếp.","status":409}'::jsonb;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(payload->'buttons') b
      WHERE b->>'imageId' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM sky_app.media t
        WHERE t.id::text = b->>'imageId' AND t.room_id = r.id AND t.ready
      )
    ) THEN
      RETURN '{"error":"Ảnh không thuộc phòng này hoặc đã hết hạn. Vui lòng tải lại ảnh.","status":400}'::jsonb;
    END IF;
    UPDATE sky_app.rooms SET name = payload->>'name', buttons = payload->'buttons',
      version = version + 1, updated_at = now_ms WHERE rooms.id = r.id RETURNING * INTO r;
    RETURN sky_app.public_room(r);
  ELSIF action = 'reset' THEN
    UPDATE sky_app.rooms SET counts = '[0,0,0]', count_seq = count_seq + 1, epoch = epoch + 1
      WHERE rooms.id = r.id RETURNING * INTO r;
    RETURN sky_app.room_record(r);
  ELSIF action = 'react' THEN
    idx := (payload->>'index')::integer;
    IF idx IS NULL OR idx < 0 OR idx > 2 THEN
      RETURN '{"error":"Lượt bấm không hợp lệ."}'::jsonb;
    END IF;
    SELECT * INTO e FROM sky_app.events
      WHERE events.room_id = r.id AND event_id = (payload->>'eventId')::uuid;
    IF FOUND THEN
      RETURN jsonb_build_object('duplicate', true, 'button', e.button, 'timestamp', e.created_at,
        'counts', jsonb_build_object('values', r.counts, 'seq', r.count_seq, 'epoch', r.epoch));
    END IF;
    IF r.epoch <> (payload->>'epoch')::integer THEN
      RETURN '{"error":"Bộ đếm đã được đặt lại. Con hãy bấm lại nhé.","code":"EPOCH_CHANGED"}'::jsonb;
    END IF;
    next_counts := jsonb_set(r.counts, ARRAY[idx::text], to_jsonb((r.counts->>idx)::bigint + 1));
    UPDATE sky_app.rooms SET counts = next_counts, count_seq = count_seq + 1
      WHERE rooms.id = r.id RETURNING * INTO r;
    button := sky_app.public_room(r)->'buttons'->idx;
    INSERT INTO sky_app.events(room_id, event_id, button, created_at)
      VALUES(r.id, (payload->>'eventId')::uuid, button, now_ms);
    RETURN jsonb_build_object('button', button, 'timestamp', now_ms,
      'counts', jsonb_build_object('values', r.counts, 'seq', r.count_seq, 'epoch', r.epoch));
  ELSIF action = 'media_reserve' THEN
    IF (SELECT coalesce(sum(size_bytes), 0) FROM sky_app.media WHERE room_id = r.id)
        + (payload->>'size')::integer > 41943040 THEN
      RETURN '{"error":"Phòng đã dùng 40 MB ảnh. Ảnh cũ không dùng sẽ được dọn sau 24 giờ.","status":413}'::jsonb;
    END IF;
    IF (SELECT coalesce(sum(size_bytes), 0) FROM sky_app.media)
        + (payload->>'size')::integer > 838860800 THEN
      RETURN '{"error":"Đã gần đầy kho ảnh miễn phí (giới hạn ứng dụng: 800 MB). Hãy xóa ảnh không dùng và chờ dọn dẹp.","status":413}'::jsonb;
    END IF;
    INSERT INTO sky_app.media(id, room_id, object_path, size_bytes, credit, created_at)
      VALUES((payload->>'mediaId')::uuid, r.id, payload->>'path',
        (payload->>'size')::integer, payload->'credit', now_ms);
    RETURN '{"ok":true}'::jsonb;
  END IF;
  RAISE EXCEPTION 'Unknown sky action';
END;
$$;

REVOKE ALL ON FUNCTION sky_app.public_room(sky_app.rooms) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sky_app.room_record(sky_app.rooms) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sky_app_rpc(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sky_app.public_room(sky_app.rooms) TO service_role;
GRANT EXECUTE ON FUNCTION sky_app.room_record(sky_app.rooms) TO service_role;
GRANT EXECUTE ON FUNCTION public.sky_app_rpc(text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
