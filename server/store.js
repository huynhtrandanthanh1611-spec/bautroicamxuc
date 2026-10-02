import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "./images.js";

export const defaults = () => [
  {
    mode: "text",
    text: "💗\nCon thích",
    background: "#ffe1eb",
    color: "#843350",
    fontSize: 30,
    imageId: null,
  },
  {
    mode: "text",
    text: "🌟\nCon hiểu rồi",
    background: "#fff0b8",
    color: "#785617",
    fontSize: 30,
    imageId: null,
  },
  {
    mode: "text",
    text: "💭\nCon tò mò",
    background: "#d7f4ea",
    color: "#236553",
    fontSize: 30,
    imageId: null,
  },
];

export function openStore(directory) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(join(directory, "sky.sqlite"));
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, buttons TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1, counts TEXT NOT NULL DEFAULT '[0,0,0]',
      count_seq INTEGER NOT NULL DEFAULT 0, epoch INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id),
      bytes BLOB NOT NULL, mime TEXT NOT NULL, credit TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS media_room ON media(room_id);
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      room_id TEXT NOT NULL REFERENCES rooms(id), event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL, PRIMARY KEY(room_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS events_age ON events(created_at);
    PRAGMA user_version=1;
  `);
  const get = (id) => db.prepare("SELECT * FROM rooms WHERE id=?").get(id);
  const counts = (row) => ({
    values: JSON.parse(row.counts),
    seq: row.count_seq,
    epoch: row.epoch,
  });
  function publicRoom(row) {
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      epoch: row.epoch,
      buttons: JSON.parse(row.buttons).map((button) => {
        const media =
          button.imageId &&
          db
            .prepare("SELECT credit FROM media WHERE id=? AND room_id=?")
            .get(button.imageId, row.id);
        return {
          ...button,
          imageUrl: media ? `/media/${button.imageId}` : null,
          credit: media?.credit ? JSON.parse(media.credit) : null,
        };
      }),
    };
  }
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  function create(name) {
    const id = randomUUID();
    const now = Date.now();
    db.prepare(
      "INSERT INTO rooms(id,name,buttons,created_at,updated_at) VALUES(?,?,?,?,?)",
    ).run(id, name, JSON.stringify(defaults()), now, now);
    return publicRoom(get(id));
  }
  function react(id, eventId, index, epoch) {
    return transaction(() => {
      const row = get(id);
      if (!row) return { error: "Không tìm thấy phòng." };
      if (
        db
          .prepare("SELECT 1 FROM events WHERE room_id=? AND event_id=?")
          .get(id, eventId)
      )
        return { duplicate: true };
      if (row.epoch !== epoch)
        return {
          error: "Bộ đếm đã được đặt lại. Con hãy bấm lại nhé.",
          code: "EPOCH_CHANGED",
        };
      const values = JSON.parse(row.counts);
      values[index] += 1;
      db.prepare("INSERT INTO events VALUES(?,?,?)").run(
        id,
        eventId,
        Date.now(),
      );
      db.prepare(
        "UPDATE rooms SET counts=?,count_seq=count_seq+1 WHERE id=?",
      ).run(JSON.stringify(values), id);
      const current = get(id);
      return {
        counts: counts(current),
        button: publicRoom(current).buttons[index],
      };
    });
  }
  function clean() {
    const now = Date.now();
    db.prepare("DELETE FROM sessions WHERE expires_at<?").run(now);
    // Lượt gửi lại chỉ tồn tại 5 phút; giữ khóa chống trùng 24 giờ.
    db.prepare("DELETE FROM events WHERE created_at<?").run(now - 86400000);
    db.prepare(
      `DELETE FROM media WHERE created_at<? AND NOT EXISTS (
      SELECT 1 FROM rooms r, json_each(r.buttons) b
      WHERE r.id=media.room_id AND json_extract(b.value, '$.imageId')=media.id
    )`,
    ).run(now - 86400000);
  }
  clean();
  return {
    db,
    provider: "sqlite",
    get,
    counts,
    publicRoom,
    transaction,
    create,
    react,
    clean,
    health: () => db.prepare("SELECT 1").get(),
    initialize: (fingerprint) => db.prepare("DELETE FROM sessions WHERE fingerprint<>?").run(fingerprint),
    getSession: (hash, fingerprint) => db.prepare(
      "SELECT hash,expires_at FROM sessions WHERE hash=? AND fingerprint=? AND expires_at>?",
    ).get(hash, fingerprint, Date.now()),
    createSession: (hash, fingerprint, expiresAt) => db.prepare(
      "INSERT INTO sessions VALUES(?,?,?)",
    ).run(hash, fingerprint, expiresAt),
    deleteSession: (hash) => db.prepare("DELETE FROM sessions WHERE hash=?").run(hash),
    list: () => db.prepare("SELECT * FROM rooms ORDER BY created_at DESC").all()
      .map((row) => ({ ...publicRoom(row), counts: counts(row) })),
    save: (id, input) => transaction(() => {
      const room = get(id);
      if (!room) throw new AppError("Không tìm thấy phòng.", 404);
      if (room.version !== input.version) throw new AppError(
        "Phòng đã được lưu từ một cửa sổ khác. Hãy tải lại trang trước khi sửa tiếp.", 409,
      );
      for (const button of input.buttons) {
        if (button.imageId && !db.prepare("SELECT 1 FROM media WHERE id=? AND room_id=?").get(button.imageId, id))
          throw new AppError("Ảnh không thuộc phòng này hoặc đã hết hạn. Vui lòng tải lại ảnh.");
      }
      db.prepare("UPDATE rooms SET name=?,buttons=?,version=version+1,updated_at=? WHERE id=?")
        .run(input.name, JSON.stringify(input.buttons), Date.now(), id);
      return publicRoom(get(id));
    }),
    reset: (id) => transaction(() => {
      if (!get(id)) throw new AppError("Không tìm thấy phòng.", 404);
      db.prepare("UPDATE rooms SET counts='[0,0,0]',count_seq=count_seq+1,epoch=epoch+1 WHERE id=?").run(id);
      return get(id);
    }),
    saveMedia: (roomId, bytes, credit = null) => transaction(() => {
      const total = db.prepare("SELECT COALESCE(sum(length(bytes)),0) AS total FROM media WHERE room_id=?").get(roomId).total;
      if (total + bytes.length > 40 * 1024 * 1024) throw new AppError(
        "Phòng đã dùng 40 MB ảnh. Ảnh cũ không dùng sẽ được dọn sau 24 giờ; bạn có thể tạo phòng mới.", 413,
      );
      const id = randomUUID();
      db.prepare("INSERT INTO media VALUES(?,?,?,?,?,?)")
        .run(id, roomId, bytes, "image/webp", credit ? JSON.stringify(credit) : null, Date.now());
      return { imageId: id, imageUrl: `/media/${id}`, credit };
    }),
    getMedia: (id) => db.prepare("SELECT bytes,mime FROM media WHERE id=?").get(id),
    close: () => db.close(),
  };
}
