const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, webkit } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const { default: html } = await import(pathToFileURL(path.join(root, 'apple-app/game-html.js')));
  const engine = process.env.QA_BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({ executablePath: process.env.QA_BROWSER_EXECUTABLE || undefined });
  let failed = false;
  try {
    for (const [name, width, height] of [['iphone', 956, 440], ['ipad', 1376, 1032], ['desktop', 1920, 1080]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.setContent(html, { waitUntil: 'load' });
      await page.locator('#s-title [data-action="books"]').click();
      await page.locator('.mix img').last().waitFor();
      await page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))));
      await page.evaluate(() => Promise.all(document.querySelector('.screen.active').getAnimations().map(animation => animation.finished)));
      const checks = await page.evaluate(() => {
        const box = document.querySelector('.mix').getBoundingClientRect();
        const label = document.querySelector('[data-book="all"] b').getBoundingClientRect();
        return [...document.querySelectorAll('.mix img')].map(img => {
          const r = img.getBoundingClientRect();
          return { width: r.width, height: r.height, inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1, beforeLabel: r.bottom <= label.top + 1 };
        });
      });
      const output = path.join(root, 'qa-output', process.env.QA_WEB_OUTPUT || 'web-layout');
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, `${name}-books.png`) });
      console.log(JSON.stringify({ engine: engine.name(), device: name, checks }));
      try {
        assert.equal(checks.length, 6);
        assert.ok(checks.every(x => x.inside && x.beforeLabel && x.width > 0 && x.height > 0), `${name}: mixed book covers overflow their tile`);
      } catch (error) {
        failed = true;
        console.error(error.message);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  if (failed) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
