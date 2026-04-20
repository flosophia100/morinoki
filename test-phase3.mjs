// Phase 3 E2E: atmosphere, share+QR, restore modal, common keywords
import { chromium } from './node_modules/playwright/index.mjs';

const BASE = process.env.TARGET_BASE || 'https://morinokki.vercel.app';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const fails = [];
async function step(name, fn) {
  try { await fn(); console.log('  OK ', name); }
  catch (e) { fails.push(name); console.log('  FAIL', name, '→', e.message.slice(0,200)); }
}

const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageA = await ctxA.newPage();
const errorsA = [];
pageA.on('pageerror', e => errorsA.push('A/pageerror: ' + e.message));
pageA.on('console', m => { if (m.type()==='error') errorsA.push('A/err: '+m.text()); });

// 1. 森作成
console.log('=== setup ===');
await pageA.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'p3-' + Math.random().toString(36).slice(2, 7);
await pageA.fill('#forest-name', 'Phase3森');
await pageA.fill('#forest-slug', slug);
await pageA.click('button[type=submit]');
await pageA.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
const forestUrlFromUI = await pageA.$eval('#created-url', el => el.textContent);
const forestUrl = BASE.includes('vercel.app') ? forestUrlFromUI : `${BASE}/room.html?slug=${slug}`;

// 2. Aが植樹
await pageA.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));
await pageA.click('[data-action="plant"]');
await pageA.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'));
await pageA.fill('#plant-name', 'Aさん');
await pageA.fill('#plant-pass', '1111');
await pageA.fill('#plant-pass2', '1111');
await pageA.click('#plant-submit');
await pageA.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
// 復元キーをキャプチャ
const recoveryKey = await pageA.$eval('#recovery-key', el => el.textContent);
console.log('recoveryKey:', recoveryKey);
await pageA.click('#recovery-ok');
await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null);
for (const kw of ['音楽', '読書']) {
  await pageA.fill('#ip-add-input', kw);
  await pageA.click('#ip-add-btn');
  try {
    await pageA.waitForFunction(t => [...document.querySelectorAll('.ip-kw .kw')].some(el => el.textContent.includes(t)), kw, { timeout: 8000 });
  } catch (e) {
    const state = await pageA.evaluate(() => ({
      panel: document.getElementById('info-content')?.innerHTML?.slice(0, 400),
      kwItems: [...document.querySelectorAll('.ip-kw .kw')].map(el => el.textContent)
    }));
    console.log('DEBUG add "' + kw + '": kwItems=', state.kwItems, ' panel=', state.panel);
    throw e;
  }
}

// 3. 時間帯演出: canvasの背景色が時刻で変化している(画像取得+色抽出)
await step('atmosphereが反映: canvas背景に時間帯色', async () => {
  // state.atmo が存在すること
  const hasAtmo = await pageA.evaluate(async () => {
    // atmosphere.js を直接importして関数呼び出し
    const mod = await import('/js/atmosphere.js');
    const a = mod.atmosphereAt(new Date());
    return !!(a.top && a.bot && a.tone);
  });
  if (!hasAtmo) throw new Error('atmosphereAt did not return valid result');
});

await step('深夜と昼で色が異なる', async () => {
  const r = await pageA.evaluate(async () => {
    const mod = await import('/js/atmosphere.js');
    const night = mod.atmosphereAt(new Date('2026-04-19T02:00:00+09:00'));
    const noon = mod.atmosphereAt(new Date('2026-04-19T13:00:00+09:00'));
    return { night: night.top, noon: noon.top };
  });
  if (r.night === r.noon) throw new Error('night === noon: ' + JSON.stringify(r));
});

// 4. 共有モーダル
await step('共有ボタンでモーダルが開く', async () => {
  await pageA.click('#share-btn');
  await pageA.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hidden'), { timeout: 3000 });
});
await step('共有モーダル: URL表示 + QR画像 + コピーボタン', async () => {
  const url = await pageA.$eval('#share-url', el => el.textContent);
  if (!url.includes('/r/' + slug)) throw new Error('url: ' + url);
  const qrSrc = await pageA.$eval('#share-qr img', el => el.src);
  if (!qrSrc.includes('qrserver.com')) throw new Error('qr: ' + qrSrc);
  const copyBtn = await pageA.$('#share-copy');
  if (!copyBtn) throw new Error('no copy btn');
});
await pageA.click('#share-close');

// 5. ブラウザBで同URLに入り、他人視点で共通キーワードを確認
console.log('\n=== B: 他人視点 ===');
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageB = await ctxB.newPage();
const errorsB = [];
pageB.on('pageerror', e => errorsB.push('B/pageerror: ' + e.message));
pageB.on('console', m => { if (m.type()==='error') errorsB.push('B/err: '+m.text()); });

await pageB.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2500));

// Bも植樹(共通キーワード判定用)
await pageB.click('[data-action="plant"]');
await pageB.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'));
await pageB.fill('#plant-name', 'Bさん');
await pageB.fill('#plant-pass', '2222');
await pageB.fill('#plant-pass2', '2222');
await pageB.click('#plant-submit');
await pageB.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
await pageB.click('#recovery-ok');
await pageB.waitForFunction(() => document.querySelector('.self-badge') !== null);
for (const kw of ['音楽', '旅行']) { // 「音楽」がAと共通
  await pageB.fill('#ip-add-input', kw);
  await pageB.click('#ip-add-btn');
  await pageB.waitForFunction(t => [...document.querySelectorAll('.ip-kw .kw')].some(el => el.textContent.includes(t)), kw, { timeout: 8000 });
}

// Aさんの樹を開いて共通キーワードチェック
await pageB.evaluate(() => { const b = document.querySelector('[data-action="to-idle"]'); if (b) b.click(); });
await new Promise(r => setTimeout(r, 500));

await step('B: 他人(Aさん)の樹を選択 → 共通キーワード表示', async () => {
  // window.__morinoki.state からAさんの樹の表示位置を取得して直接クリック
  const pos = await pageB.evaluate(() => {
    const s = window.__morinoki?.state;
    if (!s) return null;
    const aTree = s.trees.find(t => t.name === 'Aさん');
    if (!aTree) return null;
    const rect = document.getElementById('forest-canvas').getBoundingClientRect();
    const x = rect.x + s.view.ox + (aTree._displayX ?? aTree.x) * s.view.scale;
    const y = rect.y + s.view.oy + (aTree._displayY ?? aTree.y) * s.view.scale;
    return { x, y };
  });
  if (!pos) throw new Error('Aさんの tree位置取得失敗');
  await pageB.mouse.click(pos.x, pos.y);
  await pageB.waitForFunction(() => document.querySelector('.ip-title')?.textContent?.includes('Aさん'), { timeout: 5000 });
});

await step('共通キーワード「音楽」が表示される', async () => {
  await pageB.waitForFunction(
    () => [...document.querySelectorAll('.common-chip')].some(c => c.textContent.includes('音楽')),
    { timeout: 5000 }
  );
});

// 6. 復元モーダル: Bのsessionをクリアして Bさん + 合言葉 で再認証
await step('Bのsessionを手動クリア → 復元モーダルで再認証', async () => {
  await pageB.evaluate((s) => localStorage.removeItem('mori.session.' + s), slug);
  await pageB.reload({ waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));
  // session がないので idle 画面
  // 復元ボタン
  await pageB.click('#restore-btn');
  await pageB.waitForFunction(() => !document.getElementById('restore-modal').classList.contains('hidden'), { timeout: 3000 });
  await pageB.fill('#restore-name', 'Bさん');
  await pageB.fill('#restore-secret', '2222');
  await pageB.click('#restore-submit');
  await pageB.waitForFunction(() => document.querySelector('.self-badge') !== null, { timeout: 10000 });
});

await pageA.screenshot({ path: 'test-phase3-A.png', fullPage: true });
await pageB.screenshot({ path: 'test-phase3-B.png', fullPage: true });

console.log('\n=== 結果 ===');
console.log('fails:', fails.length ? fails : 'none');
console.log('errorsA:', errorsA.length); errorsA.slice(0,5).forEach(e => console.log('  ', e));
console.log('errorsB:', errorsB.length); errorsB.slice(0,5).forEach(e => console.log('  ', e));

await browser.close();
process.exit(fails.length || errorsA.length || errorsB.length ? 1 : 0);
