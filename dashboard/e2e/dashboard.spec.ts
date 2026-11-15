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
