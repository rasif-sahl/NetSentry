// Run with an existing desktop Chrome executable; does not install a browser or SDK.
const { chromium } = require('../../dashboard/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../docs/design/mobile');
const routes = JSON.parse(fs.readFileSync(path.join(root, 'navigation.json')));
const android = fs.readFileSync(path.resolve(root, '../../../android/app/src/main/java/com/netsentry/app/ui/PersonalApp.kt'), 'utf8');
const ios = fs.readFileSync(path.resolve(root, '../../../ios/NetSentry/SetupView.swift'), 'utf8');
(async () => {
  assert.ok(process.env.PLAYWRIGHT_CHROME_EXECUTABLE, 'Set an existing PLAYWRIGHT_CHROME_EXECUTABLE. No browser is installed.');
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    let checked = 0;
    for (const platform of ['android', 'ios']) {
      await page.locator(`[data-platform="${platform}"]`).click();
      assert.equal(await page.locator('#preview .bottom button').count(), 5);
      for (const [tab, children] of Object.entries(routes[platform])) {
        await page.locator('#preview .bottom button').filter({ hasText: tab }).click();
        assert.equal(await page.locator('#preview .menu-link').count(), Object.keys(children).length);
        for (const label of Object.keys(children)) {
          // A design submenu must exist in the platform's native routing declarations.
          assert.ok((platform === 'android' ? android : ios).includes(`"${label}"`), `${platform}: ${label}`);
          await page.locator('#preview .menu-link').filter({ hasText: label }).click();
          assert.equal(await page.locator('#preview .bottom [aria-current="page"]').innerText(), tab);
          assert.equal(await page.locator('#preview .brand').innerText(), label);
          if (await page.locator('#variants').count()) {
            const count = await page.locator('#variants option').count();
            for (let i = 0; i < count; i++) await page.locator('#variants').selectOption(String(i));
          }
          await page.locator('#preview #back').click();
          assert.equal(await page.locator('#preview .menu-link').count(), Object.keys(children).length);
          checked++;
        }
      }
      // Signed-out designs must not expose signed-in tabs.
      await page.locator('#mode').click();
      assert.equal(await page.locator('#gallery .entry').count(), 33);
      assert.equal(await page.locator('#gallery .phone.auth .bottom').count(), 0);
      await page.getByRole('textbox', { name: 'Find a screen' }).fill('subscription');
      assert.equal(await page.locator('#gallery .entry').count(), 1);
      await page.getByRole('textbox', { name: 'Find a screen' }).fill('');
      await page.locator('#mode').click();
    }
    await page.locator('#preview .bottom button').filter({ hasText: 'Home' }).click();
    await page.locator('#preview .menu-link').first().click();
    await page.goBack();
    assert.equal(await page.locator('#preview .menu-link').count(), 4);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${checked} submenu destinations, all tab/back links, variants, search, signed-out tabs, browser Back and narrow layout. Native UI execution is not verified.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
