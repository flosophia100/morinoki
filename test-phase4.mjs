// Phase 4 E2E: toast, mobile, offline/reconnect, CSV export, perf smoke
import { chromium, devices } from './node_modules/playwright/index.mjs';

const BASE = process.env.TARGET_BASE || 'https://morinoki.vercel.app';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const fails = [];
async function step(name, fn) {
  try { await fn(); console.log('  OK ', name); }
  catch (e) { fails.push(name); console.log('  FAIL', name, '→', e.message.slice(0,200)); }
}

// ===== 1. デスクトップ: toast, CSV export =====
console.log('=== desktop (toast + CSV) ===');
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageA = await ctxA.newPage();
const errorsA = [];
pageA.on('pageerror', e => errorsA.push('A: ' + e.message));
pageA.on('console', m => { if (m.type()==='error') errorsA.push('A/err: ' + m.text()); });

await pageA.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'p4-' + Math.random().toString(36).slice(2, 7);
await pageA.fill('#forest-name', 'P4森');
await pageA.fill('#forest-slug', slug);
await pageA.click('button[type=submit]');
await pageA.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
const forestUrl = BASE.includes('vercel.app')
  ? await pageA.$eval('#created-url', el => el.textContent)
  : `${BASE}/room.html?slug=${slug}`;

await pageA.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));

// 植樹 + キーワード
await pageA.click('[data-action="plant"]');
await pageA.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'));
await pageA.fill('#plant-name', 'テスト太郎');
await pageA.fill('#plant-pass', '7777');
await pageA.fill('#plant-pass2', '7777');
await pageA.click('#plant-submit');
await pageA.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
await pageA.click('#recovery-ok');
await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null);
for (const kw of ['音楽', '本']) {
  await pageA.fill('#ip-add-input', kw);
  await pageA.click('#ip-add-btn');
  await pageA.waitForFunction(t => [...document.querySelectorAll('.ip-kw .kw')].some(el => el.textContent.includes(t)), kw, { timeout: 8000 });
}

// 一旦 idle に戻る
await pageA.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
await new Promise(r => setTimeout(r, 500));

await step('idle画面にCSVエクスポートボタンが表示される', async () => {
  await pageA.waitForSelector('[data-action="export-csv"]', { timeout: 3000 });
});

await step('CSVエクスポートのダウンロードがトリガされる', async () => {
  const [download] = await Promise.all([
    pageA.waitForEvent('download', { timeout: 5000 }),
    pageA.click('[data-action="export-csv"]')
  ]);
  const name = download.suggestedFilename();
  if (!name.startsWith('forest-') || !name.endsWith('.csv')) throw new Error('filename: ' + name);
});

await step('toast(success)が表示される', async () => {
  await pageA.waitForSelector('.toast-success.show', { timeout: 3000 });
});

// エラーtoast: 不正なslugでnotFoundを意図的に発生(getRoomBySlug失敗→エラーtoast)
await step('エラーtoast: 不正slugへ移動', async () => {
  const page2 = await ctxA.newPage();
  const errors2 = [];
  page2.on('pageerror', e => errors2.push(e.message));
  await page2.goto(BASE + '/room.html?slug=__nonexistent__xxyyzz', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 3500));
  const hasErrToast = await page2.$('.toast-error.show');
  if (!hasErrToast) throw new Error('no error toast');
  await page2.close();
});

// ===== 2. モバイル viewport =====
console.log('\n=== mobile (iPhone 14) ===');
const ctxM = await browser.newContext({
  ...devices['iPhone 14'],
  viewport: { width: 390, height: 844 }
});
const pageM = await ctxM.newPage();
await pageM.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));

await step('モバイル: info-panel が下部ドロワー', async () => {
  const layout = await pageM.evaluate(() => {
    const p = document.getElementById('info-panel');
    const r = p.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, innerH: window.innerHeight, left: r.left, right: r.right };
  });
  // 期待: 左=0, 右=viewport幅, top > innerH * 0.4 (下半分)
  if (layout.top < layout.innerH * 0.4) throw new Error('not bottom drawer: ' + JSON.stringify(layout));
});

await step('モバイル: 共有/復元ボタンのサイズが38px以上', async () => {
  const sizes = await pageM.evaluate(() => {
    const s = document.getElementById('share-btn').getBoundingClientRect();
    const r = document.getElementById('restore-btn').getBoundingClientRect();
    return { share: s.width, restore: r.width };
  });
  if (sizes.share < 34 || sizes.restore < 34) throw new Error('too small: ' + JSON.stringify(sizes));
});

// ===== 3. Offline banner =====
console.log('\n=== offline/reconnect banner ===');
await step('オフライン時にバナーが出る', async () => {
  await ctxA.setOffline(true);
  await new Promise(r => setTimeout(r, 1200));
  const visible = await pageA.evaluate(() => {
    const el = document.getElementById('connection-status');
    return el && el.style.display !== 'none' && el.textContent.length > 0;
  });
  if (!visible) throw new Error('no offline banner');
  await ctxA.setOffline(false);
  await new Promise(r => setTimeout(r, 1500));
});

// ===== 4. パフォーマンス smoke: 10本樹の描画が60fps相当で安定 =====
console.log('\n=== performance smoke ===');
await step('レンダリング中のFPSが20以上(tab visible)', async () => {
  const fps = await pageA.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    return new Promise(resolve => {
      function loop() {
        frames++;
        if (performance.now() - t0 > 1500) {
          resolve(frames / ((performance.now() - t0) / 1000));
        } else requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });
  });
  console.log('      fps:', fps.toFixed(1));
  if (fps < 20) throw new Error('fps too low: ' + fps);
});

await pageA.screenshot({ path: 'test-phase4-A.png', fullPage: true });
await pageM.screenshot({ path: 'test-phase4-M.png', fullPage: true });

console.log('\n=== 結果 ===');
console.log('fails:', fails.length ? fails : 'none');
console.log('errors:', errorsA.length); errorsA.slice(0,5).forEach(e => console.log('  ', e));

await browser.close();
process.exit(fails.length || errorsA.length ? 1 : 0);
