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

test("team invitations bind a recipient and management changes take effect", async ({
  page,
  browser,
}) => {
  const data = await login(page);
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Workspace members", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Recipient email").fill(data.accounts.recovery.email);
  await page.getByLabel("Invitation role").selectOption("MEMBER");
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const token = await page.getByTestId("invitation-token").innerText();
  const recipient = await browser.newContext();
  const guest = await recipient.newPage();
  await guest.goto("/");
  await guest.getByLabel("Email address").fill(data.accounts.recovery.email);
  await guest.getByLabel("Password", { exact: true }).fill(data.password);
  await guest.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  await guest.getByRole("button", { name: "Team", exact: true }).click();
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
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Team", exact: true }).click();
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
  await page.getByRole("button", { name: "Team", exact: true }).click();
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
    .getByRole("button", { name: "Settings & privacy", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your profile", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Fixture owner updated");
  await page
    .getByRole("button", { name: "Update profile", exact: true })
    .click();
  await expect(page.locator(".sidebar-profile")).toContainText(
    "Fixture owner updated",
  );
  await page.getByLabel("Color theme").selectOption("DARK");
  await page.getByLabel("Reduce motion", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save display preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Settings & privacy", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
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
  await page.getByLabel("Current password for export").fill(data.password);
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
  await page
    .getByText("Review permanent account deletion", { exact: true })
    .click();
  await page
    .getByLabel("Current password for account deletion")
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
}) => {
  const data = await fixtures();
  await page.goto("/verify-email#token=" + data.tokens.unverified);
  await expect(page.getByLabel("Verification code")).toHaveValue(
    data.tokens.unverified,
  );
  expect(page.url()).not.toContain(data.tokens.unverified);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(
    page.getByText(/Email verified. You can now sign in/),
  ).toBeVisible();
  await page.goto("/reset-password#token=" + data.tokens.recovery);
  await expect(page.getByLabel("Reset code")).toHaveValue(data.tokens.recovery);
  expect(page.url()).not.toContain(data.tokens.recovery);
  await page
    .getByLabel("Password", { exact: true })
    .fill("new-fixture-recovery-password-123");
  await page
    .getByLabel("Confirm new password")
    .fill("new-fixture-recovery-password-123");
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
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Disposable browser fixture");
  await page
    .getByLabel("Email address")
    .fill("disposable@dashboard.example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("disposable-fixture-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your devices", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Verify your email to manage/)).toBeVisible();
  await page
    .getByRole("button", { name: "Settings & privacy", exact: true })
    .click();
  await page
    .getByText("Review permanent account deletion", { exact: true })
    .click();
  await page
    .getByLabel("Current password for account deletion")
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
  await page.getByRole("button", { name: "Devices", exact: true }).click();
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
  await page.getByRole("button", { name: "More modules", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Developer Tools", exact: true }),
  ).toBeVisible();
  expect(await page.getByText("Planned", { exact: true }).count()).toBe(9);
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

test("signing out or changing accounts clears other tabs instead of mixing user data", async ({
  page,
  context,
}) => {
  const data = await login(page);
  const other = await context.newPage();
  await other.goto("/");
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
    .getByRole("button", { name: "Settings & privacy", exact: true })
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
    .getByRole("button", { name: "Usage & reports", exact: true })
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
