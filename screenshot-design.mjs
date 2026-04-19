// 新デザインのスクショ
import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'https://morinoki.vercel.app';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// 既存の森に入る(最近作られたテスト森を使う)
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'viz-' + Math.random().toString(36).slice(2, 6);
await page.fill('#forest-name', 'ビジュアル');
await page.fill('#forest-slug', slug);
await page.click('button[type=submit]');
await page.waitForSelector('#created:not(.hidden)', { timeout: 20000 });

// 1人植樹 + 複数キーワード + 孫
await page.goto(BASE + '/r/' + slug, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));
await page.fill('#auth-name', 'さくら');
await page.fill('#auth-pass', '1111');
await page.click('[data-action="auth-submit"]');
await page.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
await page.click('#recovery-ok');
await page.waitForSelector('.self-badge', { timeout: 5000 });

for (const kw of ['音楽', '読書', '旅行', 'パン作り', 'キャンプ']) {
  await page.fill('#ip-add-input', kw);
  await page.click('#ip-add-btn');
  await new Promise(r => setTimeout(r, 800));
}

// 鳥/動物を強制生成
await page.evaluate(() => {
  // forest.js のクリッターズにアクセス(window越しに無理なら、時間で待つ)
  // 既存のctick上では15-30秒ごとに鳥が出るので、ここでは時間待ち
});

// 数秒ゆらぎを動作させる
await new Promise(r => setTimeout(r, 3500));

// idle に戻って全体観察
await page.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
await new Promise(r => setTimeout(r, 2000));

await page.screenshot({ path: 'design-preview.png' });
console.log('saved: design-preview.png');
await browser.close();
