import { test, expect } from "@playwright/test";

test("Pricing is linked from the public pages and explains proposed editions without billing requests", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (/\/api\//.test(request.url())) apiRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Pricing", exact: true }).click();
  await expect(page).toHaveURL("/pricing");
  await expect(page).toHaveTitle("NetSentry — Pricing");
  await expect(
    nav.getByRole("link", { name: "Pricing", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little more clarity.A plan that fits your day.",
  );
  await expect(page.locator("#pricing-plans article")).toHaveCount(4);
  for (const name of [
    "Personal Free",
    "Personal Premium",
    "Family",
    "Business",
  ]) {
    await expect(
      page
        .locator("#pricing-plans")
        .getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByText("In development · Launch pricing coming soon"),
  ).toBeVisible();
  await expect(
    page.getByText(/Proposed editions\. Prices, limits/),
  ).toContainText("Paid purchases are not available yet.");
  for (const link of await page.locator("#pricing-plans a").all()) {
    await link.click();
    await expect(page).toHaveURL(/#pricing-compare$/);
    await expect
      .poll(() =>
        page
          .locator("#pricing-compare")
          .evaluate((el) => el.getBoundingClientRect().top),
      )
      .toBeLessThan(150);
  }
  await page
    .getByRole("link", { name: "Review the plans", exact: true })
    .click();
  await expect(page).toHaveURL(/#pricing-plans$/);
  await page.getByRole("link", { name: "Read the FAQs", exact: true }).click();
  await expect(page).toHaveURL(/#pricing-questions$/);
  for (const route of ["/product", "/applications", "/solutions"]) {
    await page.goto(route);
    await nav.getByRole("link", { name: "Pricing", exact: true }).click();
    await expect(page).toHaveURL("/pricing");
  }
  await page.goto("/docs");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Pricing", exact: true })
    .click();
  await expect(page).toHaveURL("/pricing");
  await nav.getByRole("link", { name: "Documentation", exact: true }).click();
  await expect(page).toHaveURL("/docs");
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("Pricing FAQs work with a keyboard and mobile comparison stays within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");
  const summaries = page.locator("#pricing-questions summary");
  await expect(
    page.locator("#pricing-questions details").first(),
  ).toHaveAttribute("open", "");
  await summaries.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Monthly and annual options are planned/),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByText(/Monthly and annual options are planned/),
  ).not.toBeVisible();
  await summaries.nth(3).click();
  await expect(
    page.getByText(
      /No\. Membership and billing do not grant collection permissions/,
    ),
  ).toBeVisible();
  const region = page.getByRole("region", { name: "Edition comparison" });
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => region.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  await expect(region.locator('th[scope="col"]')).toHaveCount(5);
  await expect(region.locator('tbody th[scope="row"]')).toHaveCount(7);
  for (const width of [360, 390, 600, 768, 800, 961, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Pricing overflow at ${width}`,
    ).toBe(true);
    await page.goto("/docs");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Docs overflow at ${width}`,
    ).toBe(true);
    await page.goto("/pricing");
  }
  for (const anchor of await page.locator('a[href^="#"]').all())
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
  for (const control of await page.locator("a,button").all())
    expect(await control.textContent()).not.toMatch(/[↗↑↓]/);
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Close navigation", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Product", exact: true })
    .click();
  await expect(page).toHaveURL("/product");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});
