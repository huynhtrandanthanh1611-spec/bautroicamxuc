import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { io } from "socket.io-client";
import { createSupabaseHarness } from "./helpers/supabase-harness.mjs";
import { openSupabaseStore } from "../server/supabase-store.js";
import { createApplication } from "../server/app.js";

test("Supabase: chặn anon/authenticated ở cả RPC và bảng; chạy lại SQL giữ dữ liệu", async () => {
  const h = await createSupabaseHarness();
  try {
    const store = openSupabaseStore({ client: h.client });
    await store.initialize("test");
    const room = await store.create("Phòng kiểm tra quyền");
    for (const role of ["anon", "authenticated"]) {
      await h.db.exec("RESET ROLE; SET ROLE " + role);
      await assert.rejects(h.db.query("SELECT public.sky_app_rpc('list', '{}')"), /permission denied/);
      await assert.rejects(h.db.query("SELECT * FROM sky_app.rooms"), /permission denied/);
      await assert.rejects(h.db.query("SELECT * FROM sky_app.deleted_media"), /permission denied/);
      await assert.rejects(h.db.query("UPDATE sky_app.rooms SET name='Bị sửa'"), /permission denied/);
    }
    await h.db.exec("RESET ROLE");
    await h.db.exec(await readFile(new URL("../supabase/001_sky.sql", import.meta.url), "utf8"));
    await h.db.exec("SET ROLE service_role");
    assert.equal((await store.get(room.id)).name, room.name);
    const results = await Promise.allSettled([
      store.save(room.id, { name: "A", buttons: room.buttons, version: 1 }),
      store.save(room.id, { name: "B", buttons: room.buttons, version: 1 }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
    await store.close();
  } finally { await h.close(); }
});

test("Supabase: mất phản hồi sau commit vẫn chỉ đếm/phát một lượt khi gửi lại", async () => {
  const h = await createSupabaseHarness();
  const app = await createApplication({
    password: "Test-supabase-only-password",
    store: openSupabaseStore({ client: h.client }),
  });
  const sockets = [];
  try {
    const room = await app.store.create("Lớp mạng chậm");
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + app.server.address().port;
    async function connect(role) {
      const s = io(base, { transports: ["websocket"], auth: { roomId: room.id, role }, reconnection: false });
      sockets.push(s);
      await new Promise((resolve, reject) => { s.once("ready", resolve); s.once("connect_error", reject); });
      return s;
    }
    const projector = await connect("projector");
    const student = await connect("student");
    const received = [];
    projector.on("reaction", (event) => received.push(event));
    const payload = { eventId: randomUUID(), buttonIndex: 1, epoch: 0 };
    const send = () => new Promise((resolve, reject) =>
      student.timeout(5000).emit("react", payload, (error, result) => error ? reject(error) : resolve(result)));
    h.control.failAfterReactCommit = true;
    assert.equal((await send()).retry, true);
    assert.deepEqual(app.store.counts(await app.store.get(room.id)).values, [0, 1, 0]);
    const event = new Promise((resolve) => projector.once("reaction", resolve));
    assert.equal((await send()).duplicate, true);
    assert.equal((await event).eventId, payload.eventId);
    assert.equal((await send()).duplicate, true);
    assert.equal(received.length, 1);
    assert.deepEqual(app.store.counts(await app.store.get(room.id)).values, [0, 1, 0]);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await app.close();
    await h.close();
  }
});

test("Supabase: báo lỗi kho ảnh, cache lượt đọc, dọn ảnh dở dang và giữ ảnh đang dùng", async () => {
  const h = await createSupabaseHarness();
  const store = openSupabaseStore({ client: h.client });
  try {
    await store.initialize("test");
    assert.equal(h.buckets.get("sky-images").public, false);
    const room = await store.create("Ảnh lâu dài");
    const bytes = Buffer.from("bytes-after-server-validation");
    const image = await store.saveMedia(room.id, bytes, { title: "Test credit" });
    await store.save(room.id, { ...room, buttons: room.buttons.map((b, i) => i === 0 ? { ...b, imageId: image.imageId, mode: "both" } : b) });
    h.control.failDownload = true;
    await assert.rejects(store.getMedia(image.imageId), /kho ảnh/);
    h.control.failDownload = false;
    const before = h.control.downloads;
    const pair = await Promise.all([store.getMedia(image.imageId), store.getMedia(image.imageId)]);
    assert.deepEqual(pair[0].bytes, bytes);
    assert.equal(h.control.downloads - before, 1);
    await store.getMedia(image.imageId);
    assert.equal(h.control.downloads - before, 1);
    h.control.failUpload = true;
    await assert.rejects(store.saveMedia(room.id, bytes), /kho ảnh/);
    await h.db.exec("UPDATE sky_app.media SET created_at=0");
    await store.clean();
    assert.equal(h.files.size, 1);
    assert.equal((await h.db.query("SELECT count(*)::integer AS n FROM sky_app.media")).rows[0].n, 1);
    assert.equal((await store.get(room.id)).public_room.buttons[0].imageId, image.imageId);
    h.control.failUpload = false;
    // Gỡ ảnh rồi chờ đủ 24 giờ: dữ liệu ảnh cũ được thu hồi.
    const current = (await store.get(room.id)).public_room;
    await store.save(room.id, { ...current, buttons: room.buttons });
    await store.clean();
    assert.equal(h.files.size, 0);
    assert.equal((await h.db.query("SELECT count(*)::integer AS n FROM sky_app.media")).rows[0].n, 0);
    // Khóa hàng + kiểm tra quota trong cùng transaction.
    const full = await store.saveMedia(room.id, Buffer.alloc(4 * 1024 * 1024));
    await h.db.query("INSERT INTO sky_app.media SELECT gen_random_uuid(), room_id, gen_random_uuid()::text, size_bytes, mime, credit, ready, created_at FROM sky_app.media CROSS JOIN generate_series(1,9) WHERE id=$1", [full.imageId]);
    await assert.rejects(store.saveMedia(room.id, bytes), /40 MB/);
  } finally { await store.close(); await h.close(); }
});

test("Supabase: cấu hình thiếu/sai dừng rõ ràng, không tự lưu vào ổ tạm", async () => {
  assert.throws(() => openSupabaseStore(), /SUPABASE_URL/);
  assert.throws(() => openSupabaseStore({ url: "https://example.supabase.co", key: "sb_publishable_fake" }), /Secret key/);
  await assert.rejects(createApplication({ password: "Test-password-with-length", storageProvider: "supabase" }), /SUPABASE_URL/);
});

test("Supabase: xóa phòng vẫn hoàn tất khi Storage lỗi và dọn ảnh lại sau", async () => {
  const h = await createSupabaseHarness();
  const store = openSupabaseStore({ client: h.client });
  try {
    await store.initialize("test");
    const room = await store.create("Phòng xóa");
    const image = await store.saveMedia(room.id, Buffer.from("image-test"));
    await store.getMedia(image.imageId);
    h.control.failDelete = true;
    await store.deleteRoom(room.id);
    assert.equal(await store.get(room.id), null);
    assert.equal(await store.getMedia(image.imageId), null);
    assert.equal(h.files.size, 1);
    assert.equal((await h.db.query("SELECT count(*)::integer AS n FROM sky_app.deleted_media")).rows[0].n, 1);
    h.control.failDelete = false;
    await store.clean();
    assert.equal(h.files.size, 0);
    assert.equal((await h.db.query("SELECT count(*)::integer AS n FROM sky_app.deleted_media")).rows[0].n, 0);
  } finally { await store.close(); await h.close(); }
});
