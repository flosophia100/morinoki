// 本番(morinoki.vercel.app)を実ブラウザでE2E
import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'https://morinoki.vercel.app';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
const fails = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('requestfailed', r => errors.push('requestfailed: ' + r.url() + ' - ' + (r.failure()?.errorText || '')));

async function step(name, fn) {
  try { await fn(); console.log('  OK ', name); }
  catch (e) { fails.push(name); console.log('  FAIL', name, '→', e.message); }
}

// 1. 新規森を作る
console.log('--- index ---');
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const slug = 'debug-' + Math.random().toString(36).slice(2,7);
await step('fill form', async () => {
  await page.fill('#forest-name', 'デバッグ森');
  await page.fill('#forest-slug', slug);
});
await step('submit', async () => {
  await page.click('button[type=submit]');
  await page.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
});

// 2. 森URLへ
const forestUrl = await page.$eval('#created-url', el => el.textContent);
console.log('forestUrl:', forestUrl);
console.log('--- enter forest ---');
await page.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2500));

// 3. 初期状態チェック
await step('forest-name', async () => {
  const t = await page.$eval('#forest-name', el => el.textContent);
  if (!t.includes('デバッグ森')) throw new Error(t);
});
await step('0本の樹', async () => {
  const t = await page.$eval('#forest-count', el => el.textContent);
  if (!t.includes('0')) throw new Error(t);
});
await step('canvas exists and sized', async () => {
  const size = await page.$eval('#forest-canvas', el => ({ w: el.width, h: el.height, offW: el.offsetWidth, offH: el.offsetHeight }));
  console.log('      canvas size:', size);
  if (!size.w || !size.h) throw new Error('canvas not sized');
});

// 4. 「+樹を植える」の挙動調査
console.log('--- 樹を植えるボタンの挙動 ---');
await step('plant-btn visible', async () => {
  const visible = await page.$eval('#plant-btn', el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, display: cs.display, visibility: cs.visibility, pointerEvents: cs.pointerEvents, zIndex: cs.zIndex };
  });
  console.log('      plant-btn:', visible);
  if (visible.display === 'none' || visible.visibility === 'hidden') throw new Error('hidden');
});

// plant-btn が何か上に覆われてないか確認
await step('what element is at plant-btn center', async () => {
  const topEl = await page.evaluate(() => {
    const btn = document.getElementById('plant-btn');
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
    return el ? { id: el.id, tag: el.tagName, cls: el.className } : null;
  });
  console.log('      topmost:', topEl);
  if (topEl?.id !== 'plant-btn') throw new Error('not plant-btn: ' + JSON.stringify(topEl));
});

await step('click plant-btn → modal opens', async () => {
  await page.click('#plant-btn');
  await page.waitForFunction(
    () => !document.getElementById('plant-modal').classList.contains('hidden'),
    { timeout: 3000 }
  );
});

// 5. キャンバス上のクリックも試す
console.log('--- キャンバスクリック ---');
await page.click('#plant-cancel'); // モーダル閉じる
await new Promise(r => setTimeout(r, 500));
await step('canvas tap on empty opens modal (no session)', async () => {
  // 画面中央あたりをタップ
  const box = await page.$eval('#forest-canvas', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(
    () => !document.getElementById('plant-modal').classList.contains('hidden'),
    { timeout: 3000 }
  );
});

// 6. 実際に植樹
await page.fill('#plant-name', 'テスト太郎');
await page.fill('#plant-pass', '5555');
await page.fill('#plant-pass2', '5555');
await step('submit plant', async () => {
  await page.click('#plant-submit');
  await page.waitForFunction(
    () => !document.getElementById('recovery-modal').classList.contains('hidden'),
    { timeout: 15000 }
  );
});
await step('close recovery', async () => {
  await page.click('#recovery-ok');
  await page.waitForFunction(
    () => !document.getElementById('node-panel').classList.contains('hidden'),
    { timeout: 3000 }
  );
});

// 7. ノード追加
for (const kw of ['音楽', '料理']) {
  await step(`add "${kw}"`, async () => {
    await page.fill('#node-input', kw);
    await page.click('#node-add-btn');
    await page.waitForFunction(
      (t) => [...document.querySelectorAll('#node-list li')].some(li => li.textContent.includes(t)),
      kw, { timeout: 8000 }
    );
  });
}

console.log('\n--- 結果 ---');
console.log('fails:', fails.length ? fails : 'none');
console.log('errors:', errors.length);
errors.forEach(e => console.log('  ', e));
await page.screenshot({ path: 'test-prod-e2e.png', fullPage: true });
console.log('screenshot saved: test-prod-e2e.png');

await browser.close();
process.exit(fails.length || errors.length ? 1 : 0);
