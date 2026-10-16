const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { webkit } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const { default: html } = await import(pathToFileURL(path.join(root, 'apple-app/game-html.js')));
  const browser = await webkit.launch();
  try {
    for (const book of ['food', 'tp']) {
      const page = await browser.newPage({ viewport: { width: 1376, height: 1032 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent(html, { waitUntil: 'load' });
      await page.locator('#s-title [data-action="books"]').click();
      await page.locator(`[data-book="${book}"]`).click();
      for (const [setting, value] of [['teams', 1], ['rounds', 3], ['timer', 0], ['sfx', 0], ['tune', 0]]) {
        await page.locator(`[data-${setting}="${value}"]`).click();
      }
      await page.locator('#s-setup [data-action="start"]').click();
      let answered = 0;
      let wagers = 0;
      while (!(await page.locator('#s-final.active').count())) {
        assert.ok(answered < 8, 'Game did not reach the final scoreboard');
        await page.locator('#s-round.active').waitFor();
        if (await page.locator('#answers [data-action="wager"]').count()) {
          await page.locator('#answers [data-action="wager"]').last().click();
          wagers += 1;
        }
        await page.locator('#answers [data-action="answer"]').first().click();
        await page.locator('#s-result.active').waitFor();
        answered += 1;
        await page.locator('#next-btn').click();
        await page.waitForFunction(() => document.querySelector('#s-final.active, #s-round.active'));
      }
      assert.ok(answered >= 3);
      assert.equal(wagers, 1, 'The points-only finale must be playable');
      assert.ok((await page.locator('#winner').innerText()).trim());
      await page.locator('#s-final [data-action="start"]').click();
      await page.locator('#s-round.active').waitFor();
      await page.locator('#s-round [data-action="menu"]').click();
      await page.locator('[data-action="quit-yes"]').click();
      await page.locator('#s-title.active').waitFor();
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ engine: 'webkit', book, answered, wagers, replayAndQuit: 'passed', errors }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
