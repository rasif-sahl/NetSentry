import { test, expect } from "@playwright/test";

test("public pages lead to the Applications guide without account API calls", async ({
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
    .getByRole("link", { name: "Our apps", exact: true })
    .click();
  await expect(page).toHaveURL("/applications");
  await expect(page).toHaveTitle("NetSentry — Applications");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One workspace.The right app for your day.",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Applications", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  for (const id of [
    "choose",
    "web",
    "android",
    "ios",
    "desktop",
    "compare",
    "setup",
    "availability",
  ]) {
    await expect(page.locator(`#applications-${id}`)).toHaveCount(1);
  }
  await page
    .locator('#applications-choose a[href="#applications-web"]')
    .click();
  await expect(page).toHaveURL(/#applications-web$/);
  await expect
    .poll(() =>
      page
        .locator("#applications-web")
        .evaluate((element) => Math.abs(element.getBoundingClientRect().top)),
    )
    .toBeLessThan(150);
  await page
    .getByRole("link", { name: "Explore the product", exact: true })
    .click();
  await expect(page).toHaveURL("/product");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Applications", exact: true })
    .click();
  await expect(page).toHaveURL("/applications");
  expect(accountRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("all app previews enlarge, dismiss, restore focus and track the desktop selection", async ({
  page,
}) => {
  await page.goto("/applications");
  const main = page.locator("#applications-main");
  for (const [label, title] of [
    ["web dashboard", "Web dashboard"],
    ["Android", "Android app"],
    ["iOS", "iOS app"],
    ["desktop", "Service inventory"],
  ]) {
    const enlarge = main.getByRole("button", {
      name: `Enlarge ${label} preview`,
      exact: true,
    });
    await enlarge.click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(enlarge).toBeFocused();
  }
  const desktop = page.locator("#applications-desktop");
  await desktop
    .getByRole("button", { name: "Computer status", exact: true })
    .click();
  await expect(
    desktop.getByRole("button", { name: "Computer status", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    desktop.getByAltText(/Desktop app with a rounded sidebar/).first(),
  ).toBeVisible();
  await desktop
    .getByRole("button", { name: "Enlarge desktop preview", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Computer status", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await expect(
    desktop.getByRole("button", {
      name: "Enlarge desktop preview",
      exact: true,
    }),
  ).toBeFocused();
});

test("mobile guide supports comparison, menu, availability and straight screens at five widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/applications");
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Getting started", exact: true })
    .click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#applications-setup$/);
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  const comparison = page.getByRole("region", {
    name: "Application comparison",
    exact: true,
  });
  await comparison.focus();
  await expect(comparison).toBeFocused();
  expect(
    await comparison.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await comparison.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(await comparison.evaluate((element) => element.scrollLeft > 0)).toBe(
    true,
  );
  await expect(
    comparison.getByRole("columnheader", { name: "iOS", exact: true }),
  ).toBeAttached();
  await page.locator("#applications-availability summary").nth(1).click();
  await expect(
    page
      .locator("#applications-availability")
      .getByText(/iOS does not generally expose device-wide/),
  ).toBeVisible();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  await page
    .locator("#applications-main img:visible")
    .evaluateAll(async (images) =>
      Promise.all(
        images.map(async (image) => {
          (image as HTMLImageElement).loading = "eager";
          await (image as HTMLImageElement).decode();
        }),
      ),
    );
  expect(
    await page
      .locator("#applications-main img:visible")
      .evaluateAll((images) =>
        images.every((image) => getComputedStyle(image).transform === "none"),
      ),
  ).toBe(true);
  for (const anchor of await page.locator('a[href^="#"]').all()) {
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
  }
  for (const control of await page.locator("a,button").all())
    expect(await control.textContent()).not.toMatch(/[↗↑↓]/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Enlarge iOS preview", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "iOS app", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
});
