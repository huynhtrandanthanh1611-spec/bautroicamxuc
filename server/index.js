import { resolve } from "node:path";
import { createApplication } from "./app.js";

try {
  const instance = await createApplication({
    password: process.env.TEACHER_PASSWORD,
    storageProvider: process.env.STORAGE_PROVIDER || "sqlite",
    supabase: {
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SECRET_KEY,
      bucket: process.env.SUPABASE_BUCKET || "sky-images",
    },
    production: process.env.NODE_ENV === "production",
    publicUrl: process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL,
    dataDir: resolve(process.env.DATA_DIR || "./data"),
    trustProxy: Number(process.env.TRUST_PROXY || 0),
    devOrigins: (process.env.DEV_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    commonsUserAgent: process.env.COMMONS_USER_AGENT,
  });
  const port = Number(process.env.PORT || 3001);
  instance.server.listen(port, "0.0.0.0", () =>
    console.log(`Bầu trời cảm xúc đang chạy tại http://localhost:${port}`),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, async () => {
      await instance.close();
      process.exit(0);
    });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
