import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { defaults } from "./store.js";
import { AppError, MAX_IMAGE_BYTES } from "./images.js";

export function openSupabaseStore({ url, key, bucket = "sky-images", client } = {}) {
  if (!client) {
    let endpoint;
    try { endpoint = new URL(url); } catch { /* Thông báo bên dưới. */ }
    if (!endpoint || endpoint.protocol !== "https:" || endpoint.username || endpoint.password
      || endpoint.search || endpoint.hash || endpoint.pathname !== "/")
      throw new Error("Thiếu hoặc sai SUPABASE_URL. Sao chép Project URL https://...supabase.co.");
    let serviceRole = false;
    try { serviceRole = JSON.parse(Buffer.from(key?.split(".")[1] || "", "base64url").toString()).role === "service_role"; } catch { /* Khóa mới không phải JWT. */ }
    if (!key || (!key.startsWith("sb_secret_") && !serviceRole))
      throw new Error("SUPABASE_SECRET_KEY cần Secret key (sb_secret_...) hoặc service_role; không dùng publishable/anon key.");
    client = createClient(endpoint.origin, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init = {}) => fetch(input, {
          ...init,
          signal: init.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        }),
      },
    });
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket))
    throw new Error("SUPABASE_BUCKET chỉ gồm chữ thường, số và dấu gạch ngang; ví dụ sky-images.");
  const storage = client.storage.from(bucket);
  const cached = new Map();
  const downloading = new Map();
  let cacheSize = 0;
  function evict(id) {
    const entry = cached.get(id);
    if (entry) { cacheSize -= entry.value.bytes.length; cached.delete(id); }
  }
  const storageError = () => new AppError(
    "Chưa kết nối được kho ảnh Supabase. Kiểm tra project có bị tạm dừng, khóa và bucket; sau đó thử lại.", 503,
  );
  async function rpc(action, payload = {}) {
    let reply;
    try { reply = await client.rpc("sky_app_rpc", { action, payload }); }
    catch { throw new AppError("Chưa kết nối được Supabase. Hãy kiểm tra mạng hoặc khôi phục project đang tạm dừng.", 503); }
    const { data, error } = reply;
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883")
        throw new AppError("Supabase chưa có cấu trúc dữ liệu. Chạy tệp supabase/001_sky.sql trong SQL Editor rồi thử lại.", 503);
      if (error.code === "42501" || error.code === "PGRST301")
        throw new AppError("Khóa hoặc quyền Supabase chưa đúng. Kiểm tra Secret key và chạy đủ tệp SQL.", 503);
      // Không ghi khóa hoặc toàn bộ lỗi của nhà cung cấp vào trình duyệt/log.
      throw new AppError("Supabase chưa sẵn sàng. Kiểm tra project, cấu hình và hạn mức miễn phí rồi thử lại.", 503);
    }
    if (data?.error && data.status) throw new AppError(data.error, data.status);
    return data;
  }
  async function ensureBucket() {
    let { data, error } = await client.storage.getBucket(bucket);
    if (error && (String(error.statusCode) === "404" || error.message === "Bucket not found")) {
      const created = await client.storage.createBucket(bucket, {
        public: false, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes: ["image/webp"],
      });
      if (created.error && !["409", "400"].includes(String(created.error.statusCode))) throw storageError();
      ({ data, error } = await client.storage.getBucket(bucket));
    }
    if (error || !data) throw storageError();
    if (data.public) throw new AppError("Bucket sky-images cần đặt Private trong Supabase Storage.", 503);
  }
  const counts = (row) => ({ values: row.counts, seq: Number(row.count_seq), epoch: row.epoch });
  async function readMedia(id) {
    const meta = await rpc("media_get", { id });
    if (!meta) return null;
    const { data, error } = await storage.download(meta.object_path);
    if (error || !data) throw storageError();
    const bytes = Buffer.from(await data.arrayBuffer());
    // Một lượt tải đang chạy không được đưa ảnh của phòng vừa xóa vào cache.
    if (!(await rpc("media_get", { id }))) return null;
    const value = { bytes, mime: meta.mime };
    while (cached.size && cacheSize + bytes.length > 16 * 1024 * 1024) {
      const oldest = cached.keys().next().value;
      cacheSize -= cached.get(oldest).value.bytes.length;
      cached.delete(oldest);
    }
    cached.set(id, { value, until: Date.now() + 600000 });
    cacheSize += bytes.length;
    return value;
  }
  async function cleanDeletedMedia() {
    const pending = await rpc("deleted_media_list");
    if (!pending.length) return;
    const { error } = await storage.remove(pending.map((m) => m.object_path));
    if (error) throw storageError();
    await rpc("deleted_media_done", { ids: pending.map((m) => m.id) });
  }
  return {
    provider: "supabase",
    health: () => rpc("health"),
    async initialize(fingerprint) {
      await rpc("initialize", { fingerprint });
      await ensureBucket();
    },
    getSession: (hash, fingerprint) => rpc("session_get", { hash, fingerprint }),
    createSession: (hash, fingerprint, expiresAt) => rpc("session_create", { hash, fingerprint, expiresAt }),
    deleteSession: (hash) => rpc("session_delete", { hash }),
    get: (id) => rpc("get", { id }),
    counts,
    publicRoom: (row) => row.public_room,
    list: () => rpc("list"),
    create: (name) => rpc("create", { id: randomUUID(), name, buttons: defaults() }),
    save: (id, input) => rpc("save", { ...input, id }),
    reset: (id) => rpc("reset", { id }),
    async deleteRoom(id) {
      const mediaIds = await rpc("room_delete", { id });
      mediaIds.forEach(evict);
      // Phòng đã xóa ngay; giữ hàng đợi nếu Storage tạm lỗi để dọn lại sau.
      try { await cleanDeletedMedia(); }
      catch { console.warn("Ảnh của phòng đã xóa sẽ được dọn lại ở lượt kế tiếp."); }
    },
    react: (id, eventId, index, epoch) => rpc("react", { id, eventId, index, epoch }),
    async saveMedia(roomId, bytes, credit = null) {
      const id = randomUUID();
      const path = roomId + "/" + id + ".webp";
      await rpc("media_reserve", { id: roomId, mediaId: id, path, size: bytes.length, credit });
      const { error } = await storage.upload(path, bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      // Nếu mất kết nối giữa các bước, bản giữ chỗ giúp dọn ảnh dở dang sau 24 giờ.
      if (error) throw storageError();
      try { await rpc("media_ready", { id }); }
      catch (error) {
        // Upload có thể kết thúc sau khi phòng đã bị xóa.
        try { await storage.remove([path]); } catch { /* Hàng đợi dọn sẽ thử lại. */ }
        throw error;
      }
      return { imageId: id, imageUrl: "/media/" + id, credit };
    },
    async getMedia(id) {
      const entry = cached.get(id);
      if (entry && entry.until > Date.now()) return entry.value;
      if (entry) { cached.delete(id); cacheSize -= entry.value.bytes.length; }
      if (downloading.has(id)) return downloading.get(id);
      const pending = readMedia(id).finally(() => downloading.delete(id));
      downloading.set(id, pending);
      return pending;
    },
    async clean() {
      await cleanDeletedMedia();
      const unused = await rpc("clean");
      if (!unused.length) return;
      const { error } = await storage.remove(unused.map((m) => m.object_path));
      if (error) throw storageError();
      await rpc("media_deleted", { ids: unused.map((m) => m.id) });
    },
    async close() {
      cached.clear();
      cacheSize = 0;
      await client.removeAllChannels?.();
    },
  };
}
