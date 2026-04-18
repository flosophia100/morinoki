// Playwright headless Chromium で実ブラウザテスト
// Run: node test-browser.mjs
// http://localhost:8765 で http-server が動いている前提
import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'http://localhost:8765';
let fails = 0;

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', e => pageErrors.push(e.message));

async function step(name, fn) {
  try { await fn(); console.log(`  OK  ${name}`); }
  catch (e) { fails++; console.log(`  FAIL ${name}: ${e.message}`); }
}

// =========== test.html (unit tests in real browser) ===========
console.log('=== test.html (unit) ===');
consoleErrors.length = 0; pageErrors.length = 0;
await page.goto(BASE + '/test.html', { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('out').textContent.includes('ALL PASS') || document.getElementById('out').textContent.includes('FAILURES'),
  { timeout: 5000 });

const resultText = await page.$eval('#out', el => el.textContent);
await step('test.html browser tests pass', () => {
  if (!resultText.includes('ALL PASS')) throw new Error('Got: ' + resultText.split('\n').slice(-3).join(' / '));
});
const browserFailCount = (resultText.match(/✗/g) || []).length;
await step('no ✗ marks', () => { if (browserFailCount > 0) throw new Error(`${browserFailCount} marks`); });

// =========== index.html ===========
console.log('\n=== index.html (structure + script load) ===');
consoleErrors.length = 0; pageErrors.length = 0;
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

await step('index title', async () => {
  const t = await page.title();
  if (!t.includes('森')) throw new Error('title: ' + t);
});
await step('index slug auto-fill', async () => {
  const slug = await page.$eval('#forest-slug', el => el.value);
  if (!slug || slug.length < 3) throw new Error('slug: ' + slug);
});
await step('index no page errors', () => {
  // Supabase未設定警告のみ許容
  const fatal = pageErrors.filter(e => !e.includes('SUPABASE_CONFIG'));
  if (fatal.length) throw new Error(fatal.join(' / '));
});
await step('index form submit shows error (Supabase未設定)', async () => {
  await page.fill('#forest-name', 'テスト森');
  await page.fill('#forest-slug', 'test-forest-xxx');
  await page.click('button[type=submit]');
  await page.waitForSelector('#error:not(.hidden)', { timeout: 3000 });
  const msg = await page.$eval('#error', el => el.textContent);
  if (!msg) throw new Error('error message empty');
});

// =========== room.html (no slug in URL → alert) ===========
console.log('\n=== room.html (direct open without /r/:slug) ===');
consoleErrors.length = 0; pageErrors.length = 0;

// alertをキャプチャ
let alertMsg = null;
page.once('dialog', async d => { alertMsg = d.message(); await d.dismiss(); });
await page.goto(BASE + '/room.html', { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 800));
await step('room.html alerts when slug missing', () => {
  if (!alertMsg || !alertMsg.includes('ルーム')) throw new Error('expected alert, got: ' + alertMsg);
});

// =========== room.html with slug (Supabase未設定 → room not found) ===========
console.log('\n=== room.html (with slug but no supabase) ===');
consoleErrors.length = 0; pageErrors.length = 0;
alertMsg = null;
page.on('dialog', async d => { alertMsg = d.message(); await d.dismiss(); });
await page.goto(BASE + '/room.html?slug=nonexistent', { waitUntil: 'commit' });
// DNS失敗やSupabaseエラーが出るまで最大10秒待つ
for (let i = 0; i < 50 && !alertMsg; i++) await new Promise(r => setTimeout(r, 200));
await step('room.html eventually alerts on missing room', () => {
  if (!alertMsg) throw new Error('no alert within 10s (OK: supabase may be blocked by corp firewall)');
});

await browser.close();

console.log('');
console.log(fails === 0 ? 'BROWSER TESTS: ALL PASS' : `BROWSER TESTS: ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
