import { test, expect } from "@playwright/test";

test("homepage opens the product overview with useful sections and no account requests", async ({
  page,
}) => {
  const accountRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend"))
      accountRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Product", exact: true })
    .click();
  await expect(page).toHaveURL(/\/product$/);
  await expect(page).toHaveTitle("NetSentry — Product overview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A clearer view of your devices.More context for every decision.",
  );
  await expect(
    page.getByRole("link", { name: "Product", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  for (const id of [
    "features",
    "devices",
    "reports",
    "sharing",
    "developer",
    "applications",
    "how-it-fits",
    "privacy",
  ]) {
    await expect(page.locator(`#product-${id}`)).toBeAttached();
  }
  const product = page.locator("#product-main");
  await product.locator("summary").click();
  await expect(
    product.getByText(/iOS does not generally expose device-wide/),
  ).toBeVisible();
  await expect(
    product.getByText(
      /Native build, signing and physical-device validation remain pending/,
    ),
  ).toBeVisible();
  expect(accountRequests).toEqual([]);
  expect(errors).toEqual([]);
  await page
    .getByRole("link", { name: "Back to the home page", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your devices tell a story.",
  );
});

test("feature tabs support pointer, keyboard, wrapping and linked sections", async ({
  page,
}) => {
  await page.goto("/product");
  const tabs = page.getByRole("tablist", { name: "Explore product features" });
  await tabs.getByRole("tab", { name: "Developer tools", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "id",
    "panel-developer",
  );
  await expect(page.getByRole("tabpanel")).toContainText(
    "Make sense of the services on your computer.",
  );
  await page.keyboard.press("ArrowRight");
  await expect(
    tabs.getByRole("tab", { name: "Your devices", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(
    tabs.getByRole("tab", { name: "Developer tools", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "id",
    "panel-devices",
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "id",
    "panel-developer",
  );
  for (const [label, panel] of [
    ["Usage & reports", "reports"],
    ["Family & teams", "sharing"],
    ["Your devices", "devices"],
  ]) {
    await tabs.getByRole("tab", { name: label, exact: true }).click();
    const tab = tabs.getByRole("tab", { name: label, exact: true });
    await expect(tab).toHaveAttribute("tabindex", "0");
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      `tab-${panel}`,
    );
  }
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel")).toBeFocused();
  await page
    .getByRole("tabpanel")
    .getByRole("link", { name: "Explore this feature" })
    .click();
  await expect(page).toHaveURL(/#product-devices$/);
});

test("product layout keeps upright previews and usable navigation across screen widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/product");
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Product", exact: true })
    .click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("link", { name: "Privacy & choice", exact: true })
    .click();
  await expect(page).toHaveURL(/#product-privacy$/);
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  await page.locator("main img").evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (image) => {
        (image as HTMLImageElement).loading = "eager";
        await (image as HTMLImageElement).decode();
      }),
    );
  });
  expect(
    await page
      .locator("main img")
      .evaluateAll((images) =>
        images.every((image) => getComputedStyle(image).transform === "none"),
      ),
  ).toBe(true);
  for (const anchor of await page.locator('a[href^="#"]').all()) {
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
  }
  for (const link of await page.getByRole("link").all()) {
    expect(await link.textContent()).not.toMatch(/[↗↑↓]/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("public section descriptions and feature tabs stay readable across screen widths", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/product");

  const description = page.getByText(
    /^Different questions need different tools\./,
  );
  const familyTab = page.getByRole("tab", { name: "Family & teams" });
  await expect(description).toHaveCSS("font-size", "15px");
  await expect(description).toHaveCSS("color", "rgb(85, 73, 94)");
  await expect(familyTab).toHaveCSS("font-size", "14px");
  await expect(familyTab).toHaveCSS("color", "rgb(79, 59, 89)");
  await familyTab.click();
  await expect(familyTab).toHaveAttribute("aria-selected", "true");
  await expect(familyTab).toHaveCSS("color", "rgb(66, 38, 81)");

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(description).toHaveCSS("font-size", "16px");
  await expect(familyTab).toHaveCSS("font-size", "16px");

  for (const [route, selector, fontSize] of [
    ["/solutions", "#solutions-personal p.text-marketing-copy", "16px"],
    ["/applications", "#applications-web p.text-marketing-copy", "16px"],
    ["/pricing", "#pricing-comparison-note", "16px"],
    ["/docs/workspace", "#docs-article-workspace section p", "16px"],
    ["/privacy", "#privacy-main article section p", "16px"],
    ["/terms", "#terms-main article section p", "16px"],
  ] as const) {
    await test.step(route, async () => {
      await page.goto(route);
      const text = page.locator(selector).first();
      await expect(text).toHaveCSS("font-size", fontSize);
      await expect(text).toHaveCSS("color", "rgb(85, 73, 94)");
    });
  }
});
