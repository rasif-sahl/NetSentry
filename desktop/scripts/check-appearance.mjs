// Real Chromium renderer checks, no Electron runtime, agent or physical-device claims.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const require = createRequire(
  new URL("../../dashboard/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const root = resolve("desktop/dist/renderer");
const server = createServer(async (req, res) => {
  try {
    const file = resolve(
      root,
      "." +
        new URL(req.url, "http://localhost").pathname.replace(
          /\/$/,
          "/index.html",
        ),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[
        extname(file)
      ] || "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((yes) => server.listen(0, "127.0.0.1", yes));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROME_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
      colorScheme: "dark",
      viewport: { width: 640, height: 800 },
    }),
    page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const selection = page.getByLabel("Appearance on this computer");
  await selection.waitFor();
  const theme = () => page.locator("html").getAttribute("data-theme");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgb(25, 23, 30)",
  );
  await selection.selectOption("LIGHT");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.reload();
  assert.equal(await selection.inputValue(), "LIGHT");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await selection.selectOption("SYSTEM");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await selection.selectOption("DARK");
  assert.equal(await theme(), "dark");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByLabel("Appearance on this computer").selectOption("LIGHT");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await context.close();
  const restricted = await browser.newContext({ colorScheme: "dark" });
  await restricted.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  const blocked = await restricted.newPage();
  await blocked.goto(`http://127.0.0.1:${server.address().port}/`);
  await blocked.getByLabel("Appearance on this computer").selectOption("LIGHT");
  await blocked.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await restricted.close();
  console.log(
    "Desktop Chromium appearance checks passed: system changes, explicit overrides, reload, cross-window sync, blocked storage and narrow layout. Electron/Keychain packaging remains unverified.",
  );
} finally {
  await browser?.close();
  await new Promise((yes) => server.close(yes));
}
