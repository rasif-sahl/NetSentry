import { test, expect } from "@playwright/test";

const ids = [
  "overview",
  "eligibility",
  "authority",
  "use",
  "availability",
  "billing",
  "ownership",
  "privacy",
  "third-party",
  "ending",
  "liability",
  "updates",
];

test("Terms and Conditions is reachable from public footers and remains an explicit draft", async ({
  page,
}) => {
  const api: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) api.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/",
    "/product",
    "/applications",
    "/solutions",
    "/pricing",
    "/contact",
    "/docs",
    "/privacy",
  ]) {
    await page.goto(path);
    await page
      .locator("footer")
      .getByRole("link", { name: "Terms and Conditions", exact: true })
      .click();
    await expect(page).toHaveURL("/terms");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Terms and Conditions",
    );
  }
  await expect(page).toHaveTitle("NetSentry — Terms and Conditions (Draft)");
  await expect(
    page.locator("#terms-main").getByText("Draft for review", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#terms-main")
      .getByText("Effective date to be confirmed", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#terms-main")
      .getByText(/This preview shows the proposed structure/),
  ).toContainText("must be confirmed before these terms become effective");
  await expect(
    page
      .getByRole("article", { name: "Draft terms and conditions" })
      .locator(":scope > section"),
  ).toHaveCount(12);
  await expect(page.locator("#terms-updates")).toContainText(
    "The current Contact page is a non-sending form preview.",
  );
  await expect(page.locator("#terms-overview")).toContainText(
    "This preview does not record agreement or acceptance.",
  );
  await expect(page.locator("#terms-billing")).toContainText(
    "Paid purchases are not currently available",
  );
  await page
    .getByRole("link", {
      name: "Review permissions and authority",
      exact: true,
    })
    .click();
  await expect(page.locator("#terms-authority")).toBeInViewport();
  await page
    .getByRole("navigation", { name: "Terms footer", exact: true })
    .getByRole("link", { name: "Privacy Policy", exact: true })
    .click();
  await expect(page).toHaveURL("/privacy");
  expect(api).toEqual([]);
  expect(errors).toEqual([]);
});

test("Terms contents select unique sections, handle deep links and preserve cached-route anchors", async ({
  page,
}) => {
  await page.goto("/terms");
  const contents = page.getByRole("navigation", {
    name: "Terms contents",
    exact: true,
  });
  for (const id of ids) {
    const link = contents.locator(`a[href="#terms-${id}"]`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#terms-${id}$`));
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(contents.locator('[aria-current="location"]')).toHaveCount(1);
    await expect(page.locator(`#terms-${id}`)).toBeInViewport();
  }
  await contents.locator('a[href="#terms-eligibility"]').click();
  await expect
    .poll(() =>
      page
        .locator("#terms-eligibility")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(150);
  await page.reload();
  await expect(
    contents.locator('a[href="#terms-eligibility"]'),
  ).toHaveAttribute("aria-current", "location");
  await contents.locator('a[href="#terms-liability"]').click();
  await page.goBack();
  await expect(
    contents.locator('a[href="#terms-eligibility"]'),
  ).toHaveAttribute("aria-current", "location");
  await page.getByRole("link", { name: "Back to top", exact: true }).click();
  await expect(page).toHaveURL(/#terms-top$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Contact", exact: true })
    .click();
  await expect(page).toHaveURL("/contact");
  await page
    .locator("footer")
    .getByRole("link", { name: "Terms and Conditions", exact: true })
    .click();
  await expect(page).toHaveURL("/terms");
  await page.getByRole("link", { name: "Read the terms", exact: true }).click();
  await expect(page.locator("#terms-overview")).toBeInViewport();
  for (const anchor of await page.locator('a[href^="#"]').all())
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
});

test("Terms mobile contents support keyboard navigation, narrow layouts and no JavaScript", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/terms");
  const summary = page.locator("details summary").filter({ visible: true });
  const contents = page.getByRole("navigation", {
    name: "Mobile terms contents",
    exact: true,
  });
  await expect(contents).not.toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(contents).toBeVisible();
  await contents.locator('a[href="#terms-authority"]').click();
  await expect(page.locator("#terms-authority")).toBeInViewport();
  for (const width of [320, 360, 390, 650, 651, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Documentation", exact: true })
    .click();
  await expect(page).toHaveURL("/docs");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const nojs = await context.newPage();
    await nojs.goto("/terms#terms-eligibility");
    await expect(nojs.locator("#terms-eligibility")).toBeInViewport();
    await nojs.locator("summary").click();
    await nojs
      .getByRole("navigation", { name: "Mobile terms contents", exact: true })
      .locator('a[href="#terms-billing"]')
      .click();
    await expect(nojs.locator("#terms-billing")).toBeInViewport();
    await nojs
      .getByRole("link", {
        name: "Review permissions and authority",
        exact: true,
      })
      .click();
    await expect(nojs.locator("#terms-authority")).toBeInViewport();
    await nojs
      .getByRole("navigation", { name: "Terms footer", exact: true })
      .getByRole("link", { name: "Privacy Policy", exact: true })
      .click();
    await expect(nojs).toHaveURL("/privacy");
  } finally {
    await context.close();
  }
});
