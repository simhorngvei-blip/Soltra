const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  const html = await page.content();
  console.log('HTML Length:', html.length);
  const overlay = await page.$('.pointer-events-none');
  console.log('Overlay present:', !!overlay);
  await page.screenshot({ path: 'local-screenshot.png' });
  await browser.close();
})();
