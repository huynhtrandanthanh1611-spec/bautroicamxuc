// PostgreSQL thật qua PGlite; chỉ mô phỏng HTTP/Storage để chạy không cần tài khoản.
// Đây KHÔNG phải kiểm thử một project Supabase đã triển khai.
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

export async function createSupabaseHarness() {
  const db = new PGlite();
  await db.exec("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;");
  await db.exec(await readFile(new URL("../../supabase/001_sky.sql", import.meta.url), "utf8"));
  await db.exec("SET ROLE service_role");
  const files = new Map();
  const buckets = new Map();
  const control = { failAfterReactCommit: false, failUpload: false, failDownload: false, downloads: 0 };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const client = createClient("https://test.supabase.co", "sb_secret_test_only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, options = {}) => {
        assert.equal(new Headers(options.headers).get("apikey"), "sb_secret_test_only");
        const path = new URL(url).pathname;
        const method = options.method || "GET";
        if (path === "/rest/v1/rpc/sky_app_rpc") {
          const body = JSON.parse(options.body);
          try {
            const result = await db.query("SELECT public.sky_app_rpc($1, $2::jsonb) AS value", [body.action, JSON.stringify(body.payload)]);
            if (body.action === "react" && control.failAfterReactCommit) {
              control.failAfterReactCommit = false;
              return json({ message: "test connection lost after commit", code: "test" }, 503);
            }
            return json(result.rows[0].value);
          } catch (error) {
            return json({ code: error.code, message: error.message }, 400);
          }
        }
        if (path === "/storage/v1/bucket" && method === "POST") {
          const body = JSON.parse(options.body);
          buckets.set(body.id, body);
          return json({ name: body.id });
        }
        if (path.startsWith("/storage/v1/bucket/")) {
          const bucket = path.split("/").at(-1);
          return buckets.has(bucket) ? json(buckets.get(bucket)) : json({ message: "Bucket not found", statusCode: "404" }, 404);
        }
        if (path.startsWith("/storage/v1/object/")) {
          const key = path.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?/, "");
          if (method === "POST") {
            if (control.failUpload) return json({ message: "test upload failed", statusCode: "503" }, 503);
            files.set(key, Buffer.from(await new Response(options.body).arrayBuffer()));
            return json({ Id: key, Key: key });
          }
          if (method === "DELETE") {
            for (const prefix of JSON.parse(options.body).prefixes) files.delete(key + "/" + prefix);
            return json([]);
          }
          control.downloads++;
          if (control.failDownload) return json({ message: "test download failed", statusCode: "503" }, 503);
          return files.has(key)
            ? new Response(files.get(key), { headers: { "Content-Type": "image/webp" } })
            : json({ message: "Object not found", statusCode: "404" }, 404);
        }
        throw new Error("Unhandled test endpoint: " + path);
      },
    },
  });
  return { client, db, files, buckets, control, close: () => db.close() };
}
