// 新デザイン(幹+枝+葉)と plant-btn 再押下の動作確認 (ローカル)
import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8765';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

const fails = [];
async function step(name, fn) {
  try { await fn(); console.log('  OK ', name); }
  catch (e) { fails.push(name); console.log('  FAIL', name, '→', e.message); }
}

// セットアップ
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'loc-' + Math.random().toString(36).slice(2,7);
await page.fill('#forest-name', 'ローカルテスト森');
await page.fill('#forest-slug', slug);
await page.click('button[type=submit]');
await page.waitForSelector('#created:not(.hidden)', { timeout: 15000 });

// 森に入る
await page.goto(`${BASE}/room.html?slug=${slug}`, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 1500));

// 一人目
await step('plant 1人目', async () => {
  await page.click('#plant-btn');
  await page.waitForSelector('#plant-modal:not(.hidden)');
  await page.fill('#plant-name', 'さくら');
  await page.fill('#plant-pass', '1111');
  await page.fill('#plant-pass2', '1111');
  await page.click('#plant-submit');
  await page.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
  await page.click('#recovery-ok');
  await page.waitForFunction(() => !document.getElementById('node-panel').classList.contains('hidden'));
});

for (const kw of ['音楽', '本', 'パン作り']) {
  await step(`add "${kw}"`, async () => {
    await page.fill('#node-input', kw);
    await page.click('#node-add-btn');
    await page.waitForFunction(t => [...document.querySelectorAll('#node-list li')].some(li => li.textContent.includes(t)), kw, { timeout: 8000 });
  });
}

// node-panel 閉じる
await page.click('#node-panel-close');
await new Promise(r => setTimeout(r, 500));

// ★重要★ sessionありでも plant-btn がモーダルを開くか
await step('plant-btn は session あっても開く', async () => {
  await page.click('#plant-btn');
  await page.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'), { timeout: 3000 });
});

// 二人目を同じ端末で植樹
await step('plant 2人目', async () => {
  await page.fill('#plant-name', 'たくや');
  await page.fill('#plant-pass', '2222');
  await page.fill('#plant-pass2', '2222');
  await page.click('#plant-submit');
  await page.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
  await page.click('#recovery-ok');
});

for (const kw of ['旅行', '料理']) {
  await step(`たくや add "${kw}"`, async () => {
    await page.fill('#node-input', kw);
    await page.click('#node-add-btn');
    await page.waitForFunction(t => [...document.querySelectorAll('#node-list li')].some(li => li.textContent.includes(t)), kw, { timeout: 8000 });
  });
}

// 森ビュー表示確認(canvas上に2本の樹)
await page.click('#node-panel-close');
await new Promise(r => setTimeout(r, 800));

await step('2本の樹表示', async () => {
  const t = await page.$eval('#forest-count', el => el.textContent);
  if (!t.includes('2')) throw new Error('count: ' + t);
});

// スクショで新デザイン確認
await page.screenshot({ path: 'test-local-design.png', fullPage: true });
console.log('screenshot: test-local-design.png');

console.log('\n--- 結果 ---');
console.log('fails:', fails.length ? fails : 'none');
console.log('errors:', errors.length ? errors : 'none');

await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
