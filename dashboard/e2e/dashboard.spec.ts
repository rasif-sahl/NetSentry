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
  await page.goto("/app");
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
async function openTab(page: Page, name: string) {
  const tab = page
    .getByRole("navigation", { name: / sections$/ })
    .getByRole("link", { name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-current", "page");
}

test("sign in, restore an HTTP-only session and sign out", async ({
  page,
  context,
}) => {
  await login(page);
  await expect(
    page.getByRole("region", { name: "Email verification" }),
  ).toHaveCount(0);
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
  await page.goto("/app");
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
  const details = page.getByRole("button", {
    name: "View device details",
    exact: true,
  });
  await expect(details).toBeVisible();
  await expect(page.locator(".button-row").filter({ has: details })).toHaveCSS(
    "justify-content",
    "flex-end",
  );
  await details.press("Enter");
  await expect(page).toHaveURL(/\/app\/devices$/);
  await expect(
    page.getByRole("heading", { name: "Device inventory" }),
  ).toBeVisible();
  const search = page.getByLabel("Find a device");
  await search.fill("no-such-fixture");
  await expect(
    page.getByText("No matching devices", { exact: true }),
  ).toBeVisible();
  const inventory = page.locator(".card").filter({
    has: page.getByRole("heading", { name: "Device inventory", exact: true }),
  });
  const viewport = page.viewportSize()!;
  for (const width of [viewport.width, 390]) {
    await page.setViewportSize({ width, height: viewport.height });
    const inputBounds = await search.boundingBox();
    const emptyBounds = await inventory.locator(".empty").boundingBox();
    expect(
      emptyBounds!.y - (inputBounds!.y + inputBounds!.height),
    ).toBeGreaterThanOrEqual(12);
  }
  await page.setViewportSize(viewport);
  await search.fill("");
  const list = inventory.getByRole("list");
  await expect(list).toBeVisible();
  const inputBounds = await search.boundingBox();
  const listBounds = await list.boundingBox();
  expect(
    listBounds!.y - (inputBounds!.y + inputBounds!.height),
  ).toBeGreaterThanOrEqual(12);
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
    .getByRole("button", { name: "Explore reports", exact: true })
    .click();
  await expect(
    page.getByText("10,485,760 bytes", { exact: true }).first(),
  ).toBeVisible();
  // A collection interval can cross workspace midnight. Check the estimated
  // total across the displayed buckets rather than assuming a single day row.
  const estimatedCells = page
    .locator("table")
    .filter({
      has: page.getByRole("columnheader", { name: "Estimated", exact: true }),
    })
    .locator("tbody tr td:nth-of-type(2)");
  await expect
    .poll(async () =>
      (await estimatedCells.allTextContents()).reduce(
        (sum, text) => sum + Number(text.replace(/[^0-9.-]/g, "")),
        0,
      ),
    )
    .toBeCloseTo(9437184, 1);
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
  await page.getByRole("link", { name: "Devices", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Device inventory" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause monitoring", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Usage & reports", exact: true })
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
    .getByRole("link", { name: "Usage & reports", exact: true })
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
test("account settings and Operations stay available during an inventory outage", async ({
  page,
}) => {
  const data = await login(page);
  await page.route(
    `**/api/backend/workspaces/${data.workspaceId}/devices`,
    (route) =>
      route.fulfill({
        status: 503,
        json: { message: "Synthetic inventory outage" },
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "Synthetic inventory outage" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Settings & privacy", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Operations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Platform operations", exact: true }),
  ).toBeVisible();
});

test("manual network labels are explicit and editable", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Networks", exact: true }).click();
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
  await page
    .getByRole("button", { name: "Manage alerts", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "In-app notifications", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("threshold · measured · warning", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Acknowledge notification", exact: true })
    .first()
    .click();
  await expect(page.getByText(/Acknowledged/).first()).toBeVisible();
  await expect(page).toHaveURL("/app/alerts");
  await expect(
    page.getByRole("heading", { name: "Your alert rules" }),
  ).toHaveCount(0);
  await openTab(page, "History");
  await expect(page).toHaveURL("/app/alerts/history");
  await expect(
    page.getByRole("heading", { name: "Alert history and delivery" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "In-app notifications" }),
  ).toBeVisible();
  await openTab(page, "Rules");
  await expect(page).toHaveURL("/app/alerts/rules");
  await expect(
    page.getByRole("heading", { name: "Create an alert rule" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Create rule", exact: true }).click();
  await page.getByLabel("Rule device").selectOption(data.deviceId);
  await expect(page.getByLabel("Threshold data quality")).toHaveValue(
    "measured",
  );
  await page.getByLabel("Threshold data quality").selectOption("estimated");
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
  await expect(created).toContainText("estimated");
  await created.getByRole("button", { name: "Edit rule", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel editing", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create rule", exact: true }),
  ).toBeVisible();
  await created.getByRole("button", { name: "Edit rule", exact: true }).click();
  await expect(page.getByLabel("Threshold data quality")).toHaveValue(
    "estimated",
  );
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
  await expect(
    page.getByRole("listitem").filter({ hasText: "20,000,000 bytes" }),
  ).toContainText("estimated");
  await openTab(page, "Preferences");
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
  await second.goto("/app");
  await expect(
    second.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  // Wait for all initial workspace reads before expiring the shared cookie.
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

test("sign out revokes the server session after the access cookie expires", async ({
  page,
  context,
}) => {
  await login(page);
  const refresh = (await context.cookies()).find(
    (cookie) => cookie.name === "netsentry_refresh",
  )!;
  expect(refresh).toBeDefined();
  await context.clearCookies({ name: "netsentry_access" });
  const [logout] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith("/api/backend/auth/logout/refresh"),
    ),
    page.getByRole("button", { name: "Sign out", exact: true }).click(),
  ]);
  expect(logout.status()).toBe(201);
  await expect(
    page.getByText("You have signed out.", { exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).filter(({ name }) =>
      name.startsWith("netsentry_"),
    ),
  ).toHaveLength(0);

  // The isolated fixture verifies server revocation independently of cookie clearing.
  const result = await page.request.post(
    "http://127.0.0.1:54110/api/v1/auth/refresh",
    {
      data: { refreshToken: refresh.value },
    },
  );
  expect(result.status()).toBe(401);
});

test("team invitations bind a recipient and management changes take effect", async ({
  page,
  browser,
}) => {
  const data = await login(page);
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace members", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Recipient email").fill(data.accounts.recovery.email);
  await page.getByLabel("Invitation role").selectOption("MEMBER");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const token = await page.getByTestId("invitation-token").innerText();
  await page.getByRole("button", { name: "Hide token", exact: true }).click();
  await expect(page.getByTestId("invitation-token")).toHaveCount(0);
  const recipient = await browser.newContext();
  const guest = await recipient.newPage();
  await guest.goto("/app");
  await guest.getByLabel("Email address").fill(data.accounts.recovery.email);
  await guest.getByLabel("Password", { exact: true }).fill(data.password);
  await guest.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  await guest.getByRole("link", { name: "Team", exact: true }).click();
  await openTab(guest, "Workspaces");
  await guest.getByLabel("Invitation token").fill(token);
  await guest
    .getByRole("button", { name: "Accept invitation", exact: true })
    .click();
  await expect(guest.getByText(/Invitation accepted/)).toBeVisible();
  await guest.getByLabel("Active workspace").selectOption(data.workspaceId);
  await expect(guest.getByLabel("Active workspace")).toHaveValue(
    data.workspaceId,
  );
  await expect(
    guest.getByRole("heading", { name: "Invite someone", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Refresh workspace", exact: true })
    .click();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Team", exact: true }).click();
  const members = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Workspace members",
      exact: true,
    }),
  });
  const member = members
    .getByRole("listitem")
    .filter({ hasText: data.accounts.recovery.email });
  await member.getByText("Manage member", { exact: true }).click();
  await member.getByLabel("Role for Fixture recovery").selectOption("VIEWER");
  await member
    .getByLabel("I understand this may revoke devices or delete queued alerts.")
    .check();
  await member
    .getByRole("button", { name: "Change member role", exact: true })
    .click();
  await expect(member).toContainText("VIEWER");
  page.once("dialog", (dialog) => dialog.accept());
  await member
    .getByRole("button", { name: "Remove member", exact: true })
    .click();
  await expect(
    members.getByText(data.accounts.recovery.email, { exact: false }),
  ).toHaveCount(0);
  const denied = await guest.request.get(
    `/api/backend/workspaces/${data.workspaceId}/members`,
  );
  expect(denied.status()).toBe(403);
  await recipient.close();
});
test("a verified user can create and switch to a new workspace", async ({
  page,
}) => {
  const data = await login(page);
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await openTab(page, "Workspaces");
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("Browser-created workspace");
  await page
    .getByLabel("Workspace type", { exact: true })
    .selectOption("BUSINESS");
  await page
    .getByLabel("Workspace timezone", { exact: true })
    .fill("Asia/Colombo");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.getByText(/Workspace created/)).toBeVisible();
  await page
    .getByLabel("Active workspace")
    .selectOption({ label: "Browser-created workspace · business" });
  await expect(
    page.getByText("Asia/Colombo", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Active workspace").selectOption(data.workspaceId);
});

test("profile, appearance, retention, sessions and personal export use the backend", async ({
  page,
}) => {
  const data = await login(page);
  await page
    .getByRole("link", { name: "Settings & privacy", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  const profileCard = page.locator(".card").filter({
    has: page.getByRole("heading", { name: "Your profile", exact: true }),
  });
  const appearanceCard = page.locator(".card").filter({
    has: page.getByRole("heading", {
      name: "Appearance and accessibility",
      exact: true,
    }),
  });
  const viewport = page.viewportSize()!;
  const profileAction = await profileCard
    .getByRole("button", { name: "Update profile" })
    .boundingBox();
  const appearanceAction = await appearanceCard
    .getByRole("button", { name: "Save display preferences" })
    .boundingBox();
  expect(profileAction!.y).toBeCloseTo(appearanceAction!.y, 0);
  await expect(
    profileCard.getByText("Verified", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  const mobileProfile = (await profileCard.boundingBox())!;
  const mobileAppearance = (await appearanceCard.boundingBox())!;
  expect(mobileAppearance.x).toBe(mobileProfile.x);
  expect(mobileAppearance.y).toBeGreaterThan(
    mobileProfile.y + mobileProfile.height,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.setViewportSize(viewport);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Fixture owner updated");
  await page
    .getByRole("button", { name: "Update profile", exact: true })
    .click();
  await expect(page.locator(".sidebar-profile")).toContainText(
    "Fixture owner updated",
  );
  await page.getByText("Dark", { exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeChecked();
  await page.getByText("Reduce motion", { exact: true }).click();
  await expect(
    page.getByRole("switch", { name: "Reduce motion" }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Save display preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("radio", { name: "Dark", exact: true }),
  ).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings & privacy", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openTab(page, "Workspace");
  await page.getByLabel("Raw observations (days)", { exact: true }).fill("20");
  await page
    .getByLabel("Aggregates and gaps (days)", { exact: true })
    .fill("300");
  await page
    .getByLabel(
      "I understand shorter retention can permanently remove existing data.",
    )
    .check();
  await page
    .getByRole("button", { name: "Update retention policy", exact: true })
    .click();
  await expect(page.getByText(/Retention policy updated/)).toBeVisible();
  const policy = await page.request.get(
    `/api/backend/workspaces/${data.workspaceId}/monitoring/retention`,
  );
  expect((await policy.json()).rawDays).toBe(20);
  await openTab(page, "Privacy");
  await page
    .getByLabel("Current password for export", { exact: true })
    .fill(data.password);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download personal data", exact: true })
    .click();
  const downloaded = await downloading;
  const exported = JSON.parse(
    await readFile((await downloaded.path())!, "utf8"),
  );
  expect(exported.user.id).toBe(data.accounts.owner.id);
  expect(exported.monitoring.measurements.length).toBeGreaterThan(0);
  expect(JSON.stringify(exported)).not.toMatch(
    /credentialHash|payloadHash|refreshToken/,
  );
  await openTab(page, "Sessions");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Sign out other sessions", exact: true })
    .click();
  const sessions = await page.request.get("/api/backend/auth/sessions");
  expect(
    (await sessions.json()).some(
      (session: { revokedAt: string | null }) => !!session.revokedAt,
    ),
  ).toBeTruthy();
  await openTab(page, "Privacy");
  await page
    .getByText("Review permanent account deletion", { exact: true })
    .click();
  await page
    .getByLabel("Current password for account deletion", { exact: true })
    .fill(data.password);
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByLabel("I understand account deletion cannot be undone.")
    .check();
  await page
    .getByRole("button", { name: "Permanently delete account", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Transfer ownership" }),
  ).toBeVisible();
});
test("email verification and password recovery consume email-fragment codes", async ({
  page,
  context,
}) => {
  const data = await fixtures();
  await page.goto("/app");
  await page.getByLabel("Email address").fill(data.accounts.unverified.email);
  await page.getByLabel("Password", { exact: true }).fill(data.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const stripe = page.getByRole("region", { name: "Email verification" });
  await expect(stripe).toBeVisible();
  await stripe.getByRole("button", { name: "I’ve verified my email" }).click();
  await expect(stripe.getByRole("status")).toHaveText(
    "Email verification is still pending.",
  );

  const verifyPage = await context.newPage();
  await verifyPage.goto("/verify-email#token=" + data.tokens.unverified);
  await expect(verifyPage.getByLabel("Verification code")).toHaveValue(
    data.tokens.unverified,
  );
  expect(verifyPage.url()).not.toContain(data.tokens.unverified);
  await verifyPage
    .getByRole("button", { name: "Verify email", exact: true })
    .click();
  await expect(
    verifyPage.getByText(/Email verified. You can now sign in/),
  ).toBeVisible();
  await verifyPage.close();
  await stripe.getByRole("button", { name: "I’ve verified my email" }).click();
  await expect(stripe).toHaveCount(0);
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.goto("/reset-password#token=" + data.tokens.recovery);
  await expect(page.getByLabel("Reset code")).toHaveValue(data.tokens.recovery);
  expect(page.url()).not.toContain(data.tokens.recovery);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-fixture-recovery-password-123");
  const confirmPassword = page.getByLabel("Confirm new password", {
    exact: true,
  });
  await confirmPassword.fill("new-fixture-recovery-password-123");
  await page
    .getByRole("button", { name: "Show confirm new password", exact: true })
    .click();
  await expect(confirmPassword).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByText(/Password reset. Sign in/)).toBeVisible();
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await page.getByLabel("Email address").fill(data.accounts.recovery.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-fixture-recovery-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
});
test("registration and password-confirmed account deletion clear the browser session", async ({
  page,
  context,
}) => {
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Disposable browser fixture");
  await page
    .getByLabel("Email address")
    .fill("disposable@dashboard.example.invalid");
  const password = page.getByLabel("Password", { exact: true });
  const showPassword = page.getByRole("button", {
    name: "Show password",
    exact: true,
  });
  const hidePassword = page.getByRole("button", {
    name: "Hide password",
    exact: true,
  });
  await expect(password).toHaveAttribute("type", "password");
  await password.fill("disposable-fixture-password-123");
  await password.press("Tab");
  await expect(showPassword).toBeFocused();
  await showPassword.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await hidePassword.press("Enter");
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("disposable-fixture-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  const stripe = page.getByRole("region", { name: "Email verification" });
  const sendEmail = stripe.getByRole("button", {
    name: "Send verification email",
  });
  await expect(stripe).toContainText(
    "Verify your email to manage workspace access and monitoring.",
  );
  await expect(
    page.locator("header.topbar + .verification-stripe + main"),
  ).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const desktopButton = await sendEmail.boundingBox();
  const desktopStripe = await stripe.boundingBox();
  expect(desktopButton!.y).toBeLessThan(desktopStripe!.y + 12);

  const viewport = page.viewportSize()!;
  const sendMobileEmail = stripe.getByRole("button", {
    name: "Send email",
    exact: true,
  });
  const checkMobileEmail = stripe.getByRole("button", {
    name: "Check status",
    exact: true,
  });
  const metrics = page.locator(".overview-metrics > .card");
  await expect(metrics).toHaveCount(3);
  const refreshButton = page.getByRole("button", { name: "Refresh workspace" });
  const refreshLabel = refreshButton.getByText("Refresh workspace");
  const refreshIcon = refreshButton.locator("svg");
  await expect(refreshLabel).toBeVisible();
  await expect(refreshIcon).toBeHidden();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 760 });
    await expect(refreshLabel).toBeHidden();
    await expect(refreshIcon).toBeVisible();
    const title = await page
      .getByRole("heading", { name: "Overview", exact: true })
      .boundingBox();
    const refresh = await refreshButton.boundingBox();
    expect(refresh!.width).toBe(44);
    expect(refresh!.height).toBeGreaterThanOrEqual(44);
    const description = await page
      .getByText("Your devices and the information they report, in one place.")
      .boundingBox();
    expect(title!.x + title!.width).toBeLessThan(refresh!.x);
    expect(
      Math.abs(
        title!.y + title!.height / 2 - (refresh!.y + refresh!.height / 2),
      ),
    ).toBeLessThan(1);
    expect(description!.y).toBeGreaterThan(refresh!.y + refresh!.height);
    await expect(stripe.getByText(/to manage workspace access/)).toBeHidden();
    expect((await stripe.boundingBox())!.height).toBeLessThanOrEqual(60);
    const copy = await stripe
      .getByText("Verify your email", { exact: true })
      .boundingBox();
    const send = await sendMobileEmail.boundingBox();
    const check = await checkMobileEmail.boundingBox();
    expect(copy!.height).toBeLessThan(22);
    expect(copy!.x + copy!.width).toBeLessThan(send!.x);
    expect(
      Math.abs(copy!.y + copy!.height / 2 - (send!.y + send!.height / 2)),
    ).toBeLessThan(2);
    expect(send!.y).toBe(check!.y);
    expect(Math.abs(send!.width - check!.width)).toBeLessThan(1);
    expect(send!.height).toBe(check!.height);
    expect(send!.height).toBeGreaterThanOrEqual(44);
    expect(send!.x + send!.width).toBeLessThan(check!.x);
    const [registered, consent, refreshed] = await Promise.all(
      (await metrics.all()).map((card) => card.boundingBox()),
    );
    expect(consent!.y).toBe(registered!.y);
    expect(consent!.x).toBeGreaterThan(registered!.x);
    expect(Math.abs(consent!.width - registered!.width)).toBeLessThan(1);
    expect(refreshed!.y).toBeGreaterThan(registered!.y);
    expect(refreshed!.x).toBe(registered!.x);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  await Promise.all([
    page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === "/api/backend/workspaces",
    ),
    refreshButton.click(),
  ]);
  await sendMobileEmail.click();
  await expect(stripe.getByRole("status")).toHaveText(
    "Verification email requested. Check your inbox.",
  );
  const feedback = await stripe.getByRole("status").boundingBox();
  const send = await sendMobileEmail.boundingBox();
  expect(feedback!.y).toBeGreaterThanOrEqual(send!.y + send!.height);
  await checkMobileEmail.click();
  await expect(stripe.getByRole("status")).toHaveText(
    "Email verification is still pending.",
  );
  await page.setViewportSize(viewport);
  await page
    .getByRole("link", { name: "Settings & privacy", exact: true })
    .click();
  await expect(page.getByText("Unverified", { exact: true })).toBeVisible();
  await openTab(page, "Privacy");
  await page
    .getByText("Review permanent account deletion", { exact: true })
    .click();
  await page
    .getByLabel("Current password for account deletion", { exact: true })
    .fill("disposable-fixture-password-123");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByLabel("I understand account deletion cannot be undone.")
    .check();
  await page
    .getByRole("button", { name: "Permanently delete account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your account has been deleted.", { exact: true }),
  ).toBeVisible();
  expect(
    (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith("netsentry_"),
    ),
  ).toHaveLength(0);
});
test("consent, pause, revocation and erasure are explicit device actions", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Devices", exact: true }).click();
  await page
    .getByRole("button", { name: "View Fixture iOS", exact: true })
    .click();
  await page.getByText("Review monitoring consent", { exact: true }).click();
  await page.getByLabel("Network usage", { exact: true }).check();
  await page
    .getByLabel("I understand and accept this monitoring disclosure.")
    .check();
  await page
    .getByRole("button", { name: "Grant selected consent", exact: true })
    .click();
  await expect(page.getByText(/Consent recorded/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pause monitoring", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Pause monitoring", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause monitoring", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Revoke consent", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete device data", exact: true })
    .click();
  await expect(page.getByText("REVOKED", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No capability report", { exact: true }),
  ).toBeVisible();
});
test("narrow desktop-browser layouts support keyboard navigation and honest future modules", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page.getByRole("link", { name: "More modules", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/more-modules$/);
  await expect(
    page.getByRole("heading", { name: "Network Security", exact: true }),
  ).toBeVisible();
  expect(await page.getByText("Planned", { exact: true }).count()).toBe(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: ".test/narrow-dashboard.png", fullPage: true });
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
});

test("dashboard sections share compact card spacing and action buttons on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const data = await login(page);
  const overviewAction = page.getByRole("button", {
    name: "View device details",
  });
  const actionBackground = await overviewAction.evaluate(
    (button) => getComputedStyle(button).backgroundColor,
  );
  const sections = [
    ["Devices", "Device inventory", "View Fixture iOS"],
    ["Usage & reports", "Usage over time", "Download CSV"],
    ["Alerts", "In-app notifications"],
    ["Networks", "Network labels"],
    ["Developer Tools", "Paired developer computers", "Refresh computers"],
    ["Family", "Your family profiles"],
    ["Subscription", "Subscription and editions", "Start sandbox trial"],
    ["Operations", "Platform operations", "Export redacted diagnostics"],
    ["Team", "Workspace members"],
    ["Settings & privacy", "Your profile"],
    ["More modules", "Network Security"],
    ["Business", "Business organization"],
  ];

  for (const [section, heading, action] of sections) {
    await test.step(section, async () => {
      if (section === "Business") {
        await page
          .getByLabel("Active workspace")
          .selectOption(data.business.workspaceId);
        await expect(page.locator("#dashboard-content .eyebrow")).toContainText(
          "BUSINESS",
        );
      }
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await page.getByRole("link", { name: section, exact: true }).click();
      await page.mouse.move(2, 2);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      const main = page.getByRole("main");
      const hasRefreshHeader = section === "Developer Tools";
      const cardHeader = main.locator(".card-heading").filter({
        has: page.getByRole("heading", { name: heading, exact: true }),
      });
      await expect(cardHeader).toHaveCSS("margin-bottom", "12px");
      await expect(cardHeader).toHaveCSS("border-bottom-width", "1px");
      for (const width of hasRefreshHeader ? [1280, 320, 390] : [320, 390]) {
        await page.setViewportSize({ width, height: 760 });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBe(width);
        if (action) {
          const button = main
            .getByRole("button", { name: action, exact: true })
            .first();
          if (width <= 650)
            await expect(button).toHaveCSS(
              "background-color",
              actionBackground,
            );
          await expect
            .poll(() => button.evaluate((element) => element.offsetHeight))
            .toBeGreaterThanOrEqual(44);
          if (hasRefreshHeader) {
            await expect
              .poll(() =>
                cardHeader.evaluate((header) => {
                  const title = header
                    .querySelector("h2")!
                    .getBoundingClientRect();
                  const action = header
                    .querySelector("button")!
                    .getBoundingClientRect();
                  const inset = parseFloat(
                    getComputedStyle(header).paddingRight,
                  );
                  const rightEdge =
                    header.getBoundingClientRect().right - inset;
                  return (
                    action.left > title.right &&
                    Math.abs(action.right - rightEdge) < 1 &&
                    Math.abs(
                      action.top +
                        action.height / 2 -
                        title.top -
                        title.height / 2,
                    ) < 1
                  );
                }),
              )
              .toBe(true);
          }
        }
      }
    });
  }
});

test("mobile workflow tabs deep-link within the same dashboard layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await login(page);
  await page.goto("/app/alerts");
  const alertTabs = page.getByRole("navigation", { name: "Alerts sections" });
  await expect(
    alertTabs.getByRole("link", { name: "Notifications" }),
  ).toHaveAttribute("aria-current", "page");
  const tabWidths = await alertTabs.evaluate((element) => ({
    total: element.scrollWidth,
    visible: element.clientWidth,
  }));
  expect(tabWidths.total).toBe(tabWidths.visible);
  await openTab(page, "Preferences");
  await expect(
    page.getByRole("heading", { name: "Notification preferences" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "In-app notifications" }),
  ).toHaveCount(0);
  await expect(page).toHaveURL("/app/alerts/preferences");
  await page.reload();
  await expect(
    alertTabs.getByRole("link", { name: "Preferences" }),
  ).toHaveAttribute("aria-current", "page");

  for (const [path, tabLabel, heading] of [
    ["developer-tools/sharing", "Sharing", "Service-sharing disclosure"],
    ["family/sharing", "Sharing", "Family-sharing disclosure"],
    ["operations/audit", "Audit", "Operator audit review"],
    ["settings/sessions", "Sessions", "Account sessions"],
  ]) {
    await page.goto(`/app/${path}`);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: / sections$/ })
        .getByRole("link", { name: tabLabel, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(320);
  }
});

test("signing out or changing accounts clears other tabs instead of mixing user data", async ({
  page,
  context,
}) => {
  const data = await login(page);
  const other = await context.newPage();
  await other.goto("/app");
  await expect(
    other.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  // Hold an already-authorized profile response until the other tab signs out.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received!: () => void;
  const receivedResponse = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page
    .getByRole("link", { name: "Settings & privacy", exact: true })
    .click();
  await page.route("**/api/backend/auth/me", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    received();
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Delayed fixture profile");
  await page
    .getByRole("button", { name: "Update profile", exact: true })
    .click();
  await receivedResponse;
  await other.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await other.getByLabel("Email address").fill(data.accounts.viewer.email);
  await other.getByLabel("Password", { exact: true }).fill(data.password);
  await other.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".sidebar-profile")).toContainText(
    data.accounts.viewer.email,
  );
  await page
    .getByRole("link", { name: "Usage & reports", exact: true })
    .click();
  await expect(
    page.getByText("No observations in this period", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("10,485,760 bytes", { exact: true })).toHaveCount(
    0,
  );
});

test("the session boundary rejects stale actor mutations and oversized bodies", async ({
  page,
}) => {
  const data = await login(page);
  const before = await (await page.request.get("/api/backend/auth/me")).json();
  const wrong = await page.request.patch("/api/backend/auth/me", {
    headers: {
      origin: "http://127.0.0.1:54111",
      "x-netsentry-user": data.accounts.viewer.id,
    },
    data: { displayName: "Must not be applied" },
  });
  expect(wrong.status()).toBe(409);
  expect((await wrong.json()).code).toBe("SESSION_CHANGED");
  expect(
    (await (await page.request.get("/api/backend/auth/me")).json()).displayName,
  ).toBe(before.displayName);
  const oversized = await page.request.post("/api/backend/auth/login", {
    headers: { origin: "http://127.0.0.1:54111" },
    data: { email: "x".repeat(70000), password: "fixture" },
  });
  expect(oversized.status()).toBe(413);
});

test("developer commands show pending/cancelled outcomes and keep viewers read-only", async ({
  page,
  browser,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Developer Tools", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Paired developer computers" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture remote project · Node.js", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request graceful stop", exact: true })
    .click();
  await page.getByLabel("I confirm this exact target and action").check();
  await page
    .getByRole("button", { name: "Confirm remote command", exact: true })
    .click();
  await expect(
    page.getByText("Command pending.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close confirmation" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel command", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel command", exact: true })
    .click();
  await expect(
    page.getByText("cancelled · cancelled", { exact: false }).first(),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("heading", { name: "Paired developer computers" })
    .scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
  await page.screenshot({ path: ".test/developer-remote.png", fullPage: true });
  const viewer = await browser.newContext();
  const tab = await viewer.newPage();
  try {
    await login(tab, "viewer");
    await tab
      .getByRole("link", { name: "Developer Tools", exact: true })
      .click();
    await expect(
      tab.getByText("Fixture remote project · Node.js", { exact: true }),
    ).toBeVisible();
    await expect(
      tab.getByRole("button", { name: "Request graceful stop", exact: true }),
    ).toBeDisabled();
    await expect(
      tab.getByRole("button", { name: "Request force-stop", exact: true }),
    ).toBeDisabled();
    await expect(
      tab.getByText("Sharing and controller grants", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await viewer.close();
  }
});

test("missing-report rules preserve their device scope and seconds threshold", async ({
  page,
}) => {
  const data = await login(page);
  await page.getByRole("link", { name: "Alerts", exact: true }).click();
  await openTab(page, "Rules");
  await page.getByRole("button", { name: "Create rule", exact: true }).click();
  await page.getByLabel("Rule type").selectOption("not_reporting");
  await page.getByLabel("Rule device").selectOption(data.deviceId);
  await page.getByLabel("Reporting/heartbeat threshold (seconds)").fill("600");
  await page
    .getByRole("button", { name: "Create alert rule", exact: true })
    .click();
  await expect(page.getByText(/Rule saved/)).toBeVisible();
  const rule = page.getByRole("listitem").filter({ hasText: "not reporting" });
  await expect(rule).toBeVisible();
  await rule.getByRole("button", { name: "Edit rule", exact: true }).click();
  await expect(page.getByLabel("Rule type")).toHaveValue("not_reporting");
  await expect(page.getByLabel("Rule device")).toHaveValue(data.deviceId);
  await expect(
    page.getByLabel("Reporting/heartbeat threshold (seconds)"),
  ).toHaveValue("600");
});

test("network inventory exposes uncertain observations and editable labels without enforcement", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Networks", exact: true }).click();
  await openTab(page, "Monitoring");
  await expect(
    page.getByRole("heading", { name: "Observed devices", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("fixture0: 192.168.40.20/24", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "WAN interface state does not prove internet reachability.",
      { exact: false },
    ),
  ).toBeVisible();
  const endpoint = page.locator("details").filter({
    has: page.locator("summary").filter({ hasText: "02:00:00:40:00:01" }),
  });
  await endpoint.locator("summary").click();
  await endpoint
    .getByLabel("Device label", { exact: true })
    .fill("Browser synthetic workstation");
  await endpoint.getByLabel("Trust label").selectOption("blocked_label");
  await endpoint
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByText("Inventory labels saved.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Browser synthetic workstation · recently observed · blocked_label",
      { exact: false },
    ),
  ).toBeVisible();
  await page
    .getByText("Configure read-only OpenWrt ubus connection", { exact: true })
    .click();
  await expect(
    page.getByLabel("Router password", { exact: true }),
  ).toHaveAttribute("type", "password");
  await expect(
    page.getByRole("button", { name: "Request connection test", exact: true }),
  ).toHaveCount(0);
});
test("network viewers cannot grant collectors or configure router secrets", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.getByRole("link", { name: "Networks", exact: true }).click();
  await openTab(page, "Monitoring");
  await expect(
    page.getByRole("heading", { name: "Observed devices", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assign collector", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Router password", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Trust label")).toHaveCount(0);
});

test("child time requests require an assigned guardian decision and never claim applied restrictions", async ({
  page,
  browser,
}) => {
  const data = await login(page, "child");
  await page.getByRole("link", { name: "Family", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic family child · family overview",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save requested policy", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Requested minutes", { exact: true }).fill("20");
  await page
    .getByLabel("Reason for time request", { exact: true })
    .fill("Browser fixture homework");
  await page
    .getByRole("button", { name: "Request more time", exact: true })
    .click();
  await expect(
    page.getByText("Request recorded for an authorized guardian.", {
      exact: true,
    }),
  ).toBeVisible();
  const guardianContext = await browser.newContext();
  const guardian = await guardianContext.newPage();
  await login(guardian, "guardian");
  await guardian.getByRole("link", { name: "Family", exact: true }).click();
  const item = guardian
    .getByRole("listitem")
    .filter({ hasText: "Browser fixture homework" });
  await expect(item).toContainText("pending");
  await item
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(item).toContainText("approved");
  await guardianContext.close();
  await page
    .getByRole("button", { name: "Refresh child profile", exact: true })
    .click();
  await expect(page.getByText("overridden", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Current Android consumer usage access and the read-only router adapter cannot enforce",
      { exact: false },
    ),
  ).toBeVisible();
  expect(data.familyProfileId).toBeTruthy();
});
test("family viewers cannot see child profiles and policy edits require explicit consent", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.getByRole("link", { name: "Family", exact: true }).click();
  await expect(
    page.getByText("No child profiles in your current grant", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Weekly wellbeing observations",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await login(page, "owner");
  await page.getByRole("link", { name: "Family", exact: true }).click();
  const policy = page.locator("section.card").filter({
    has: page.getByRole("heading", { name: "Family policy", exact: true }),
  });
  await policy
    .getByLabel("Daily observed screen-time allowance (minutes)", {
      exact: true,
    })
    .fill("120");
  await policy
    .getByRole("checkbox", {
      name: "I accept the family-sharing disclosure and have authority for this change.",
      exact: true,
    })
    .check();
  await policy
    .getByRole("button", { name: "Save requested policy", exact: true })
    .click();
  await expect(page.getByText(/Revision 2 · timezone/)).toBeVisible();
});

test("Business roles review organization structure and employees explicitly accept sharing", async ({
  page,
  browser,
}) => {
  const data = await login(page);
  await page
    .getByLabel("Active workspace")
    .selectOption(data.business.workspaceId);
  await page.getByRole("link", { name: "Business", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Business organization", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("strong").filter({ hasText: /^Fixture office$/ }),
  ).toBeVisible();
  await page.getByLabel("New location name").fill("Browser Business location");
  await page.getByRole("button", { name: "Add location", exact: true }).click();
  await expect(
    page.locator("strong").filter({ hasText: /^Browser Business location$/ }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "Network device departments", exact: true })
    .scrollIntoViewIfNeeded();
  const observed = page.locator(".row").filter({
    has: page
      .locator("strong")
      .filter({ hasText: /^Synthetic office printer$/ }),
  });
  await observed
    .getByLabel("Department", { exact: true })
    .selectOption(data.business.departmentId);
  await observed
    .getByRole("button", {
      name: "Assign network device department",
      exact: true,
    })
    .click();
  await expect(
    observed.getByText(/Synthetic business LAN · Fixture engineering/),
  ).toBeVisible();
  const location = page.getByRole("combobox", {
    name: "Business location",
    exact: true,
  });
  const [locationId] = await location.selectOption({ label: "Fixture office" });
  await openTab(page, "Reports");
  await expect(
    page.getByRole("heading", { name: "Organization usage reports" }),
  ).toBeVisible();
  await expect(location).toHaveValue(locationId);
  await page
    .getByRole("button", { name: "Load organization report", exact: true })
    .click();
  await expect(
    page.getByText("No consented organization observations", { exact: true }),
  ).toBeVisible();
  const employeeContext = await browser.newContext();
  const employee = await employeeContext.newPage();
  await employee.goto("/app");
  await employee.getByLabel("Email address").fill(data.accounts.employee.email);
  await employee.getByLabel("Password", { exact: true }).fill(data.password);
  await employee.getByRole("button", { name: "Sign in", exact: true }).click();
  await employee
    .getByLabel("Active workspace")
    .selectOption(data.business.workspaceId);
  await employee.getByRole("link", { name: "Business", exact: true }).click();
  await expect(
    employee.getByRole("button", { name: "Add location", exact: true }),
  ).toHaveCount(0);
  await openTab(employee, "Reports");
  await expect(
    employee.getByRole("heading", {
      name: "Organization usage reports",
      exact: true,
    }),
  ).toHaveCount(0);
  await openTab(employee, "People");
  employee.once("dialog", (dialog) => dialog.accept());
  await employee
    .getByRole("button", { name: "Accept organization sharing", exact: true })
    .click();
  await expect(
    employee.getByText(/Sharing accepted; reports from/),
  ).toBeVisible();
  employee.once("dialog", (dialog) => dialog.accept());
  await employee
    .getByRole("button", { name: "Withdraw device sharing", exact: true })
    .click();
  await expect(
    employee.getByText("No visible employee assignment", { exact: false }),
  ).toBeVisible();
  await employeeContext.close();
  const analystContext = await browser.newContext();
  const analyst = await analystContext.newPage();
  await analyst.goto("/app");
  await analyst
    .getByLabel("Email address")
    .fill(data.accounts.businessAnalyst.email);
  await analyst.getByLabel("Password", { exact: true }).fill(data.password);
  await analyst.getByRole("button", { name: "Sign in", exact: true }).click();
  await analyst
    .getByLabel("Active workspace")
    .selectOption(data.business.workspaceId);
  await analyst.getByRole("link", { name: "Business", exact: true }).click();
  await openTab(analyst, "Reports");
  await expect(
    analyst.getByRole("heading", {
      name: "Organization usage reports",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    analyst.getByRole("button", { name: "Add location", exact: true }),
  ).toHaveCount(0);
  await analystContext.close();
});

test("sandbox billing is owner-only and operator flags require separate authority", async ({
  page,
  browser,
}) => {
  const data = await login(page);
  await page.getByRole("link", { name: "Subscription", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Subscription and editions",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Provider-neutral sandbox: no real charge/),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Start sandbox trial", exact: true })
    .click();
  await expect(
    page.getByText(/Edition: family · status: trialing/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prepare sandbox plan change", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Simulate sandbox payment", exact: true })
    .click();
  await expect(
    page.getByText(/Edition: family · status: active/),
  ).toBeVisible();
  await openTab(page, "Payment history");
  await expect(page.getByText(/TST test minor units/)).toBeVisible();
  await page.getByRole("link", { name: "Operations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Platform operations", exact: true }),
  ).toBeVisible();
  await openTab(page, "Administration");
  await page
    .getByLabel("Feature key", { exact: true })
    .selectOption("developer");
  await page
    .getByLabel("Confirm operator password", { exact: true })
    .first()
    .fill(data.password);
  await page
    .getByRole("button", { name: "Save feature setting", exact: true })
    .click();
  await expect(
    page.getByText(/developer · Disabled · revision 1/),
  ).toBeVisible();
  const context = await browser.newContext();
  const viewer = await context.newPage();
  await login(viewer, "viewer");
  await viewer.getByRole("link", { name: "Subscription", exact: true }).click();
  await expect(
    viewer.getByRole("heading", {
      name: "Subscription and editions",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    viewer.getByRole("button", { name: "Start sandbox trial", exact: true }),
  ).toHaveCount(0);
  await viewer.getByRole("link", { name: "Operations", exact: true }).click();
  await expect(
    viewer.getByText(/Workspace ownership does not grant/),
  ).toBeVisible();
  await context.close();
});

// Opt-in records intent only. This increment contains no active email transport.
test("email alert opt-in stays visibly disabled and saved themes follow account preference", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("link", { name: "Settings & privacy", exact: true })
    .click();
  await page.getByText("Dark", { exact: true }).click();
  await page
    .getByRole("button", { name: "Save display preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openTab(page, "Notifications");
  await page.getByLabel("Opt in to email alerts (delivery disabled)").check();
  await page
    .getByRole("button", { name: "Save notification preferences", exact: true })
    .click();
  await page.reload();
  await expect(page).toHaveURL("/app/settings/notifications");
  await expect(
    page.getByLabel("Opt in to email alerts (delivery disabled)"),
  ).toBeChecked();
  await expect(
    page.getByText(
      "Email alert delivery is disabled. Saving preferences sends no email.",
    ),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Opt in to email alerts (delivery disabled)").uncheck();
  await page
    .getByRole("button", { name: "Save notification preferences", exact: true })
    .click();
});
