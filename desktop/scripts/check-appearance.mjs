// Real Chromium renderer checks, no Electron runtime, agent or physical-device claims.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
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
async function visit(page, id) {
  await page.evaluate((value) => {
    location.hash = value;
  }, id);
  await page.waitForFunction((value) => location.hash === "#" + value, id);
  // Wait for React's hashchange render, not just the location assignment.
  const labels = {
    status: "Computer status",
    pairing: "Pairing & identity",
    modules: "Module preferences",
    services: "Service inventory",
    projects: "Project groups",
    control: "Local shutdown permissions",
    history: "Action history",
    remote: "Remote service access",
    network: "Network observation sharing",
    background: "Service status",
    login: "Run at login",
    appearance: "Appearance",
    updates: "Desktop updates",
    diagnostics: "Diagnostics & recovery",
  };
  await page
    .getByRole("heading", { name: labels[id], exact: true, level: 1 })
    .waitFor();
}
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
  await page.goto(`http://127.0.0.1:${server.address().port}/#appearance`);
  const selection = page.getByRole("group", {
    name: "Appearance on this computer",
  });
  await selection.waitFor();
  const theme = () => page.locator("html").getAttribute("data-theme");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgb(25, 23, 30)",
  );
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.reload();
  assert.equal(
    await page.getByRole("radio", { name: "Light", exact: true }).isChecked(),
    true,
  );
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page
    .getByRole("radio", { name: "Use system theme", exact: true })
    .check();
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  assert.equal(await theme(), "dark");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const other = await context.newPage();
  await other.goto(page.url());
  await other.getByRole("radio", { name: "Light", exact: true }).check();
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
  await blocked.goto(`http://127.0.0.1:${server.address().port}/#appearance`);
  await blocked.getByRole("radio", { name: "Light", exact: true }).check();
  await blocked.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await restricted.close();
  // UI fixtures only: no agent, network discovery or process signalling.
  const paired = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 360, height: 800 },
  });
  await paired.addInitScript(() => {
    window.__fixtureStops = 0;
    window.netsentry = {
      backgroundService: async () => ({
        verified: true,
        registered: false,
        loaded: false,
        running: false,
        canRegister: false,
        message:
          "Fixture: registration requires a signed installed application.",
      }),
      desktopUpdate: async () => ({
        state: "disabled",
        version: "0.1.0",
        message: "Production updates are unavailable until configured.",
      }),
      getAgentStatus: async () => ({
        ok: true,
        status: {
          schemaVersion: 1,
          installationId: "synthetic-installation",
          version: "0.1.0",
          platform: "darwin",
          paired: true,
          connection: "online",
          requested: { network: true, developer: true },
          authorized: { network: true, developer: true },
          effective: { network: true, developer: true },
          backgroundRequested: false,
          backgroundAllowed: false,
          bufferedEvents: 0,
          droppedEvents: 0,
          lastContact: "",
          code: "",
          serviceControlAvailable: false,
        },
      }),
      getNetworkPreferences: async () => ({
        ok: true,
        data: { sharing: false, networkId: "", supported: true },
      }),
      getRemotePreferences: async () => ({
        ok: true,
        data: { sharing: false, control: false, supported: true },
      }),
      listServices: async () => {
        const time = new Date().toISOString();
        return {
          ok: true,
          data: {
            schemaVersion: 1,
            services: [
              {
                id: "fixture-service",
                observationId: "fixture-observation",
                pid: 12345,
                parentPid: 1234,
                runtime: "node",
                executable: "node",
                startedAt: time,
                uptimeSeconds: 60,
                observedAt: time,
                endpoints: [
                  {
                    address: "127.0.0.1",
                    port: 43210,
                    socketId: "fixture-socket",
                  },
                ],
                additionalEndpoints: 0,
                project: {
                  id: "fixture-project",
                  name: "Synthetic project " + "A".repeat(100),
                  source: "inferred",
                  confidence: "inferred",
                  evidence: "Synthetic renderer fixture only",
                },
                childCount: 2,
                canStop: true,
                blockReason: "",
              },
            ],
            total: 1,
            offset: 0,
            nextOffset: -1,
            truncated: false,
            skippedProcesses: 0,
            observedAt: time,
            expiresAt: new Date(Date.now() + 15000).toISOString(),
            platformSupported: true,
            localControlAllowed: true,
          },
        };
      },
      getServiceHistory: async () => ({ ok: true, data: [] }),
      stopService: async () => {
        window.__fixtureStops++;
        throw new Error("Tests must never submit a stop");
      },
    };
  });
  const controls = await paired.newPage();
  await controls.clock.install();
  await controls.goto(`http://127.0.0.1:${server.address().port}/#services`);
  await controls
    .getByRole("button", { name: "Refresh services", exact: true })
    .click();
  await controls
    .getByRole("button", { name: "Review service", exact: true })
    .click();
  const stop = controls.getByRole("button", {
    name: "Stop gracefully",
    exact: true,
  });
  await stop.waitFor();
  assert.equal(await stop.isEnabled(), true);
  await controls.clock.fastForward(15000);
  assert.equal(await stop.isDisabled(), true);
  await visit(controls, "updates");
  await controls
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await controls
    .getByText("Production updates are unavailable until configured.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await controls
      .getByRole("button", { name: "Check for updates", exact: true })
      .isDisabled(),
    true,
  );
  await visit(controls, "login");
  await controls
    .getByRole("heading", { name: "Run at login", exact: true, level: 1 })
    .waitFor();
  assert.equal(
    await controls
      .getByRole("button", { name: "Register background service", exact: true })
      .isDisabled(),
    true,
  );
  await visit(controls, "background");
  assert.equal(
    await controls
      .getByRole("button", { name: "Remove background service", exact: true })
      .isDisabled(),
    false,
  );
  await controls.evaluate(() => {
    let registered = false;
    window.__fixtureBackgroundActions = [];
    window.netsentry.backgroundService = async (action) => {
      window.__fixtureBackgroundActions.push(action);
      if (action === "register") registered = true;
      if (action === "remove") registered = false;
      return {
        verified: true,
        registered,
        loaded: registered,
        running: registered,
        canRegister: true,
        message: registered
          ? "Fixture: managed background service registered."
          : "Fixture: no managed service remains.",
      };
    };
  });
  await controls
    .getByRole("button", { name: "Refresh background status", exact: true })
    .click();
  await visit(controls, "login");
  await controls
    .getByRole("button", { name: "Register background service", exact: true })
    .click();
  await controls
    .getByText("Fixture: managed background service registered.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await controls
      .getByRole("button", { name: "Register background service", exact: true })
      .isDisabled(),
    true,
  );
  await visit(controls, "background");
  await controls
    .getByRole("button", { name: "Remove background service", exact: true })
    .click();
  await controls
    .getByText("Fixture: no managed service remains.", { exact: true })
    .waitFor();
  assert.deepEqual(
    await controls.evaluate(() =>
      window.__fixtureBackgroundActions.filter((value) => value !== "status"),
    ),
    ["register", "remove"],
  );
  await visit(controls, "diagnostics");
  assert.equal(
    await controls
      .getByRole("button", { name: "Repair stale socket", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await controls
      .getByRole("button", { name: "Export redacted diagnostics", exact: true })
      .isDisabled(),
    true,
  );
  await controls.evaluate(() => {
    window.__fixtureDiagnostics = [];
    window.netsentry.desktopDiagnostics = async (action) => {
      window.__fixtureDiagnostics.push(action);
      return {
        schemaVersion: 1,
        checkedAt: new Date().toISOString(),
        environment: {
          platform: "darwin",
          architecture: "arm64",
          appVersion: "fixture",
        },
        checks: [
          {
            code: "SOCKET_STALE",
            message: "Fixture: private socket without a listener.",
            nextStep: "Explicit recovery only.",
          },
        ],
        canRepair: action === "check",
        ...(action === "repair"
          ? { outcome: "REPAIR_CANCELLED" }
          : action === "export"
            ? { outcome: "EXPORT_CANCELLED" }
            : {}),
      };
    };
  });
  assert.deepEqual(
    await controls.evaluate(() => window.__fixtureDiagnostics),
    [],
  );
  await controls
    .getByRole("button", { name: "Check desktop diagnostics", exact: true })
    .click();
  await controls
    .getByText("Fixture: private socket without a listener.", { exact: true })
    .waitFor();
  assert.equal(
    await controls
      .getByRole("button", { name: "Repair stale socket", exact: true })
      .isDisabled(),
    false,
  );
  await controls
    .getByRole("button", { name: "Repair stale socket", exact: true })
    .click();
  await controls
    .getByText("Socket recovery was cancelled. No socket was changed.", {
      exact: true,
    })
    .waitFor();
  await controls
    .getByRole("button", { name: "Export redacted diagnostics", exact: true })
    .click();
  await controls
    .getByText("Diagnostic export was cancelled.", { exact: true })
    .waitFor();
  assert.deepEqual(await controls.evaluate(() => window.__fixtureDiagnostics), [
    "check",
    "repair",
    "export",
  ]);
  const layout = () =>
    controls.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  assert.equal(await layout(), true);
  for (const [option, background, dangerText] of [
    ["DARK", "rgb(37, 33, 44)", "rgb(255, 212, 220)"],
    ["LIGHT", "rgb(255, 255, 255)", "rgb(146, 43, 53)"],
  ]) {
    await visit(controls, "appearance");
    await controls
      .getByRole("radio", {
        name: option === "DARK" ? "Dark" : "Light",
        exact: true,
      })
      .check();
    await visit(controls, "services");
    await controls
      .getByRole("button", { name: "Refresh services", exact: true })
      .click();
    await controls
      .getByRole("button", { name: "Review service", exact: true })
      .click();
    await controls
      .getByRole("button", { name: "Force stop…", exact: true })
      .click();
    const modal = controls.getByRole("dialog");
    await modal.waitFor();
    assert.equal(
      await modal.evaluate((el) => getComputedStyle(el).backgroundColor),
      background,
    );
    assert.equal(
      await controls
        .getByRole("button", { name: "Confirm force-stop", exact: true })
        .evaluate((el) => getComputedStyle(el).color),
      dangerText,
    );
    assert.equal(await layout(), true);
    await controls.getByRole("button", { name: "Cancel", exact: true }).click();
    await controls
      .getByRole("button", { name: "Stop gracefully", exact: true })
      .click();
    await controls
      .getByRole("button", { name: "Confirm graceful stop", exact: true })
      .waitFor();
    await controls.keyboard.press("Escape");
  }
  await controls.setViewportSize({ width: 1040, height: 800 });
  assert.equal(await layout(), true);
  assert.equal(await controls.evaluate(() => window.__fixtureStops), 0);
  await controls
    .getByRole("button", { name: "Refresh services", exact: true })
    .focus();
  assert.equal(
    await controls
      .getByRole("button", { name: "Refresh services", exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
    "solid",
  );
  await controls.evaluate(() => window.scrollTo(0, 0));
  await controls.screenshot({
    path:
      process.env.DESKTOP_THEME_SCREENSHOT ||
      "/tmp/netsentry-desktop-tailwind.png",
    fullPage: true,
  });
  const routes = {
    status: "Computer status",
    pairing: "Pairing & identity",
    modules: "Module preferences",
    services: "Service inventory",
    projects: "Project groups",
    control: "Local shutdown permissions",
    history: "Action history",
    remote: "Remote service access",
    network: "Network observation sharing",
    background: "Service status",
    login: "Run at login",
    appearance: "Appearance",
    updates: "Desktop updates",
    diagnostics: "Diagnostics & recovery",
  };
  const captures = process.env.DESKTOP_NAV_SCREENSHOTS;
  if (captures) {
    await mkdir(captures, { recursive: true });
    await controls.setViewportSize({ width: 1440, height: 940 });
  }
  for (const [id, label] of Object.entries(routes)) {
    await visit(controls, id);
    assert.equal(
      await controls
        .locator('nav[aria-label="Desktop navigation"] [aria-current="page"]')
        .innerText(),
      label,
    );
    assert.equal(await layout(), true);
    if (captures) {
      await controls.evaluate(() => window.scrollTo(0, 0));
      await controls.screenshot({
        path: resolve(captures, id + ".png"),
        fullPage: true,
      });
    }
  }
  await visit(controls, "services");
  await controls
    .getByRole("button", { name: "Refresh services", exact: true })
    .click();
  await controls
    .getByRole("button", { name: "Review service", exact: true })
    .waitFor();
  // A late service response cannot recreate inventory on another page.
  await controls.evaluate(async () => {
    const original = window.netsentry.listServices;
    window.__lateInventory = await original("", 0);
    window.netsentry.listServices = () =>
      new Promise((resolve) => {
        window.__resolveInventory = resolve;
      });
  });
  await controls
    .getByRole("button", { name: "Refresh services", exact: true })
    .click();
  await visit(controls, "history");
  await controls.evaluate(() =>
    window.__resolveInventory(window.__lateInventory),
  );
  assert.equal(
    await controls
      .getByRole("button", { name: "Review service", exact: true })
      .count(),
    0,
  );
  await controls.goBack();
  await controls
    .getByRole("heading", { name: "Service inventory", exact: true, level: 1 })
    .waitFor();
  assert.equal(
    await controls
      .getByRole("button", { name: "Review service", exact: true })
      .count(),
    0,
  );
  await controls.evaluate(() => {
    window.netsentry.getAgentStatus = async () => ({
      ok: false,
      code: "AGENT_UNAVAILABLE",
    });
  });
  await controls
    .getByRole("button", { name: "Refresh agent status", exact: true })
    .click();
  await controls.getByText("Setup required", { exact: true }).waitFor();
  await visit(controls, "remote");
  assert.equal(
    await controls
      .getByRole("button", { name: "Save remote preferences", exact: true })
      .count(),
    0,
  );
  assert.equal(await controls.evaluate(() => window.__fixtureStops), 0);
  await paired.close();
  console.log(
    "Desktop Chromium navigation/appearance checks passed: 14 destinations, browser Back, late-response isolation, lost-agent clearing, system changes, explicit overrides, reload, cross-window sync, blocked storage, responsive service cards, themed confirmation dialogs, keyboard focus and no stop submission. Electron/Keychain packaging remains unverified.",
  );
} finally {
  await browser?.close();
  await new Promise((yes) => server.close(yes));
}
