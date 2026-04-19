// v3: 左常駐パネル + 幹大型化 + 自分の樹強調 + 孫ノード + 一人一樹
import { chromium } from './node_modules/playwright/index.mjs';

const BASE = process.env.TARGET_BASE || 'http://localhost:8765';
const SKIP_SUBNODE = process.env.SKIP_SUBNODE === '1';

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
pageA.on('pageerror', e => errorsA.push('pageerror: ' + e.message));
pageA.on('console', m => { if (m.type() === 'error') errorsA.push('console.error: ' + m.text()); });

// 1. 森作成
console.log('=== 森作成 ===');
await pageA.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
const slug = 'v3-' + Math.random().toString(36).slice(2, 7);
await pageA.fill('#forest-name', 'v3テスト森');
await pageA.fill('#forest-slug', slug);
await pageA.click('button[type=submit]');
await pageA.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
const forestUrl = BASE.includes('vercel.app')
  ? await pageA.$eval('#created-url', el => el.textContent)
  : `${BASE}/room.html?slug=${slug}`;

// 2. 森に入る
console.log('\n=== 森に入る ===');
await pageA.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 1500));

await step('左常駐パネル表示', async () => {
  const visible = await pageA.$eval('#info-panel', el => el.offsetWidth > 100);
  if (!visible) throw new Error('info panel not visible');
});
await step('idle状態で plant ボタンが表示されている', async () => {
  const btnText = await pageA.textContent('[data-action="plant"]').catch(() => null);
  if (!btnText?.includes('植える')) throw new Error('no plant action');
});

// 3. 植樹
await step('植樹 → 左パネルが自分の樹に切替', async () => {
  await pageA.click('[data-action="plant"]');
  await pageA.waitForFunction(() => !document.getElementById('plant-modal').classList.contains('hidden'));
  await pageA.fill('#plant-name', 'さくら');
  await pageA.fill('#plant-pass', '4444');
  await pageA.fill('#plant-pass2', '4444');
  await pageA.click('#plant-submit');
  await pageA.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
  await pageA.click('#recovery-ok');
  // 自分の樹パネルに「自分の樹」バッジが出る
  await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null, { timeout: 5000 });
});

// 4. ノード追加(左パネル内)
for (const kw of ['音楽', '読書', '旅行']) {
  await step(`add "${kw}"`, async () => {
    await pageA.fill('#ip-add-input', kw);
    await pageA.click('#ip-add-btn');
    await pageA.waitForFunction(t => [...document.querySelectorAll('.ip-kw .kw')].some(el => el.textContent.includes(t)), kw, { timeout: 8000 });
  });
}

// 5. 一人一樹制約: 植えるボタンが「自分の樹」に変わり、再度押しても新規植樹にならない
await step('plant-btn が「自分の樹」表示に切替', async () => {
  const mode = await pageA.$eval('#plant-btn', el => el.dataset.mode);
  if (mode !== 'self') throw new Error('mode: ' + mode);
});
await step('再度plant-btnを押しても植樹モーダルは出ない', async () => {
  await pageA.click('#plant-btn');
  await new Promise(r => setTimeout(r, 600));
  const modalOpen = await pageA.$eval('#plant-modal', el => !el.classList.contains('hidden'));
  if (modalOpen) throw new Error('plant-modal opened');
});

// 6. ノードクリック(左パネル内)→ 編集モード
await step('キーワードクリックで編集モード', async () => {
  await pageA.click('.ip-kw:first-child');
  await pageA.waitForSelector('#nf-save', { timeout: 3000 });
});

// 7. 説明+サイズ変更
await step('説明とサイズ変更を保存', async () => {
  await pageA.fill('#nf-desc', 'ジャズとバッハが好き');
  await pageA.click('#nf-size button[data-size="5"]');
  await pageA.click('#nf-save');
  // 自分の樹パネルに戻ることは保証されていないが、保存後も同じノードedit状態
  await new Promise(r => setTimeout(r, 800));
});

// 8. 孫ノード追加(migration 003 が必要)
if (!SKIP_SUBNODE) {
  await step('孫ノード「ジャズ」を追加', async () => {
    // 念のため編集モード再表示(音楽キーワードをpanelから再選択)
    // 現在は #nf-save 後、ノード編集状態のはず(ownNodeHTMLに「子のキーワード」セクション)
    const hasSubUI = await pageA.$('#nf-sub-input');
    if (!hasSubUI) {
      // 戻って再選択
      const back = await pageA.$('[data-action="back"]');
      if (back) await back.click();
      await pageA.waitForSelector('.ip-kw');
      await pageA.click('.ip-kw:first-child');
      await pageA.waitForSelector('#nf-sub-input', { timeout: 3000 });
    }
    await pageA.fill('#nf-sub-input', 'ジャズ');
    await pageA.click('#nf-sub-btn');
    // 孫がsublistに現れる
    await pageA.waitForFunction(() => [...document.querySelectorAll('.ip-sub-list li')].some(li => li.textContent.includes('ジャズ')), { timeout: 8000 });
  });
}

// 9. 幹タップで自分の樹詳細(既にパネル上にあるはずだが、別の方法で確認)
await step('「← 森へ戻る」でidleに戻る', async () => {
  // back → ownTree → 森へ戻る
  const backs = await pageA.$$('[data-action="back"], [data-action="to-idle"]');
  if (backs.length) {
    for (let i = 0; i < 5; i++) {
      const b = await pageA.$('[data-action="to-idle"]');
      if (b) { await b.click(); break; }
      const bb = await pageA.$('[data-action="back"]');
      if (bb) { await bb.click(); await new Promise(r => setTimeout(r,300)); continue; }
      break;
    }
  }
  await new Promise(r => setTimeout(r, 500));
});

// 10. 他人視点
console.log('\n=== 他人視点 ===');
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageB = await ctxB.newPage();
const errorsB = [];
pageB.on('pageerror', e => errorsB.push('pageerror: ' + e.message));
pageB.on('console', m => { if (m.type() === 'error') errorsB.push('console.error: ' + m.text()); });

await pageB.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));

await step('他人視点: idle状態で plant が表示 + 樹一覧確認', async () => {
  const plantBtn = await pageB.$('[data-action="plant"]');
  if (!plantBtn) throw new Error('plant-btn missing');
});

await step('他人視点: canvasで樹(幹)タップ → 他人の樹詳細パネル表示', async () => {
  const bb = await pageB.$eval('#forest-canvas', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; });
  await pageB.mouse.click(bb.x, bb.y);
  await pageB.waitForFunction(() => document.querySelector('.ip-title')?.textContent?.includes('さくら'), { timeout: 5000 });
});

await step('他人視点: 編集UIは出ない(ip-add-btnが存在しない)', async () => {
  const hasAdd = await pageB.$('#ip-add-btn');
  if (hasAdd) throw new Error('add button visible for other');
});

await step('他人視点: キーワードクリックでノード詳細(説明が見える)', async () => {
  await pageB.click('.ip-kw:first-child');
  await pageB.waitForSelector('.ip-desc-box', { timeout: 3000 });
  const desc = await pageB.textContent('.ip-desc-box');
  if (!desc.includes('ジャズ')) throw new Error('desc: ' + desc);
});

// Screenshot
await pageA.screenshot({ path: 'test-v3-A.png', fullPage: true });
await pageB.screenshot({ path: 'test-v3-B.png', fullPage: true });

console.log('\n=== 結果 ===');
console.log('fails:', fails.length ? fails : 'none');
console.log('errorsA:', errorsA.length);
errorsA.slice(0,10).forEach(e => console.log('  ', e));
console.log('errorsB:', errorsB.length);
errorsB.slice(0,10).forEach(e => console.log('  ', e));

await browser.close();
process.exit(fails.length || errorsA.length || errorsB.length ? 1 : 0);
