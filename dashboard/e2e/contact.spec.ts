import { test, expect } from "@playwright/test";

test("Contact is reachable from public navigation and offers working documentation links", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const path of [
    "/",
    "/product",
    "/applications",
    "/solutions",
    "/pricing",
  ]) {
    await page.goto(path);
    await nav.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page).toHaveURL("/contact");
    await expect(
      nav.getByRole("link", { name: "Contact", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await expect(page).toHaveTitle("NetSentry — Contact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A question. An idea.Let’s start a conversation.",
  );
  await page.getByRole("link", { name: "Get in touch", exact: true }).click();
  await expect(page).toHaveURL(/#contact-form$/);
  await expect
    .poll(() =>
      page
        .locator("#contact-form")
        .evaluate((el) => el.getBoundingClientRect().top),
    )
    .toBeLessThan(150);
  await page
    .getByRole("link", { name: "Browse documentation", exact: true })
    .click();
  await expect(page).toHaveURL("/docs");
  await page
    .getByRole("navigation", { name: "Website navigation" })
    .getByRole("link", { name: "Contact", exact: true })
    .click();
  await expect(page).toHaveURL("/contact");
  await page
    .getByRole("link", {
      name: "“Start with your workspace” guide",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL("/docs/workspace");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("Contact form validates entries and never submits or claims delivery", async ({
  page,
}) => {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      request.url().includes("alex@example.com") ||
      request.url().includes("alex%40example.com")
    )
      sent.push(request.url());
  });
  await page.goto("/contact");
  const form = page.getByRole("form", { name: "What’s on your mind?" });
  const name = form.getByLabel("Your name", { exact: true });
  const email = form.getByLabel("Email address", { exact: true });
  const topic = form.getByRole("combobox", {
    name: "How can we help?",
    exact: true,
  });
  const message = form.getByLabel("Your message", { exact: true });
  const reply = form.getByRole("checkbox");
  const submit = form.getByRole("button", {
    name: "Send message",
    exact: true,
  });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(name).toBeFocused();
  await expect(form.getByRole("status")).toBeEmpty();
  await name.fill("   ");
  expect(
    await name.evaluate(
      (el) => (el as HTMLInputElement).validity.patternMismatch,
    ),
  ).toBe(true);
  await name.fill("Alex Morgan");
  await email.fill("not-an-email");
  expect(
    await email.evaluate(
      (el) => (el as HTMLInputElement).validity.typeMismatch,
    ),
  ).toBe(true);
  await email.fill("alex@example.com");
  await submit.click();
  await expect(topic).toBeFocused();
  await expect(topic.locator("option")).toHaveCount(6);
  await topic.selectOption("Privacy enquiry");
  await message.fill("I would like to understand the privacy controls.");
  await submit.click();
  await expect(reply).toBeFocused();
  await reply.check();
  await submit.click();
  await expect(form.getByRole("status")).toHaveText(
    "Message delivery isn’t available yet. Your message has not been sent.",
  );
  await expect(page).toHaveURL("/contact");
  await expect(message).toHaveValue(
    "I would like to understand the privacy controls.",
  );
  await message.fill("A revised question.");
  await expect(form.getByRole("status")).toBeEmpty();
  await email.focus();
  await page.keyboard.press("Enter");
  await expect(form.getByRole("status")).toContainText("has not been sent");
  expect(sent).toEqual([]);
  await expect(form).toContainText("Preview · Messages aren’t sent.");
});

test("Contact supports mobile navigation, keyboard FAQs and safe no-JavaScript rendering", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact");
  await page.locator("#contact-help summary").nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Tell us which app and operating system/),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByText(/Tell us which app and operating system/),
  ).not.toBeVisible();
  for (const width of [
    320, 360, 390, 650, 768, 900, 901, 1024, 1101, 1280, 1440,
  ]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/contact", "/docs", "/product"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} overflow at ${width}`,
      ).toBe(true);
    }
  }
  await page.goto("/contact");
  for (const anchor of await page.locator('a[href^="#"]').all())
    await expect(
      page.locator((await anchor.getAttribute("href"))!),
    ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await menu.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Pricing", exact: true })
    .click();
  await expect(page).toHaveURL("/pricing");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const nojs = await context.newPage();
    await nojs.goto("/contact");
    await expect(
      nojs.getByRole("button", { name: "Send message", exact: true }),
    ).toBeDisabled();
    await expect(
      nojs.getByLabel("Email address", { exact: true }),
    ).toBeDisabled();
    await expect(
      nojs.getByText(/This form preview needs JavaScript/),
    ).toBeVisible();
    await nojs
      .getByRole("link", { name: "Browse documentation", exact: true })
      .click();
    await expect(nojs).toHaveURL("/docs");
  } finally {
    await context.close();
  }
});
