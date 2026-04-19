// Phase 5 E2E: 季節テーマ / 散歩モード / タイムラプス
import { chromium } from './node_modules/playwright/index.mjs';

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

const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageA = await ctxA.newPage();
const errorsA = [];
pageA.on('pageerror', e => errorsA.push('A: ' + e.message));
pageA.on('console', m => { if (m.type()==='error') errorsA.push('A/err: ' + m.text()); });

// 1. Setup: 森作成 + 2名植樹
console.log('=== setup ===');
await pageA.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'p5-' + Math.random().toString(36).slice(2, 7);
await pageA.fill('#forest-name', 'P5森');
await pageA.fill('#forest-slug', slug);
await pageA.click('button[type=submit]');
await pageA.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
const forestUrl = BASE.includes('vercel.app')
  ? await pageA.$eval('#created-url', el => el.textContent)
  : `${BASE}/room.html?slug=${slug}`;

await pageA.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));

// Aが植樹
await pageA.click('[data-action="plant"]');
await pageA.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'));
await pageA.fill('#plant-name', 'Aさん');
await pageA.fill('#plant-pass', '1111');
await pageA.fill('#plant-pass2', '1111');
await pageA.click('#plant-submit');
await pageA.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
await pageA.click('#recovery-ok');
await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null);
for (const kw of ['音楽', '読書']) {
  await pageA.fill('#ip-add-input', kw);
  await pageA.click('#ip-add-btn');
  await pageA.waitForFunction(t => [...document.querySelectorAll('.ip-kw .kw')].some(el => el.textContent.includes(t)), kw, { timeout: 8000 });
}

// ブラウザBで同じ森に2人目を植樹
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageB = await ctxB.newPage();
await pageB.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));
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

// ===== 1. 季節テーマ =====
console.log('\n=== 季節テーマ ===');
await step('atmosphere: 季節プロパティが返る', async () => {
  const r = await pageA.evaluate(async () => {
    const mod = await import('/js/atmosphere.js');
    return mod.atmosphereAt(new Date());
  });
  if (!r.season || !r.seasonName) throw new Error('no season: ' + JSON.stringify(r));
  console.log('      current season:', r.season, r.seasonName);
});
await step('atmosphere: 春/夏/秋/冬で seasonName が違う', async () => {
  const r = await pageA.evaluate(async () => {
    const mod = await import('/js/atmosphere.js');
    return {
      spring: mod.atmosphereAt(new Date('2026-04-15T12:00:00')).seasonName,
      summer: mod.atmosphereAt(new Date('2026-07-15T12:00:00')).seasonName,
      autumn: mod.atmosphereAt(new Date('2026-10-15T12:00:00')).seasonName,
      winter: mod.atmosphereAt(new Date('2026-01-15T12:00:00')).seasonName,
    };
  });
  const s = new Set(Object.values(r));
  if (s.size !== 4) throw new Error('not 4 seasons: ' + JSON.stringify(r));
});

// ===== 2. 散歩モード =====
console.log('\n=== 散歩モード ===');
// Bの画面で 他人(Aさん)の樹を選択
await step('B: Aさんの樹を選ぶ', async () => {
  const pos = await pageB.evaluate(() => {
    const s = window.__morinoki?.state;
    const a = s.trees.find(t => t.name === 'Aさん');
    const rect = document.getElementById('forest-canvas').getBoundingClientRect();
    return {
      x: rect.x + s.view.ox + (a._displayX ?? a.x) * s.view.scale,
      y: rect.y + s.view.oy + (a._displayY ?? a.y) * s.view.scale
    };
  });
  await pageB.mouse.click(pos.x, pos.y);
  await pageB.waitForFunction(() => document.querySelector('.ip-title')?.textContent?.includes('Aさん'), { timeout: 5000 });
});
await step('散歩ボタンが表示される(近くの樹あり)', async () => {
  await pageB.waitForSelector('[data-action="walk"]', { timeout: 3000 });
});
// ※ Aさんのほかに他人の樹が1本しかない(Bさん自身は除外)ので、散歩ボタンを押しても遷移先が無く次の樹が無い可能性あり
// そこで第3の樹を追加してから検証
const ctxC = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageC = await ctxC.newPage();
await pageC.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 1500));
await pageC.click('[data-action="plant"]');
await pageC.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'));
await pageC.fill('#plant-name', 'Cさん');
await pageC.fill('#plant-pass', '3333');
await pageC.fill('#plant-pass2', '3333');
await pageC.click('#plant-submit');
await pageC.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
await pageC.click('#recovery-ok');
await pageC.waitForFunction(() => document.querySelector('.self-badge') !== null);
await pageC.fill('#ip-add-input', '音楽');
await pageC.click('#ip-add-btn');
await pageC.waitForFunction(() => [...document.querySelectorAll('.ip-kw .kw')].some(el => el.textContent.includes('音楽')), { timeout: 8000 });
await ctxC.close();

// Bページで散歩ボタンを押す → 次の樹(CさんかAさんの非選択側)に移動
await step('散歩で次の樹へ遷移', async () => {
  // realtimeが遅い場合はリロードで強制反映
  await pageB.reload({ waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));
  // Aさんを再度選択
  const pos = await pageB.evaluate(() => {
    const s = window.__morinoki?.state;
    const a = s.trees.find(t => t.name === 'Aさん');
    const rect = document.getElementById('forest-canvas').getBoundingClientRect();
    return {
      x: rect.x + s.view.ox + (a._displayX ?? a.x) * s.view.scale,
      y: rect.y + s.view.oy + (a._displayY ?? a.y) * s.view.scale
    };
  });
  await pageB.mouse.click(pos.x, pos.y);
  await pageB.waitForFunction(() => document.querySelector('.ip-title')?.textContent?.includes('Aさん'), { timeout: 5000 });
  await pageB.waitForSelector('[data-action="walk"]', { timeout: 3000 });
  // トータル state.trees の確認
  const treeCount = await pageB.evaluate(() => window.__morinoki?.state?.trees?.length);
  if (treeCount < 3) throw new Error('trees: ' + treeCount);
  // Walk
  await pageB.click('[data-action="walk"]');
  await pageB.waitForFunction(() => {
    const t = document.querySelector('.ip-title')?.textContent || '';
    return t && !t.includes('Aさん');
  }, { timeout: 5000 });
});

// ===== 3. タイムラプス =====
console.log('\n=== タイムラプス ===');
// idle に戻る
await pageA.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
await new Promise(r => setTimeout(r, 500));

await step('タイムラプスボタンが表示される', async () => {
  await pageA.waitForSelector('[data-action="timelapse"]', { timeout: 3000 });
});
await step('タイムラプスが起動してslider/playが表示', async () => {
  await pageA.click('[data-action="timelapse"]');
  await pageA.waitForFunction(() => !document.getElementById('timelapse-bar').classList.contains('hidden'), { timeout: 3000 });
});
await step('sliderを動かすとtimeCursorが変わり森が変化', async () => {
  const initial = await pageA.evaluate(() => window.__morinoki?.state?.timeCursor);
  await pageA.evaluate(() => {
    const s = document.getElementById('tl-slider');
    s.value = 500;
    s.dispatchEvent(new Event('input'));
  });
  await new Promise(r => setTimeout(r, 400));
  const after = await pageA.evaluate(() => window.__morinoki?.state?.timeCursor);
  if (initial === after) throw new Error('cursor did not move');
});
await step('閉じるでtimeCursorがnullに戻る', async () => {
  await pageA.click('#tl-close');
  await new Promise(r => setTimeout(r, 400));
  const c = await pageA.evaluate(() => window.__morinoki?.state?.timeCursor);
  if (c !== null && c !== undefined) throw new Error('cursor not cleared: ' + c);
});

await pageA.screenshot({ path: 'test-phase5-A.png', fullPage: true });

console.log('\n=== 結果 ===');
console.log('fails:', fails.length ? fails : 'none');
console.log('errors:', errorsA.length); errorsA.slice(0,5).forEach(e => console.log('  ', e));

await browser.close();
process.exit(fails.length || errorsA.length ? 1 : 0);
