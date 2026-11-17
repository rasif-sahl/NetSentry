import { test, expect } from "@playwright/test";

test("public navigation opens the Solutions guide and its starting points without account requests", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend")) requests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Solutions", exact: true }).click();
  await expect(page).toHaveURL("/solutions");
  await expect(page).toHaveTitle("NetSentry — Solutions");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Different days. Different needs.A clearer picture for each.",
  );
  await expect(
    nav.getByRole("link", { name: "Solutions", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  for (const id of ["personal", "family", "teams", "developers"]) {
    await page.locator(`#solutions-paths a[href="#solutions-${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#solutions-${id}$`));
    await expect
      .poll(() =>
        page
          .locator(`#solutions-${id}`)
          .evaluate((element) => Math.abs(element.getBoundingClientRect().top)),
      )
      .toBeLessThan(150);
  }
  await expect(page.locator("#solutions-family")).toContainText(
    "Current Android and router restriction adapters do not enforce device limits.",
  );
  await expect(page.locator("#solutions-teams")).toContainText(
    "NetSentry does not produce employee productivity scores.",
  );
  await page
    .locator("#solutions-family")
    .getByRole("link", { name: "Explore the applications", exact: true })
    .click();
  await expect(page).toHaveURL("/applications#applications-phones");
  await nav.getByRole("link", { name: "Solutions", exact: true }).click();
  await expect(page).toHaveURL("/solutions");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Different days.",
  );
  await nav.getByRole("link", { name: "Product", exact: true }).click();
  await expect(page).toHaveURL("/product");
  await nav.getByRole("link", { name: "Solutions", exact: true }).click();
  await expect(page).toHaveURL("/solutions");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("developer screenshot enlarges with Escape dismissal and focus restoration", async ({
  page,
}) => {
  await page.goto("/solutions");
  const enlarge = page
    .locator("#solutions-developers")
    .getByRole("button", { name: "Enlarge preview", exact: true });
  await enlarge.click();
  const dialog = page.getByRole("dialog", {
    name: "Desktop service inventory",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveAttribute(
    "alt",
    /Desktop service inventory/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(enlarge).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await enlarge.click();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await expect(enlarge).toBeFocused();
});

test("Solutions supports mobile navigation, disclosures, anchors and upright screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/solutions");
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
  await page.locator("#solutions-availability summary").first().click();
  await expect(
    page
      .locator("#solutions-availability")
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
    .locator("#solutions-main img:visible")
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
      .locator("#solutions-main img:visible")
      .evaluateAll((images) =>
        images.every((image) => getComputedStyle(image).transform === "none"),
      ),
  ).toBe(true);
  for (const anchor of await page.locator('a[href^="#"]').all())
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
  for (const control of await page.locator("a,button").all())
    expect(await control.textContent()).not.toMatch(/[↗↑↓]/);
  await page.setViewportSize({ width: 390, height: 844 });
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});
