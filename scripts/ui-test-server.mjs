import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApplication } from "../server/app.js";
import { openSupabaseStore } from "../server/supabase-store.js";
import { createSupabaseHarness } from "../tests/helpers/supabase-harness.mjs";
const directory = mkdtempSync(join(tmpdir(), "sky-ui-"));
const backend = process.env.SKY_TEST_SUPABASE === "1" ? await createSupabaseHarness() : null;
const instance = await createApplication({
  password: "UI-test-password-2026",
  dataDir: directory,
  store: backend ? openSupabaseStore({ client: backend.client }) : undefined,
  devOrigins: ["http://127.0.0.1:3012"],
});
instance.server.listen(3012, "127.0.0.1", () =>
  console.log("UI test server: http://127.0.0.1:3012"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await instance.close();
    await backend?.close();
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
