// Optional static exports using existing desktop Chrome. Never provisions a browser.
const { chromium } = require('../../dashboard/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../../docs/design/mobile');
const output = process.env.MOBILE_DESIGN_OUTPUT;
if (!output || !path.isAbsolute(output) || !process.env.PLAYWRIGHT_CHROME_EXECUTABLE) {
  throw new Error('Set absolute MOBILE_DESIGN_OUTPUT and an existing PLAYWRIGHT_CHROME_EXECUTABLE.');
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1100 }, deviceScaleFactor: 1 });
    const index = pathToFileURL(path.join(root, 'index.html')).href;
    for (const sheet of ['android-1', 'android-2', 'ios-1', 'ios-2']) {
      await page.goto(index + '?sheet=' + sheet);
      const overflow = await page.locator('.content').evaluateAll(nodes => nodes.filter(n => n.scrollHeight > n.clientHeight + 2).length);
      if (overflow) throw new Error(`${sheet}: ${overflow} clipped screen contents`);
      await page.screenshot({ path: path.join(output, sheet + '.png'), fullPage: true });
      console.log('Exported ' + sheet);
    }
    for (const platform of ['android', 'ios']) {
      await page.goto(index + '#platform=' + platform);
      await page.locator('#preview .phone').screenshot({ path: path.join(output, platform + '-home.png') });
    }
    const board = path.join(output, 'navigation-overview.html');
    fs.writeFileSync(board, `<!doctype html><style>*{box-sizing:border-box}body{margin:0;background:#efedf3;color:#2b2234;font-family:Arial;padding:40px}h1{font-size:30px;margin:0 0 12px}p{color:#776780;font-size:14px;line-height:1.6}.columns{display:flex;gap:40px;justify-content:center;margin-top:28px}h2{font-size:21px;margin-bottom:8px}small{color:#796882}img{width:400px;margin-top:18px;display:block}.foot{text-align:center;margin:25px 0 0}</style><h1>NetSentry · Bottom navigation</h1><p>Home · Usage · Family · Computers · More<br>Submenus open focused pages. Back returns to the tab menu.</p><div class="columns"><section><h2>Android</h2><small>5 main tabs · 21 submenu destinations</small><img src="android-home.png" alt="Android Home navigation"></section><section><h2>iOS</h2><small>5 main tabs · 20 submenu destinations</small><img src="ios-home.png" alt="iOS Home navigation"></section></div><p class="foot">Source-based design previews. Native rendering and device validation remain pending.</p>`);
    await page.setViewportSize({ width: 1000, height: 1200 });
    await page.goto(pathToFileURL(board).href);
    await page.screenshot({ path: path.join(output, 'bottom-navigation.png'), fullPage: true });
    fs.copyFileSync(path.join(root, 'index.html'), path.join(output, 'index.html'));
    console.log('Exported bottom-navigation.png and offline catalogue.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
