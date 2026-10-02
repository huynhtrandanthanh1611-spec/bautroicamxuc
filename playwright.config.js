import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs",
  timeout: 45000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3012",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {},
  },
  webServer: {
    command: "node scripts/ui-test-server.mjs",
    url: "http://127.0.0.1:3012/api/health",
    reuseExistingServer: false,
    timeout: 20000,
  },
});
