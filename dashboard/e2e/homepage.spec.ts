import { test, expect } from "@playwright/test";

// Public-page checks deliberately need no account or monitoring data.
test("public homepage explains each app without contacting account APIs", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend")) apiRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page).toHaveTitle(
    "NetSentry — Bring your digital world into focus",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your devices tell a story.Bring it into focus.",
  );
  for (const id of [
    "dashboard",
    "apps",
    "desktop",
    "privacy",
    "how-it-works",
    "availability",
  ]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", "/app");
  await expect(page.locator("main")).not.toContainText(/[↗↓↑]/);
  await expect(page.locator("main img:visible")).toHaveCount(5);

  expect(apiRequests).toEqual([]);
  const primary = page.getByRole("link", { name: "See the bigger picture" });
  await expect(primary).toHaveCSS("background-color", "rgb(126, 96, 148)");
  await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("desktop previews switch, enlarge and restore keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  const desktop = page.locator("#desktop");
  await desktop
    .getByRole("button", { name: "Service inventory", exact: true })
    .click();
  await expect(
    desktop.getByRole("button", { name: "Service inventory", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(desktop.getByAltText(/Desktop service inventory/)).toBeVisible();
  const enlarge = desktop.getByRole("button", {
    name: "Enlarge preview",
    exact: true,
  });
  await enlarge.click();
  const dialog = page.getByRole("dialog", { name: "Service inventory" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveAttribute(
    "alt",
    /Desktop service inventory/,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(enlarge).toBeFocused();
  await page.getByRole("button", { name: "Enlarge Android preview" }).click();
  await expect(page.getByRole("dialog", { name: "Android app" })).toBeVisible();
  await page
    .getByRole("button", { name: "Close preview", exact: true })
    .click();
  await page.getByRole("button", { name: "Enlarge iOS preview" }).click();
  await expect(page.getByRole("dialog", { name: "iOS app" })).toBeVisible();
});

test("narrow layout keeps screens straight and navigation accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Who it’s for" })
    .click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/#features$/);
  await page
    .locator("summary")
    .filter({ hasText: "Does every feature work on every device?" })
    .click();
  await expect(page.getByText(/iOS does not generally expose/)).toBeVisible();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page
      .locator("main img:visible")
      .evaluateAll((images) =>
        images.every((image) => getComputedStyle(image).transform === "none"),
      ),
  ).toBe(true);
  for (const link of await page.locator('a[href^="#"]').all()) {
    const href = await link.getAttribute("href");
    await expect(page.locator(href!)).toHaveCount(1);
  }
});

test("existing workspace bookmarks retain their section", async ({ page }) => {
  await page.goto("/?view=alerts");
  await expect(page).toHaveURL(/\/app\?view=alerts$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
