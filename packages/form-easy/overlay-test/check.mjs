import { chromium } from 'playwright';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const www = join(here, '..', 'www');
const port = 5599;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

// 起一个静态服务器，直接托管构建产物目录。
const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0];
  const file = join(www, path === '/' ? 'overlay-test.html' : path);
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'text/plain' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

// Stencil 每次构建都会重建 www，这里把测试页复制进去。
copyFileSync(join(here, 'page.html'), join(www, 'overlay-test.html'));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', error => console.log('[pageerror]', error.message));

await page.goto(`http://127.0.0.1:${port}/overlay-test.html`);
await page.waitForTimeout(600);

await page.evaluate(() => window.__reset());
await page.evaluate(() => window.__switchBig());
await page.waitForTimeout(800);

const result = await page.evaluate(() => ({
  frames: window.__frames,
  marks: window.__marks,
  mutations: window.__mutations
}));

// 在蒙层存在时截图，肉眼确认是否真的可见。
await page.evaluate(() => {
  window.__frames = [];
  window.__marks = [];
  window.__mutations = [];
});
await page.evaluate(() => window.__switchBig());
await page.waitForTimeout(200);
await page.screenshot({ path: 'overlay-test/shot-loading.png' });
await page.waitForTimeout(600);
await page.screenshot({ path: 'overlay-test/shot-after.png' });

const visible = result.frames.filter(frame => frame.hasOverlay);
const span = visible.length > 1
  ? visible[visible.length - 1].t - visible[0].t
  : 0;

console.log('事件:', result.marks.map(m => `${m.name}@${m.t.toFixed(0)}`).join(' | '));
console.log('DOM:', result.mutations.map(m => `${m.present ? 'IN' : 'OUT'}@${m.t.toFixed(0)}`).join(' | '));
console.log(`绘制帧: 总 ${result.frames.length}，含蒙层 ${visible.length}`);
console.log(`蒙层可见时长: ~${span.toFixed(1)}ms`);
// 至少要连续绘制 3 帧（约 48ms）才不至于看起来像闪烁。
console.log(visible.length >= 3 ? '✅ 蒙层可见帧数足够' : '❌ 蒙层可见帧数过少');

// 确认提示文字停在表单左上角，而不是脱离表单覆盖 body。
await page.evaluate(() => window.__switchSmall());
await page.waitForTimeout(300);
await page.evaluate(() => window.__switchBig());
await page.waitForFunction(
  () => !!document.querySelector('.form-schema-loading-indicator'),
  null,
  { timeout: 3000 }
);
const indicator = await page.evaluate(() => {
  const el = document.querySelector('.form-schema-loading-indicator');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const form = document.querySelector('form-easy form').getBoundingClientRect();
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    formLeft: Math.round(form.left),
    formTop: Math.round(form.top),
    visible: rect.left >= form.left
      && rect.top >= form.top
      && rect.right <= form.right
      && rect.bottom <= form.bottom
  };
});
if (indicator) {
  const aligned = Math.abs(indicator.left - indicator.formLeft - 12) < 2
    && Math.abs(indicator.top - indicator.formTop - 12) < 2;
  console.log('提示文字:', JSON.stringify(indicator));
  console.log(aligned ? '✅ 提示文字位于表单左上角' : '❌ 提示文字偏离表单左上角');
}

await browser.close();
server.close();
