import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "homepage.spec.ts",
    "product.spec.ts",
    "applications.spec.ts",
    "solutions.spec.ts",
    "documentation.spec.ts",
    "pricing.spec.ts",
    "contact.spec.ts",
  ],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:54111",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROME_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 54111",
    url: "http://127.0.0.1:54111",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
  },
});
