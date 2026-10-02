import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { Server } from "socket.io";
import { createServer } from "node:http";
import {
  createHash,
  randomBytes,
  scryptSync,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { parse as parseCookie } from "cookie";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { openStore } from "./store.js";
import { openSupabaseStore } from "./supabase-store.js";
import {
  AppError,
  MAX_IMAGE_BYTES,
  normalizeImage,
  createImageService,
} from "./images.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const derive = promisify(scrypt);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const buttonSchema = z
  .object({
    mode: z.enum(["text", "image", "both"]),
    text: z
      .string()
      .max(60)
      .refine((value) => value.split("\n").length <= 4, "Tối đa 4 dòng chữ."),
    background: color,
    color,
    fontSize: z.number().int().min(18).max(36),
    imageId: z.uuid().nullable(),
  })
  .strip()
  .superRefine((button, ctx) => {
    if (button.mode !== "image" && !button.text.trim())
      ctx.addIssue({ code: "custom", message: "Hãy nhập chữ cho nút." });
    if (button.mode !== "text" && !button.imageId)
      ctx.addIssue({ code: "custom", message: "Hãy chọn ảnh cho nút." });
  });
const configSchema = z.object({
  name: z.string().trim().min(1).max(70),
  version: z.number().int().positive(),
  buttons: z.array(buttonSchema).length(3),
});

export async function createApplication(config) {
  if (
    !config.password ||
    config.password.length < 12 ||
    config.password.includes("thay-bang")
  ) {
    throw new Error(
      "Thiếu mật khẩu giáo viên. Chạy npm run setup hoặc đặt TEACHER_PASSWORD riêng, ít nhất 12 ký tự.",
    );
  }
  const production = config.production || false;
  const publicUrl = config.publicUrl ? new URL(config.publicUrl).origin : null;
  if (production && (!publicUrl || !publicUrl.startsWith("https://")))
    throw new Error(
      "Khi triển khai cần PUBLIC_URL hoặc RENDER_EXTERNAL_URL bắt đầu bằng https://.",
    );
  const allowedOrigins = new Set(
    [
      publicUrl,
      ...(!production
        ? [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            ...(config.devOrigins || []),
          ]
        : []),
    ].filter(Boolean),
  );
  const validOrigin = (origin) => !origin || allowedOrigins.has(origin);
  const provider = config.storageProvider || "sqlite";
  if (!["sqlite", "supabase"].includes(provider)) throw new Error("STORAGE_PROVIDER phải là sqlite hoặc supabase.");
  const store = config.store || (provider === "supabase"
    ? openSupabaseStore(config.supabase)
    : openStore(config.dataDir));
  const imageService =
    config.imageService ||
    createImageService({ userAgent: config.commonsUserAgent });
  const fingerprint = hash(config.password);
  const passwordSalt = randomBytes(32);
  const passwordDigest = scryptSync(config.password, passwordSalt, 64);
  try { await store.initialize(fingerprint); }
  catch (error) { await store.close(); throw error; }
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: [
            "'self'",
            "blob:",
            "data:",
            "https://upload.wikimedia.org",
            "https://thumb.wikimedia.org",
          ],
          connectSrc: [
            "'self'",
            ...(production ? [] : ["ws://localhost:*", "ws://127.0.0.1:*"]),
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
      referrerPolicy: { policy: "same-origin" },
    }),
  );
  app.use(express.json({ limit: "24kb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (!validOrigin(req.get("origin")) || req.get("X-Sky-Request") !== "1")
    ) {
      return res
        .status(403)
        .json({ error: "Yêu cầu không hợp lệ. Hãy tải lại trang." });
    }
    next();
  });
  const server = createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 8192,
    cors: {
      origin: (origin, cb) => cb(null, validOrigin(origin)),
      credentials: true,
    },
    allowRequest: (req, cb) => cb(null, validOrigin(req.headers.origin)),
  });
  async function session(cookieHeader) {
    const token = parseCookie(cookieHeader || "").sky_teacher;
    if (!token || token.length > 100) return null;
    return store.getSession(hash(token), fingerprint);
  }
  const teacherOnly = async (req, res, next) => {
    req.session = await session(req.headers.cookie);
    if (!req.session)
      return res.status(401).json({ error: "Vui lòng đăng nhập giáo viên." });
    next();
  };
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    path: "/",
    maxAge: 7 * 86400000,
  };
  const authLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 15,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Bạn đã thử nhiều lần. Vui lòng chờ 15 phút rồi thử lại.",
    },
  });
  const imageLimiter = rateLimit({
    windowMs: 60000,
    limit: 45,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Bạn đang tải/tìm ảnh quá nhanh. Hãy chờ một phút." },
  });
  const authCookie = (req) => session(req.headers.cookie);
  const getRoom = async (id) => {
    if (!z.uuid().safeParse(id).success) throw new AppError("Không tìm thấy phòng.", 404);
    const row = await store.get(id);
    if (!row)
      throw new AppError(
        "Không tìm thấy phòng. Hãy kiểm tra lại đường link.",
        404,
      );
    return row;
  };
  const broadcastCounts = (id, counts) =>
    io.to(`stats:${id}`).emit("counts", counts);

  app.get("/api/health", async (_req, res) => {
    await store.health();
    res.json({ ok: true });
  });
  app.get("/api/auth", async (req, res) =>
    res.json({ authenticated: !!(await authCookie(req)) }),
  );
  app.post("/api/login", authLimiter, async (req, res) => {
    const password = z.string().max(200).safeParse(req.body?.password);
    if (
      !password.success ||
      !timingSafeEqual(
        await derive(password.data, passwordSalt, 64),
        passwordDigest,
      )
    )
      return res
        .status(401)
        .json({ error: "Mật khẩu chưa đúng. Vui lòng thử lại." });
    const old = await authCookie(req);
    if (old) await store.deleteSession(old.hash);
    const token = randomBytes(32).toString("base64url");
    await store.createSession(
      hash(token),
      fingerprint,
      Date.now() + cookieOptions.maxAge,
    );
    res.cookie("sky_teacher", token, cookieOptions).json({ ok: true });
  });
  app.post("/api/logout", teacherOnly, async (req, res) => {
    await store.deleteSession(req.session.hash);
    io.in(`session:${req.session.hash}`).disconnectSockets();
    res
      .clearCookie("sky_teacher", { ...cookieOptions, maxAge: undefined })
      .json({ ok: true });
  });
  app.get("/api/teacher/rooms", teacherOnly, async (_req, res) => {
    res.json(await store.list());
  });
  app.post("/api/teacher/rooms", teacherOnly, async (req, res) => {
    const name = z.string().trim().min(1).max(70).parse(req.body?.name);
    res.status(201).json(await store.create(name));
  });
  app.get("/api/rooms/:id", async (req, res) =>
    res.json(await store.publicRoom(await getRoom(req.params.id))),
  );
  app.get("/api/teacher/rooms/:id", teacherOnly, async (req, res) => {
    const row = await getRoom(req.params.id);
    res.json({ ...(await store.publicRoom(row)), counts: store.counts(row) });
  });
  app.put("/api/teacher/rooms/:id", teacherOnly, async (req, res) => {
    const input = configSchema.parse(req.body);
    await getRoom(req.params.id);
    const saved = await store.save(req.params.id, input);
    io.to(`sky:${req.params.id}`).emit("room:updated", saved);
    res.json(saved);
  });
  app.delete("/api/teacher/rooms/:id", teacherOnly, async (req, res) => {
    if (req.body?.confirm !== true)
      throw new AppError("Vui lòng xác nhận xóa phòng.");
    await getRoom(req.params.id);
    await store.deleteRoom(req.params.id);
    io.to(`sky:${req.params.id}`).emit("room:deleted");
    io.in(`sky:${req.params.id}`).disconnectSockets(true);
    res.json({ ok: true });
  });
  app.post("/api/teacher/rooms/:id/reset", teacherOnly, async (req, res) => {
    if (req.body?.confirm !== true)
      throw new AppError("Vui lòng xác nhận đặt lại bộ đếm.");
    await getRoom(req.params.id);
    const row = await store.reset(req.params.id);
    broadcastCounts(row.id, store.counts(row));
    io.to(`sky:${row.id}`).emit("epoch", row.epoch);
    res.json(store.counts(row));
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
    fileFilter: (_req, file, cb) => {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.mimetype))
        cb(new AppError("Chỉ nhận ảnh PNG, JPG hoặc WebP."));
      else cb(null, true);
    },
  });
  app.post(
    "/api/teacher/rooms/:id/images",
    teacherOnly,
    imageLimiter,
    async (req, _res, next) => {
      await getRoom(req.params.id);
      next();
    },
    upload.single("image"),
    async (req, res) => {
      if (!req.file) throw new AppError("Hãy chọn một ảnh để tải lên.");
      res
        .status(201)
        .json(await store.saveMedia(req.params.id, await normalizeImage(req.file.buffer)));
    },
  );
  app.get(
    "/api/teacher/images/search",
    teacherOnly,
    imageLimiter,
    async (req, res) => {
      const q = z.string().trim().min(2).max(100).parse(req.query.q);
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(1000)
        .default(0)
        .parse(req.query.offset);
      res.json(await imageService.search(q, offset));
    },
  );
  app.post(
    "/api/teacher/rooms/:id/import-image",
    teacherOnly,
    imageLimiter,
    async (req, res) => {
      await getRoom(req.params.id);
      const pageId = z.number().int().positive().parse(req.body?.pageId);
      const { bytes, credit } = await imageService.importImage(pageId);
      res.status(201).json(await store.saveMedia(req.params.id, bytes, credit));
    },
  );
  app.get("/media/:id", async (req, res) => {
    if (!z.uuid().safeParse(req.params.id).success) return res.status(404).send("Không tìm thấy ảnh.");
    const media = await store.getMedia(req.params.id);
    if (!media) return res.status(404).send("Không tìm thấy ảnh.");
    res
      .set({
        "Content-Type": media.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": "inline",
      })
      .send(Buffer.from(media.bytes));
  });

  io.use(async (socket, next) => {
    try {
      const input = z.object({
        roomId: z.uuid(), role: z.enum(["student", "projector", "teacher"]),
      }).safeParse(socket.handshake.auth);
      if (!input.success || !(await store.get(input.data.roomId)))
        return next(new Error("Không tìm thấy phòng."));
      if (input.data.role === "teacher") {
        const current = await session(socket.request.headers.cookie);
        if (!current) return next(new Error("Phiên giáo viên đã hết hạn. Vui lòng đăng nhập lại."));
        socket.data.session = current;
      }
      socket.data.roomId = input.data.roomId;
      socket.data.role = input.data.role;
      next();
    } catch {
      next(new Error("Máy chủ đang kết nối kho dữ liệu. Đang thử lại…"));
    }
  });
  // Ghi nhớ lượt đã phát. RPC gửi lại có thể đã ghi dữ liệu trước khi mất kết nối.
  const broadcasted = new Map();
  io.on("connection", (socket) => {
    const id = socket.data.roomId;
    socket.join(`sky:${id}`);
    if (socket.data.session) {
      socket.join(`stats:${id}`);
      socket.join(`session:${socket.data.session.hash}`);
    }
    (async () => {
      const row = await store.get(id);
      if (!row || !socket.connected) return;
      socket.emit("ready", {
        room: await store.publicRoom(row),
        ...(socket.data.session ? { counts: store.counts(row) } : {}),
      });
    })().catch(() => socket.conn.close());
    let tokens = 60;
    let lastRefill = Date.now();
    socket.on("react", async (raw, callback) => {
      const ack = typeof callback === "function" ? callback : () => {};
      if (socket.data.role !== "student")
        return ack({
          ok: false,
          error: "Chỉ giao diện học sinh gửi lượt bấm.",
        });
      const input = z
        .object({
          eventId: z.uuid(),
          buttonIndex: z.number().int().min(0).max(2),
          epoch: z.number().int().nonnegative(),
        })
        .safeParse(raw);
      if (!input.success)
        return ack({ ok: false, error: "Lượt bấm không hợp lệ." });
      const now = Date.now();
      tokens = Math.min(60, tokens + (now - lastRefill) * 0.02);
      lastRefill = now;
      if (tokens < 1)
        return ack({ ok: false, retry: true, error: "Đang gửi các lượt bấm…" });
      tokens -= 1;
      try {
        const result = await store.react(
          id,
          input.data.eventId,
          input.data.buttonIndex,
          input.data.epoch,
        );
        if (result.error) return ack({ ok: false, ...result });
        const deliveryKey = id + ":" + input.data.eventId;
        if (result.button && result.counts.epoch === input.data.epoch && (!result.duplicate || !broadcasted.has(deliveryKey))) {
          broadcasted.set(deliveryKey, Date.now());
          if (broadcasted.size > 50000) broadcasted.delete(broadcasted.keys().next().value);
          io.to(`sky:${id}`).emit("reaction", {
            ...input.data,
            button: result.button,
            timestamp: result.timestamp || now,
          });
          broadcastCounts(id, result.counts);
        }
        ack({ ok: true, duplicate: !!result.duplicate });
      } catch {
        ack({
          ok: false,
          retry: true,
          error: "Máy chủ đang bận. Đang thử gửi lại…",
        });
      }
    });
  });

  let sweeping = false;
  const sweep = setInterval(async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await store.clean();
      for (const [key, time] of broadcasted)
        if (Date.now() - time > 600000) broadcasted.delete(key);
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.session && !(await session(socket.request.headers.cookie)))
          socket.disconnect(true);
      }
    } catch {
      console.error("Chưa dọn được dữ liệu cũ; sẽ thử lại ở lượt kế tiếp.");
    } finally { sweeping = false; }
  }, 60000);
  sweep.unref();
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Không tìm thấy chức năng này." }),
  );
  const dist = resolve(config.distDir || "dist");
  if (existsSync(resolve(dist, "index.html"))) {
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get("/{*path}", (_req, res) =>
      res
        .set("Cache-Control", "no-cache")
        .sendFile(resolve(dist, "index.html")),
    );
  } else
    app.get("/", (_req, res) =>
      res
        .type("text")
        .send(
          "Trong chế độ phát triển, mở http://localhost:5173. Hoặc chạy npm run build rồi npm start.",
        ),
    );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      const issue = error.issues.find((item) => item.code === "custom");
      const prefix =
        issue?.path?.[0] === "buttons"
          ? `Nút ${Number(issue.path[1]) + 1}: `
          : "";
      return res
        .status(400)
        .json({
          error: issue
            ? prefix + issue.message
            : "Nội dung chưa hợp lệ. Cần đúng 3 nút; chữ tối đa 60 ký tự / 4 dòng; cỡ chữ 18–36.",
        });
    }
    if (error.code === "LIMIT_FILE_SIZE")
      return res
        .status(413)
        .json({ error: "Ảnh quá lớn. Vui lòng chọn ảnh tối đa 5 MB." });
    if (error instanceof multer.MulterError)
      return res
        .status(400)
        .json({ error: "Vui lòng tải lên một ảnh mỗi lần." });
    if (error instanceof AppError)
      return res.status(error.status).json({ error: error.message });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Nội dung gửi lên quá lớn." });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Dữ liệu gửi lên không hợp lệ." });
    console.error("Lỗi máy chủ:", error.message);
    res.status(500).json({ error: "Máy chủ gặp lỗi. Vui lòng thử lại." });
  });
  return {
    app,
    server,
    io,
    store,
    async close() {
      clearInterval(sweep);
      await new Promise((resolveClose) => io.close(resolveClose));
      if (server.listening)
        await new Promise((resolveClose) => server.close(resolveClose));
      await store.close();
    },
  };
}
