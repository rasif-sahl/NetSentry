import { test, expect } from "@playwright/test";
import { guides } from "../src/features/documentation/guides";

test("documentation is reachable from public navigation without account API calls", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend")) requests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Documentation", exact: true })
    .click();
  await expect(page).toHaveURL("/docs");
  await expect(page).toHaveTitle("NetSentry — Documentation");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little guidance.A clearer way forward.",
  );
  await expect(page.getByRole("status")).toHaveText(
    "12 guides across 6 topics",
  );
  const topics = page.getByRole("navigation", { name: "Documentation topics" });
  await expect(
    topics.getByRole("link", { name: "Documentation home", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("link", { name: "Read the getting-started guide", exact: true })
    .click();
  await expect(page).toHaveURL("/docs/workspace");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Start with your workspace",
  );
  await expect(
    topics.getByRole("link", {
      name: "Start with your workspace",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation", { name: "Website navigation" })
    .getByRole("link", { name: "Solutions", exact: true })
    .click();
  await expect(page).toHaveURL("/solutions");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Different days.",
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Documentation", exact: true })
    .click();
  await expect(page).toHaveURL("/docs");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("guide search handles filtering, empty results, reset and reader query navigation", async ({
  page,
}) => {
  await page.goto("/docs");
  const search = page.getByRole("searchbox", { name: "Search documentation" });
  const cards = page.getByRole("region", { name: "Documentation guides" });
  await search.fill("  PERMISSIONS  ");
  const matching = await cards.getByRole("link").count();
  expect(matching).toBeGreaterThan(0);
  expect(matching).toBeLessThan(12);
  await expect(
    page.getByRole("link", {
      name: "Read the getting-started guide",
      exact: true,
    }),
  ).not.toBeVisible();
  await search.fill("no-such-guide-xyz");
  await expect(
    page.getByRole("heading", { name: "No matching guides.", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("0 guides across 0 topics");
  await page
    .getByRole("button", { name: "Show all guides", exact: true })
    .click();
  await expect(search).toBeFocused();
  await expect(cards.getByRole("link")).toHaveCount(12);
  await search.fill('<script>alert("test")</script>');
  await expect(
    page.getByRole("heading", { name: "No matching guides.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(cards.getByRole("link")).toHaveCount(12);
  await page.goto("/docs/workspace");
  await page
    .getByRole("searchbox", { name: "Search documentation" })
    .fill("sharing");
  await page
    .getByRole("searchbox", { name: "Search documentation" })
    .press("Enter");
  await expect(page).toHaveURL("/docs?q=sharing");
  await expect(
    page.getByRole("searchbox", { name: "Search documentation" }),
  ).toHaveValue("sharing");
  await expect(cards.getByRole("link")).toHaveCount(
    guides.filter((guide) =>
      `${guide.title} ${guide.summary} ${guide.category}`
        .toLowerCase()
        .includes("sharing"),
    ).length,
  );
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Search documentation" }),
  ).toHaveValue("sharing");
});

test("all guides have readable content, unique article anchors and unknown-guide handling", async ({
  page,
}) => {
  for (const guide of guides) {
    await page.goto(`/docs/${guide.id}`);
    await expect(page).toHaveTitle(`${guide.title} — NetSentry documentation`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      guide.title,
    );
    await expect(page.locator(`#docs-article-${guide.id} section`)).toHaveCount(
      guide.sections.length,
    );
    const contents = page.getByRole("navigation", { name: "Article contents" });
    await expect(contents.getByRole("link")).toHaveCount(guide.sections.length);
    for (const anchor of await contents.getByRole("link").all())
      await expect(
        page.locator((await anchor.getAttribute("href"))!),
      ).toHaveCount(1);
  }
  await page.goto("/docs/workspace");
  await page
    .getByRole("navigation", { name: "Article contents" })
    .getByRole("link", { name: "2. Choose your workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/#docs-workspace-choose$/);
  await expect
    .poll(() =>
      page
        .locator("#docs-workspace-choose")
        .evaluate((element) => Math.abs(element.getBoundingClientRect().top)),
    )
    .toBeLessThan(180);
  await page
    .locator("#docs-article-workspace")
    .getByRole("link", {
      name: "Understand reports and data quality",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL("/docs/reports");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Understand reports and data quality",
  );
  await page.goto("/docs/not-a-real-guide");
  await expect(
    page.getByText("This page could not be found.", { exact: true }),
  ).toBeVisible();
});

test("documentation home and reader stay usable on mobile and across screen widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/docs");
  const toggle = page.getByRole("button", {
    name: "Browse documentation",
    exact: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("navigation", { name: "Documentation topics" })
    .getByRole("link", {
      name: "Permissions and collection choices",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL("/docs/permissions");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Permissions and collection choices",
  );
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  for (const route of ["/docs", "/docs/workspace"]) {
    await page.goto(route);
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow at ${width}`,
      ).toBe(true);
    }
  }
  await page
    .locator("#documentation-main img:visible")
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
      .locator("#documentation-main img:visible")
      .evaluateAll((images) =>
        images.every((image) => getComputedStyle(image).transform === "none"),
      ),
  ).toBe(true);
  await expect(
    page.getByText(/Empty workspace example, not live monitoring data/),
  ).toBeVisible();
});
