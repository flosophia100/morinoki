import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const page = await browser.newContext().then(c => c.newPage());
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('requestfailed', r => consoleErrors.push('requestfailed: ' + r.url() + ' - ' + r.failure()?.errorText));

// 1. index
console.log('--- index ---');
await page.goto('https://morinoki.vercel.app/', { waitUntil: 'networkidle' });
console.log('title:', await page.title());
console.log('slug auto:', await page.$eval('#forest-slug', el => el.value));

// 2. 新規森を作る
const slug = 'prod-' + Math.random().toString(36).slice(2,8);
await page.fill('#forest-name', 'プロダクションテスト');
await page.fill('#forest-slug', slug);
await page.click('button[type=submit]');
await page.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
const url = await page.$eval('#created-url', el => el.textContent);
console.log('created url:', url);

// 3. /r/slug へ移動
console.log('--- /r/:slug rewrite ---');
await page.goto(url, { waitUntil: 'networkidle' });
console.log('forest-name:', await page.$eval('#forest-name', el => el.textContent));
console.log('canvas exists:', !!(await page.$('#forest-canvas')));
console.log('plant-btn exists:', !!(await page.$('#plant-btn')));

// 404/エラーチェック
if (pageErrors.length) console.log('pageErrors:', pageErrors);
if (consoleErrors.length) console.log('consoleErrors:', consoleErrors.slice(0,5));
else console.log('NO console errors');

await browser.close();
