import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:54111",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROME_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      command: "node ../backend/scripts/serve-dashboard-fixtures.mjs",
      url: "http://127.0.0.1:54110/__dashboard-ready",
      reuseExistingServer: false,
      timeout: 30000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 54111",
      url: "http://127.0.0.1:54111",
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        NETSENTRY_API_URL: "http://127.0.0.1:54110/api/v1",
        DASHBOARD_ORIGIN: "http://127.0.0.1:54111",
      },
      gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
    },
  ],
});
