// 鳥と小動物を強制spawnしてスクショ
import { chromium } from './node_modules/playwright/index.mjs';
const BASE = 'https://morinokki.vercel.app';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

// 新規森+植樹
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'cr-' + Math.random().toString(36).slice(2, 6);
await page.fill('#forest-name', '生き物テスト');
await page.fill('#forest-slug', slug);
await page.click('button[type=submit]');
await page.waitForSelector('#created:not(.hidden)', { timeout: 20000 });

await page.goto(BASE + '/r/' + slug, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));
await page.fill('#auth-name', 'みき');
await page.fill('#auth-pass', '1234');
await page.click('[data-action="auth-submit"]');
await page.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
await page.click('#recovery-ok');
await page.waitForSelector('.self-badge');
for (const kw of ['絵', '映画', 'カフェ']) {
  await page.fill('#ip-add-input', kw);
  await page.click('#ip-add-btn');
  await new Promise(r => setTimeout(r, 800));
}
// idle
await page.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
await new Promise(r => setTimeout(r, 1000));

// forest.js 内部のcrittersインスタンスに強制spawn(私用)。
// forest.js の createForest が returns した forest オブジェクトに critters を expose していないため、
// state.forest.render が呼ばれるたびに自然発生を待つしかない。
// 15〜30秒後に鳥、25〜50秒後に動物が出る設計。
// テスト用にすぐ観察できるように、forest内の閾値を一時的に時間を進めて鳥を強制生成:
await page.evaluate(() => {
  // forest closure内のtは外から触れないので、代替: 鳥/動物を挿入する関数を公開していないため
  // ここでは「時間が進むように」renderを何度も呼ぶ
  // わざとtickを多く進める: 20秒分ぐらい
  const f = window.__morinoki?.forest;
  if (!f) return;
  // 手動でtickを20回呼ぶのはできないので、待つだけにする
});

// 30秒待って鳥を期待
await new Promise(r => setTimeout(r, 30000));
await page.screenshot({ path: 'design-critters.png' });
console.log('saved: design-critters.png');

await browser.close();
