import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";
import sharp from "sharp";
import { createApplication } from "../server/app.js";
import { createImageService } from "../server/images.js";
import { openSupabaseStore } from "../server/supabase-store.js";
import { createSupabaseHarness } from "./helpers/supabase-harness.mjs";

const password = "Test-only-password-2026";
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "sky-test-"));
  const backend = process.env.SKY_TEST_SUPABASE === "1" ? await createSupabaseHarness() : null;
  let instance;
  const sockets = [];
  let base;
  let cookie = "";
  async function start() {
    instance = await createApplication({
      password, dataDir: directory,
      store: backend ? openSupabaseStore({ client: backend.client }) : undefined,
    });
    await new Promise((resolve) =>
      instance.server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${instance.server.address().port}`;
  }
  await start();
  async function request(
    path,
    { method = "GET", body, auth = true, headers = {} } = {},
  ) {
    const isForm = body instanceof FormData;
    const response = await fetch(base + path, {
      method,
      headers: {
        "X-Sky-Request": "1",
        ...(auth && cookie ? { cookie } : {}),
        ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const data = response.headers.get("content-type")?.includes("json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { response, data, status: response.status };
  }
  const login = await request("/api/login", {
    method: "POST",
    body: { password },
  });
  assert.equal(login.status, 200);
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  const makeRoom = async (name) =>
    (
      await request("/api/teacher/rooms", {
        method: "POST",
        body: { name: name || "Lớp thử nghiệm" },
      })
    ).data;
  async function socket(roomId, role = "student", authenticated = false) {
    const client = io(base, {
      auth: { roomId, role },
      extraHeaders: authenticated ? { cookie } : undefined,
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(client);
    const ready = await new Promise((resolve, reject) => {
      client.once("ready", resolve);
      client.once("connect_error", reject);
    });
    return { client, ready };
  }
  return {
    request,
    makeRoom,
    socket,
    get instance() {
      return instance;
    },
    get base() {
      return base;
    },
    async restart() {
      sockets.forEach((s) => s.disconnect());
      await instance.close();
      await start();
    },
    async close() {
      sockets.forEach((s) => s.disconnect());
      await instance.close();
      await backend?.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
const send = (socket, payload) =>
  new Promise((resolve, reject) =>
    socket
      .timeout(7000)
      .emit("react", payload, (err, result) =>
        err ? reject(err) : resolve(result),
      ),
  );
const png = () =>
  sharp({
    create: {
      width: 120,
      height: 80,
      channels: 4,
      background: { r: 255, g: 70, b: 140, alpha: 0.6 },
    },
  })
    .png()
    .toBuffer();

test("lưu 3 kiểu nút, ảnh trong suốt, tải lại và khởi động lại máy chủ", async () => {
  const f = await fixture();
  try {
    const room = await f.makeRoom();
    const form = new FormData();
    form.append(
      "image",
      new Blob([await png()], { type: "image/png" }),
      "heart.png",
    );
    const upload = await f.request(`/api/teacher/rooms/${room.id}/images`, {
      method: "POST",
      body: form,
    });
    assert.equal(upload.status, 201);
    const buttons = [
      {
        ...room.buttons[0],
        text: "Con thích\n<script>alert(1)</script>",
        mode: "text",
      },
      { ...room.buttons[1], mode: "image", imageId: upload.data.imageId },
      {
        ...room.buttons[2],
        mode: "both",
        text: "Cùng nhau",
        imageId: upload.data.imageId,
        fontSize: 36,
      },
    ];
    const saved = await f.request(`/api/teacher/rooms/${room.id}`, {
      method: "PUT",
      body: { name: "Lớp 1.4", version: room.version, buttons },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.buttons.length, 3);
    assert.equal(saved.data.buttons[0].text, buttons[0].text);
    const image = await f.request(upload.data.imageUrl, { auth: false });
    const meta = await sharp(image.data).metadata();
    assert.equal(meta.width, 120);
    assert.equal(meta.height, 80);
    assert.equal(meta.hasAlpha, true);
    await f.restart();
    const publicRoom = (
      await f.request(`/api/rooms/${room.id}`, { auth: false })
    ).data;
    assert.equal(publicRoom.name, "Lớp 1.4");
    assert.equal(publicRoom.buttons[2].imageId, upload.data.imageId);
    assert.equal(
      (await f.request(upload.data.imageUrl, { auth: false })).status,
      200,
    );
    assert.equal("password" in publicRoom, false);
    assert.equal("counts" in publicRoom, false);
  } finally {
    await f.close();
  }
});

test("học sinh không có quyền sửa, tải ảnh, tìm ảnh hay đặt lại; chặn nguồn giả và dữ liệu sai", async () => {
  const f = await fixture();
  try {
    const room = await f.makeRoom();
    for (const [path, method, body] of [
      [
        `/api/teacher/rooms/${room.id}`,
        "PUT",
        { version: 1, name: "Hack", buttons: room.buttons },
      ],
      [`/api/teacher/rooms/${room.id}/reset`, "POST", { confirm: true }],
      [`/api/teacher/rooms/${room.id}/images`, "POST", {}],
      ["/api/teacher/images/search?q=flower", "GET", null],
      ["/api/teacher/rooms", "POST", { name: "Hack" }],
    ])
      assert.equal(
        (await f.request(path, { method, body, auth: false })).status,
        401,
      );
    assert.equal(
      (
        await f.request("/api/teacher/rooms", {
          method: "POST",
          body: { name: "Hack" },
          headers: { Origin: "https://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}`, {
          method: "PUT",
          body: { version: 1, name: "Bad", buttons: room.buttons.slice(0, 2) },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}/reset`, {
          method: "POST",
          body: {},
        })
      ).status,
      400,
    );
    const forged = new FormData();
    forged.append(
      "image",
      new Blob(["<script>evil</script>"], { type: "image/png" }),
      "fake.png",
    );
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}/images`, {
          method: "POST",
          body: forged,
        })
      ).status,
      400,
    );
    const oversized = new FormData();
    oversized.append(
      "image",
      new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }),
      "large.png",
    );
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}/images`, {
          method: "POST",
          body: oversized,
        })
      ).status,
      413,
    );
    const other = await f.makeRoom("Phòng khác");
    const form = new FormData();
    form.append(
      "image",
      new Blob([await png()], { type: "image/png" }),
      "ok.png",
    );
    const media = (
      await f.request(`/api/teacher/rooms/${other.id}/images`, {
        method: "POST",
        body: form,
      })
    ).data;
    const badButtons = room.buttons.map((b) => ({
      ...b,
      imageId: media.imageId,
    }));
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}`, {
          method: "PUT",
          body: { version: 1, name: "Bad", buttons: badButtons },
        })
      ).status,
      400,
    );
    await assert.rejects(f.socket(room.id, "teacher", false), /giáo viên/);
  } finally {
    await f.close();
  }
});

test("30 học sinh × 10 lượt: 300 sự kiện; chống trùng, tách phòng, reset và tồn tại sau restart", async () => {
  const f = await fixture();
  try {
    const room = await f.makeRoom();
    const other = await f.makeRoom("Phòng khác");
    const projector = (await f.socket(room.id, "projector")).client;
    const teacher = (await f.socket(room.id, "teacher", true)).client;
    const isolated = (await f.socket(other.id, "projector")).client;
    let animations = 0,
      leaked = 0,
      latestCounts;
    projector.on("reaction", () => animations++);
    isolated.on("reaction", () => leaked++);
    teacher.on("counts", (c) => (latestCounts = c));
    const students = await Promise.all(
      Array.from({ length: 30 }, () => f.socket(room.id)),
    );
    const firstId = randomUUID();
    const work = students.flatMap(({ client }, student) =>
      Array.from({ length: 10 }, (_, i) =>
        send(client, {
          eventId: student === 0 && i === 0 ? firstId : randomUUID(),
          buttonIndex: i % 3,
          epoch: 0,
        }),
      ),
    );
    const results = await Promise.all(work);
    assert.ok(results.every((r) => r.ok));
    const stats = (await f.request(`/api/teacher/rooms/${room.id}`)).data
      .counts;
    assert.deepEqual(stats.values, [120, 90, 90]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(animations, 300);
    assert.equal(leaked, 0);
    assert.deepEqual(latestCounts.values, [120, 90, 90]);
    const duplicate = await send(students[0].client, {
      eventId: firstId,
      buttonIndex: 0,
      epoch: 0,
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(animations, 300);
    await f.restart();
    assert.deepEqual(
      (await f.request(`/api/teacher/rooms/${room.id}`)).data.counts.values,
      [120, 90, 90],
    );
    const newStudent = (await f.socket(room.id)).client;
    assert.equal(
      (await send(newStudent, { eventId: firstId, buttonIndex: 0, epoch: 0 }))
        .duplicate,
      true,
    );
    const reset = await f.request(`/api/teacher/rooms/${room.id}/reset`, {
      method: "POST",
      body: { confirm: true },
    });
    assert.deepEqual(reset.data.values, [0, 0, 0]);
    assert.equal(reset.data.epoch, 1);
    assert.equal(
      (
        await send(newStudent, {
          eventId: randomUUID(),
          buttonIndex: 0,
          epoch: 0,
        })
      ).code,
      "EPOCH_CHANGED",
    );
    assert.equal(
      (
        await send(newStudent, {
          eventId: randomUUID(),
          buttonIndex: 2,
          epoch: 1,
        })
      ).ok,
      true,
    );
    assert.deepEqual(
      (await f.request(`/api/teacher/rooms/${room.id}`)).data.counts.values,
      [0, 0, 1],
    );
  } finally {
    await f.close();
  }
});

test("xung đột khi 2 cửa sổ lưu, invalid buttonIndex và đăng xuất thu hồi quyền", async () => {
  const f = await fixture();
  try {
    const room = await f.makeRoom();
    const config = { name: "Đổi tên", buttons: room.buttons, version: 1 };
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}`, {
          method: "PUT",
          body: config,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request(`/api/teacher/rooms/${room.id}`, {
          method: "PUT",
          body: config,
        })
      ).status,
      409,
    );
    const student = (await f.socket(room.id)).client;
    assert.equal(
      (await send(student, { eventId: randomUUID(), buttonIndex: 3, epoch: 0 }))
        .ok,
      false,
    );
    const teacher = (await f.socket(room.id, "teacher", true)).client;
    const disconnected = new Promise((resolve) =>
      teacher.once("disconnect", resolve),
    );
    assert.equal(
      (await f.request("/api/logout", { method: "POST" })).status,
      200,
    );
    await disconnected;
    assert.equal(
      (await f.request(`/api/teacher/rooms/${room.id}`)).status,
      401,
    );
  } finally {
    await f.close();
  }
});

test("dịch vụ ảnh xử lý kết quả rỗng và lỗi mạng thật, không thay bằng ảnh giả", async () => {
  const empty = createImageService({
    fetcher: async () =>
      new Response(JSON.stringify({ batchcomplete: true }), {
        headers: { "Content-Type": "application/json" },
      }),
  });
  assert.deepEqual((await empty.search("empty")).items, []);
  const failed = createImageService({
    fetcher: async () => {
      throw new Error("Network unavailable");
    },
  });
  await assert.rejects(failed.search("flower"), /Chưa kết nối/);
});
