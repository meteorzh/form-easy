import { chromium } from 'playwright';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
copyFileSync(join(here, 'page.html'), join(here, '..', 'www', 'overlay-test.html'));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 900, height: 400 } });
await page.goto('http://127.0.0.1:5599/overlay-test.html?v=' + Date.now());
await page.waitForTimeout(700);

// 等到蒙层真正出现在 DOM 里就立刻截图并读取样式。
await page.evaluate(() => window.__switchBig());
await page.waitForFunction(
  () => !!document.querySelector('.form-schema-loading'),
  null,
  { timeout: 3000 }
);
await page.evaluate(() => {
  const overlay = document.querySelector('.form-schema-loading');
  const style = getComputedStyle(overlay);
  const rect = overlay.getBoundingClientRect();
  const behind = document.elementFromPoint(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2
  );
  window.__style = {
    background: style.backgroundColor,
    color: style.color,
    text: overlay.textContent.trim(),
    rect: rect.toJSON(),
    behind: behind ? behind.tagName + '.' + behind.className : null
  };
});
await page.screenshot({ path: join(here, 'shot-during.png') });
const info = await page.evaluate(() => window.__style);
console.log('蒙层样式:', JSON.stringify(info, null, 2));

await browser.close();
