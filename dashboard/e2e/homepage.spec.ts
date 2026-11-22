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
    .getByRole("link", { name: "Product", exact: true })
    .first()
    .focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("link", { name: "How it works", exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
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

test("public pages share the same navigation and skip link", async ({
  page,
}) => {
  const links = [
    "Home",
    "Product",
    "Applications",
    "Solutions",
    "Documentation",
    "Pricing",
    "Contact",
  ];
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const [route, active] of [
    ["/", "Home"],
    ["/product", "Product"],
    ["/applications", "Applications"],
    ["/solutions", "Solutions"],
    ["/docs", "Documentation"],
    ["/docs/workspace", "Documentation"],
    ["/pricing", "Pricing"],
    ["/contact", "Contact"],
    ["/privacy", null],
    ["/terms", null],
  ] as const) {
    await page.goto(route);
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText(links);
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/app");
    if (active) {
      await expect(nav.locator("[aria-current]")).toHaveText(active);
    } else {
      await expect(nav.locator("[aria-current]")).toHaveCount(0);
    }
    const skip = page.getByRole("link", { name: "Skip to content" });
    await skip.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  }

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/docs/workspace");
  const banner = page.getByRole("banner");
  expect(
    await banner.evaluate((header) => header.scrollWidth <= header.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(nav.getByRole("link")).toHaveText(links);
  await nav.getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL("/pricing");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("homepage text stays readable and motion follows the system preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  const intro = heading.locator("..");
  const description = page.getByText(
    /^Your phone, your computer, your network\./,
  );
  await expect(heading).toHaveCSS("font-family", /system-ui/);
  await expect(description).toHaveCSS("font-size", "16px");
  await expect(description).toHaveCSS("color", "rgb(85, 73, 94)");
  await expect(intro).not.toHaveCSS("animation-name", "none");
  const sections = page.locator("main > section");
  await expect(sections).toHaveCount(10);
  const sectionAnimations = () =>
    sections.evaluateAll((nodes) =>
      nodes.map((section) =>
        [section, ...section.querySelectorAll("*")].some(
          (element) => getComputedStyle(element).animationName !== "none",
        ),
      ),
    );
  await expect.poll(sectionAnimations).toEqual(Array(10).fill(true));

  const privacy = page.locator("#privacy");
  const scrollToPrivacy = (fraction: number) =>
    privacy.evaluate((section, fraction) => {
      window.scrollBy(
        0,
        section.getBoundingClientRect().top - window.innerHeight * fraction,
      );
    }, fraction);
  const privacyProgress = () =>
    privacy
      .locator(":scope > div")
      .evaluate(
        (card) =>
          card.getAnimations()[0]?.effect?.getComputedTiming().progress ?? -1,
      );
  await scrollToPrivacy(0.9);
  await expect.poll(privacyProgress).toBeGreaterThan(0);
  expect(await privacyProgress()).toBeLessThan(0.6);
  await scrollToPrivacy(0.1);
  await expect.poll(privacyProgress).toBeGreaterThan(0.95);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(sectionAnimations).toEqual(Array(10).fill(false));
  await expect(privacy.getByRole("heading", { level: 2 })).toBeInViewport();
});

test("public pages beyond the homepage share scroll motion and respect reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const routes = [
    [
      "/product",
      [
        "#product-reports article",
        "#product-features > div:last-child",
        "#product-main + footer",
      ],
    ],
    [
      "/solutions",
      [
        "#solutions-paths a",
        "#solutions-developers > div:nth-child(2)",
        "#solutions-availability details",
      ],
    ],
    [
      "/pricing",
      [
        "#pricing-plans article",
        "#pricing-compare [role=region]",
        "#pricing-questions details",
      ],
    ],
    [
      "/applications",
      [
        "#applications-choose a",
        "#applications-compare [role=region]",
        "#applications-availability details",
      ],
    ],
    ["/contact", ["#contact-form", "#contact-help details"]],
    [
      "/docs",
      [
        'section[aria-label="Documentation guides"] article',
        "#documentation-main footer",
      ],
    ],
    [
      "/docs/workspace",
      [
        "#docs-article-workspace section h2",
        "#docs-article-workspace section p",
      ],
    ],
    [
      "/privacy",
      [
        "#privacy-main article section h2",
        "#privacy-main article section > div",
      ],
    ],
    [
      "/terms",
      ["#terms-main article section h2", "#terms-main article section > div"],
    ],
  ] as const;

  for (const [route, selectors] of routes) {
    await test.step(route, async () => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(route);
      const heading = page.getByRole("heading", { level: 1 });
      const scrollItems = selectors.map((selector) =>
        page.locator(selector).first(),
      );
      const hasIntro = () =>
        heading.evaluate((element) => {
          for (
            let current: Element | null = element;
            current && current.tagName !== "MAIN";
            current = current.parentElement
          ) {
            const style = getComputedStyle(current);
            if (
              style.animationName !== "none" &&
              style.getPropertyValue("animation-timeline") === "auto"
            )
              return true;
          }
          return false;
        });

      await expect.poll(hasIntro).toBe(true);
      for (const item of scrollItems)
        await expect(item).toHaveCSS("animation-timeline", /^view\(/);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(hasIntro).toBe(false);
      for (const item of scrollItems)
        await expect(item).toHaveCSS("animation-name", "none");
      await expect(heading).toBeVisible();
    });
  }
});

test("below-the-fold motion works without native scroll timelines", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS);
    CSS.supports = (property: string, value?: string) =>
      property === "animation-timeline"
        ? false
        : value === undefined
          ? supports(property)
          : supports(property, value);
  });

  await page.goto("/pricing");
  const comparison = page.getByRole("region", { name: "Edition comparison" });
  await expect(page.locator("[data-motion-fallback]")).toBeAttached();
  await expect(comparison).not.toHaveAttribute("data-motion-entered", "");
  await comparison.scrollIntoViewIfNeeded();
  await expect(comparison).toHaveAttribute("data-motion-entered", "");
  await expect(comparison).toHaveCSS("animation-timeline", "auto");
  await expect(comparison).not.toHaveCSS("animation-name", "none");

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Product" })
    .click();
  await expect(page).toHaveURL("/product");
  const report = page.locator("#product-reports article").first();
  await report.scrollIntoViewIfNeeded();
  await expect(report).toHaveAttribute("data-motion-entered", "");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(report).toHaveCSS("animation-name", "none");
});
