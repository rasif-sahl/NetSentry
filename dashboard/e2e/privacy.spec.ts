import { test, expect } from "@playwright/test";

const ids = [
  "overview",
  "information",
  "use",
  "sharing",
  "permissions",
  "retention",
  "security",
  "cookies",
  "choices",
  "updates",
];

test("Privacy Policy is reachable from public footers and remains an explicit draft", async ({
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
  ]) {
    await page.goto(path);
    await page
      .locator("footer")
      .getByRole("link", { name: "Privacy Policy", exact: true })
      .click();
    await expect(page).toHaveURL("/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Privacy Policy",
    );
  }
  await expect(page).toHaveTitle("NetSentry — Privacy Policy (Draft)");
  await expect(
    page.getByText("Draft for review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Effective date to be confirmed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/This preview shows the proposed structure/),
  ).toContainText(
    "must be confirmed before publication as an effective policy",
  );
  await expect(
    page
      .getByRole("article", { name: "Draft privacy policy" })
      .locator(":scope > section"),
  ).toHaveCount(10);
  await expect(page.locator("#privacy-updates")).toContainText(
    "The current Contact page is a non-sending form preview.",
  );
  await page
    .getByRole("link", { name: "Review your choices", exact: true })
    .click();
  await expect(page).toHaveURL("/docs/privacy");
  expect(api).toEqual([]);
  expect(errors).toEqual([]);
});

test("Policy contents select unique sections, handle deep links and preserve cached-route anchors", async ({
  page,
}) => {
  await page.goto("/privacy");
  const contents = page.getByRole("navigation", {
    name: "Policy contents",
    exact: true,
  });
  for (const id of ids) {
    const link = contents.locator(`a[href="#privacy-${id}"]`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#privacy-${id}$`));
    await expect(link).toHaveAttribute("aria-current", "location");
    await expect(contents.locator('[aria-current="location"]')).toHaveCount(1);
    await expect(page.locator(`#privacy-${id}`)).toBeInViewport();
  }
  await contents.locator('a[href="#privacy-information"]').click();
  await expect
    .poll(() =>
      page
        .locator("#privacy-information")
        .evaluate((el) => Math.abs(el.getBoundingClientRect().top)),
    )
    .toBeLessThan(150);
  await page.reload();
  await expect(
    contents.locator('a[href="#privacy-information"]'),
  ).toHaveAttribute("aria-current", "location");
  await contents.locator('a[href="#privacy-security"]').click();
  await page.goBack();
  await expect(
    contents.locator('a[href="#privacy-information"]'),
  ).toHaveAttribute("aria-current", "location");
  await page.getByRole("link", { name: "Back to top", exact: true }).click();
  await expect(page).toHaveURL(/#privacy-top$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Contact", exact: true })
    .click();
  await expect(page).toHaveURL("/contact");
  await page
    .locator("footer")
    .getByRole("link", { name: "Privacy Policy", exact: true })
    .click();
  await expect(page).toHaveURL("/privacy");
  await page
    .getByRole("link", { name: "Your privacy choices", exact: true })
    .click();
  await expect(page.locator("#privacy-choices")).toBeInViewport();
  for (const anchor of await page.locator('a[href^="#"]').all())
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
});

test("Policy mobile contents support keyboard navigation, narrow layouts and no JavaScript", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/privacy");
  const summary = page.locator("details summary").filter({ visible: true });
  const contents = page.getByRole("navigation", {
    name: "Mobile policy contents",
    exact: true,
  });
  await expect(contents).not.toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(contents).toBeVisible();
  await contents.locator('a[href="#privacy-sharing"]').click();
  await expect(page.locator("#privacy-sharing")).toBeInViewport();
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
    await nojs.goto("/privacy#privacy-information");
    await expect(nojs.locator("#privacy-information")).toBeInViewport();
    await nojs.locator("summary").click();
    await nojs
      .getByRole("navigation", { name: "Mobile policy contents", exact: true })
      .locator('a[href="#privacy-cookies"]')
      .click();
    await expect(nojs.locator("#privacy-cookies")).toBeInViewport();
    await nojs
      .getByRole("link", { name: "Review your choices", exact: true })
      .click();
    await expect(nojs).toHaveURL("/docs/privacy");
  } finally {
    await context.close();
  }
});
