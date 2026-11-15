import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
async function fixtures() {
  return JSON.parse(
    await readFile(resolve(process.cwd(), ".test/fixtures.json"), "utf8"),
  );
}
async function login(page: Page, account = "owner") {
  const data = await fixtures();
  await page.goto("/");
  await page.getByLabel("Email address").fill(data.accounts[account].email);
  await page.getByLabel("Password", { exact: true }).fill(data.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Active workspace")).not.toHaveValue("");
  await page.getByLabel("Active workspace").selectOption(data.workspaceId);
  await expect(page.getByLabel("Active workspace")).toHaveValue(
    data.workspaceId,
  );
  await expect(
    page.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  return data;
}
test("sign in, restore an HTTP-only session and sign out", async ({
  page,
  context,
}) => {
  await login(page);
  const cookies = await context.cookies();
  expect(cookies.filter((c) => c.name.startsWith("netsentry_"))).toHaveLength(
    2,
  );
  expect(
    cookies
      .filter((c) => c.name.startsWith("netsentry_"))
      .every((c) => c.httpOnly && c.sameSite === "Strict"),
  ).toBeTruthy();
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "netsentry_",
  );
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  expect(
    (await context.cookies()).filter((c) => c.name.startsWith("netsentry_")),
  ).toHaveLength(0);
});
test("reject cross-origin mutations and device-credential routes", async ({
  request,
}) => {
  const result = await request.post("/api/backend/auth/login", {
    headers: { origin: "https://untrusted.example" },
    data: {
      email: "owner@dashboard.example.invalid",
      password: "fixture-dashboard-password-123",
    },
  });
  expect(result.status()).toBe(403);
  const device = await request.post("/api/backend/devices/enrol", {
    headers: { origin: "http://127.0.0.1:54111" },
    data: {},
  });
  expect(device.status()).toBe(404);
});
test("invalid credentials stay on sign in with a useful error", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Email address")
    .fill("owner@dashboard.example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("invalid-fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("device inventory uses reported health and capability states", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Device inventory" }),
  ).toBeVisible();
  await page.getByLabel("Find a device").fill("no-such-fixture");
  await expect(
    page.getByText("No matching devices", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Find a device").fill("");
  await page
    .getByRole("button", { name: "View Fixture iOS", exact: true })
    .click();
  await expect(
    page.getByText("restricted by os", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Synthetic OS restriction; not verified native behavior", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "View Fixture Android", exact: true })
    .click();
  await page.getByText("Rename this device", { exact: true }).click();
  await page
    .getByLabel("Device name", { exact: true })
    .fill("Fixture Android renamed");
  await page
    .getByRole("button", { name: "Rename device", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Fixture Android renamed", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Protected", { exact: true })).toHaveCount(0);
});
test("reports show real measured/estimated values, export and isolate workspace switches", async ({
  page,
}) => {
  const data = await login(page);
  await page
    .getByRole("button", { name: "Usage & reports", exact: true })
    .click();
  await expect(
    page.getByText("10,485,760 bytes", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("9,437,184 bytes", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("synthetic-browser-1", { exact: true }).first(),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toBe("netsentry-usage.csv");
  expect(await readFile((await downloaded.path())!, "utf8")).toContain(
    '"measured","estimated"',
  );
  await page.getByLabel("Active workspace").selectOption(data.emptyId);
  await expect(
    page.getByText("No observations in this period", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("10,485,760 bytes", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Active workspace").selectOption(data.workspaceId);
});
test("viewers cannot expose another device report or monitoring controls", async ({
  page,
}) => {
  const data = await login(page, "viewer");
  await page.getByRole("button", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Device inventory" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause monitoring", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Usage & reports", exact: true })
    .click();
  await expect(
    page.getByText("No observations in this period", { exact: true }),
  ).toBeVisible();
  const response = await page.request.get(
    `/api/backend/workspaces/${data.workspaceId}/monitoring/usage?from=2026-11-01&to=2026-11-16&metric=mobile_data_bytes&deviceId=${data.deviceId}`,
  );
  expect(response.status()).toBe(403);
});
test("report failures have a recoverable error state", async ({ page }) => {
  await login(page);
  await page.route("**/api/backend/workspaces/*/monitoring/usage?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Synthetic connection failure" }),
    }),
  );
  await page
    .getByRole("button", { name: "Usage & reports", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Synthetic connection failure" }),
  ).toBeVisible();
  await page.unroute("**/api/backend/workspaces/*/monitoring/usage?*");
  await page
    .getByRole("button", { name: "Apply report filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Usage over time", exact: true }),
  ).toBeVisible();
});
test("manual network labels are explicit and editable", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Networks", exact: true }).click();
  await expect(
    page.getByRole("listitem").getByText("Fixture home label", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Network label name").fill("Browser fixture label");
  await page
    .getByRole("button", { name: "Create network label", exact: true })
    .click();
  await expect(
    page
      .getByRole("listitem")
      .getByText("Browser fixture label", { exact: true }),
  ).toBeVisible();
});

test("alerts expose delivery, acknowledgement and editable quiet-hour rules", async ({
  page,
}) => {
  const data = await login(page);
  await page.getByRole("button", { name: "Alerts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "In-app notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("threshold · warning", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Acknowledge notification", exact: true })
    .first()
    .click();
  await expect(page.getByText(/Acknowledged/).first()).toBeVisible();
  await page.getByLabel("Rule device").selectOption(data.deviceId);
  await page.getByLabel("Threshold (bytes)", { exact: true }).fill("20000000");
  await page.getByLabel("Use quiet hours", { exact: true }).check();
  await page.getByLabel("Quiet hours start").fill("21:30");
  await page.getByLabel("Quiet hours end").fill("07:15");
  await page
    .getByRole("button", { name: "Create alert rule", exact: true })
    .click();
  await expect(page.getByText(/Rule saved/)).toBeVisible();
  const created = page
    .getByRole("listitem")
    .filter({ hasText: "20,000,000 bytes" });
  await expect(created).toBeVisible();
  await created.getByRole("button", { name: "Edit rule", exact: true }).click();
  await page.getByLabel("Severity", { exact: true }).selectOption("critical");
  await page
    .getByLabel(
      "I understand that editing removes this rule’s previous alert and delivery history.",
    )
    .check();
  await page
    .getByRole("button", { name: "Update alert rule", exact: true })
    .click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "20,000,000 bytes" }),
  ).toContainText("critical");
  await page.getByLabel("In-app notifications", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Save notification preferences", exact: true })
    .click();
  await expect(
    page.getByText("Changes saved.", { exact: true }).last(),
  ).toBeVisible();
  await page.getByLabel("In-app notifications", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save notification preferences", exact: true })
    .click();
});
test("expired access cookies refresh safely across browser tabs", async ({
  page,
  context,
}) => {
  await login(page);
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await context.clearCookies({ name: "netsentry_access" });
  await Promise.all([page.reload(), second.reload()]);
  await expect(
    page.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).filter(
      (cookie) => cookie.name === "netsentry_access",
    ),
  ).toHaveLength(1);
});
