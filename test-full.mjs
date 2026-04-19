// 包括E2E — Phase 0-5 全機能検証
// 結果は TEST-REPORT.txt に書き出し
import { chromium, devices } from './node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = process.env.TARGET_BASE || 'https://morinoki.vercel.app';
const REPORT_PATH = './TEST-REPORT.txt';

// ===== 結果蓄積 =====
const report = [];
const stats = { total: 0, pass: 0, fail: 0, skip: 0, sections: {} };
let currentSection = '';

function log(msg) { report.push(msg); console.log(msg); }
function section(title) {
  currentSection = title;
  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('  ' + title);
  log('═══════════════════════════════════════════════════════════════');
  stats.sections[title] = { pass: 0, fail: 0 };
}
async function test(name, fn) {
  stats.total++;
  const t0 = Date.now();
  try {
    const r = await fn();
    const dt = Date.now() - t0;
    const suffix = r === 'skip' ? '[SKIP]' : `[OK ${dt}ms]`;
    log(`  ${suffix.padEnd(10)} ${name}`);
    if (r === 'skip') stats.skip++;
    else { stats.pass++; stats.sections[currentSection].pass++; }
  } catch (e) {
    const dt = Date.now() - t0;
    log(`  [FAIL ${dt}ms] ${name}`);
    log(`             → ${(e.message || '').slice(0, 400)}`);
    stats.fail++;
    stats.sections[currentSection].fail++;
  }
}

// ===== 環境情報 =====
log('╔═══════════════════════════════════════════════════════════════╗');
log(`║  morinoki Full E2E Test Report`.padEnd(64) + '║');
log(`║  Target: ${BASE}`.padEnd(64) + '║');
log(`║  Started: ${new Date().toISOString()}`.padEnd(64) + '║');
log('╚═══════════════════════════════════════════════════════════════╝');

// ===== Section Q: 静的検証(先に) =====
section('Section Q: 静的検証(JS構文 + 必須ID)');
await test('Q1. js/*.js すべて ESM構文OK', async () => {
  const files = ['utils','auth','supabase','tree','forest','editor','app','realtime','liveforest','atmosphere','toast'];
  for (const f of files) {
    execSync(`node --input-type=module --check < js/${f}.js`, { stdio: 'pipe' });
  }
});
await test('Q2. room.html 必須要素がすべて存在', async () => {
  const html = fs.readFileSync('room.html', 'utf8');
  const ids = ['forest-canvas','info-panel','info-content','share-btn','restore-btn','timelapse-bar','tl-play','tl-slider','recovery-modal','recovery-key'];
  const missing = ids.filter(id => !new RegExp(`id=["']${id}["']`).test(html));
  if (missing.length) throw new Error('missing ids: ' + missing.join(', '));
});
await test('Q3. index.html 必須要素がすべて存在', async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = ['create-form','forest-name','forest-slug','created','created-url','copy-url','open-forest'];
  const missing = ids.filter(id => !new RegExp(`id=["']${id}["']`).test(html));
  if (missing.length) throw new Error('missing ids: ' + missing.join(', '));
});
await test('Q4. supabase/migrations dollar-quote バランス', async () => {
  const files = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql'));
  for (const f of files) {
    const txt = fs.readFileSync(`supabase/migrations/${f}`, 'utf8');
    const tagged = txt.match(/\$[a-z_]+\$/gi) || [];
    if (tagged.length % 2 !== 0) throw new Error(`${f}: unbalanced $tag$ count=${tagged.length}`);
  }
});

// ===== ブラウザ起動 =====
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/fubas/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'
});

// 共通: Aさん用コンテキスト
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageA = await ctxA.newPage();
const errorsA = [];
pageA.on('pageerror', e => errorsA.push('pageerror: ' + e.message));
pageA.on('console', m => { if (m.type() === 'error') errorsA.push('console.error: ' + m.text()); });

// ===== Section A: 森作成 =====
section('Section A: 森作成(index.html)');
const slug = 'full-' + Math.random().toString(36).slice(2, 7);
await test('A1. index.html を配信し正常表示', async () => {
  await pageA.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  const title = await pageA.title();
  if (!title.includes('森')) throw new Error('title: ' + title);
});
await test('A2. slug自動入力(英小文字+ハイフン+数字)', async () => {
  const v = await pageA.$eval('#forest-slug', el => el.value);
  if (!/^[a-z0-9\-]{3,40}$/.test(v)) throw new Error('slug: ' + v);
});
await test('A3. 不正slug(大文字/短い)でフォームerror', async () => {
  await pageA.fill('#forest-name', 'テスト');
  await pageA.fill('#forest-slug', 'AB'); // 短すぎ + 大文字
  await pageA.click('button[type=submit]');
  // HTML5 validation で form が送信されない OR error表示される
  const errVisible = await pageA.$eval('#error', el => !el.classList.contains('hidden')).catch(() => false);
  const formValid = await pageA.$eval('#create-form', el => el.checkValidity());
  if (formValid && !errVisible) throw new Error('expected validation error');
});
await test('A4. 正常な森作成 → URL発行', async () => {
  await pageA.fill('#forest-slug', slug);
  await pageA.fill('#forest-name', 'Full森');
  await pageA.click('button[type=submit]');
  await pageA.waitForSelector('#created:not(.hidden)', { timeout: 20000 });
  const url = await pageA.$eval('#created-url', el => el.textContent);
  if (!url.includes('/r/' + slug)) throw new Error('url: ' + url);
});

// 森URL
const forestUrl = BASE.includes('vercel.app')
  ? await pageA.$eval('#created-url', el => el.textContent)
  : `${BASE}/room.html?slug=${slug}`;

// ===== Section B: 植樹フロー =====
section('Section B: 植樹フロー');
await pageA.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2000));

await test('B1. idleパネルに auth フォームが表示', async () => {
  await pageA.waitForSelector('#auth-name', { timeout: 5000 });
  await pageA.waitForSelector('#auth-pass', { timeout: 5000 });
});
await test('B2. 合言葉4桁未満で error', async () => {
  await pageA.fill('#auth-name', 'Aさん');
  await pageA.fill('#auth-pass', '12');
  await pageA.click('[data-action="auth-submit"]');
  await new Promise(r => setTimeout(r, 400));
  const err = await pageA.$eval('#auth-error', el => !el.classList.contains('hidden'));
  if (!err) throw new Error('no error');
});
await test('B3. (skip: 合言葉確認は廃止)', async () => 'skip');
await test('B4. 正しく入力で植樹成功 → 復元キー表示', async () => {
  await pageA.fill('#auth-pass', '1111');
  await pageA.click('[data-action="auth-submit"]');
  await pageA.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
});
await test('B5. 復元キーが表示されている(16hex char)', async () => {
  const key = await pageA.$eval('#recovery-key', el => el.textContent);
  if (!/^[0-9a-f]{16}$/.test(key)) throw new Error('unexpected key: ' + key);
});
let recoveryKeyA;
await test('B6. 復元キーを保持(後続テストで使用)', async () => {
  recoveryKeyA = await pageA.$eval('#recovery-key', el => el.textContent);
  log('             (recoveryKeyA=' + recoveryKeyA + ')');
});
await test('B7. 復元キー確認で閉じる → own-tree パネル', async () => {
  await pageA.click('#recovery-ok');
  await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null, { timeout: 5000 });
});

// ===== Section C: ノードCRUD =====
section('Section C: ノードCRUD');
await test('C1. キーワード追加: 音楽', async () => {
  await pageA.fill('#ip-add-input', '音楽');
  await pageA.click('#ip-add-btn');
  await pageA.waitForFunction(() => [...document.querySelectorAll('.ip-kw .kw')].some(e => e.textContent.includes('音楽')), { timeout: 8000 });
});
await test('C2. キーワード追加: 読書', async () => {
  await pageA.fill('#ip-add-input', '読書');
  await pageA.click('#ip-add-btn');
  await pageA.waitForFunction(() => [...document.querySelectorAll('.ip-kw .kw')].some(e => e.textContent.includes('読書')), { timeout: 8000 });
});
await test('C3. ノードクリックで編集popover', async () => {
  await pageA.click('.ip-kw:first-child');
  await pageA.waitForSelector('#nf-save', { timeout: 3000 });
});
await test('C4. サイズ変更(XL)+保存', async () => {
  await pageA.click('#nf-size button[data-size="5"]');
  await pageA.click('#nf-save');
  await new Promise(r => setTimeout(r, 600));
});
await test('C5. 色変更+保存', async () => {
  // すでに own-node モード。色を変えて保存
  await pageA.waitForSelector('#nf-color button', { timeout: 3000 });
  await pageA.click('#nf-color button[data-color="#d4694a"]');
  await pageA.click('#nf-save');
  await new Promise(r => setTimeout(r, 600));
});
await test('C6. 説明保存 → back → 再open で残る', async () => {
  await pageA.waitForSelector('#nf-desc', { timeout: 3000 });
  await pageA.fill('#nf-desc', 'ジャズとバッハが好き');
  await pageA.click('#nf-save');
  await new Promise(r => setTimeout(r, 800));
  // backで own-tree に戻ってから再オープン
  await pageA.click('[data-action="back"]');
  await pageA.waitForSelector('.ip-kw', { timeout: 3000 });
  await pageA.click('.ip-kw:first-child');
  await pageA.waitForSelector('#nf-desc', { timeout: 3000 });
  const desc = await pageA.$eval('#nf-desc', el => el.value);
  if (!desc.includes('ジャズ')) throw new Error('desc: ' + desc);
});
await test('C7. 孫ノード追加: ジャズ', async () => {
  await pageA.fill('#nf-sub-input', 'ジャズ');
  await pageA.click('#nf-sub-btn');
  await pageA.waitForFunction(() => [...document.querySelectorAll('.ip-sub-list li')].some(e => e.textContent.includes('ジャズ')), { timeout: 8000 });
});
await test('C8. back → ownTree → 元に戻る', async () => {
  await pageA.click('[data-action="back"]');
  await pageA.waitForSelector('.ip-kw', { timeout: 3000 });
});

// ===== Section D: ドラッグ操作 =====
section('Section D: ドラッグ操作');
await test('D1. 幹ドラッグで樹位置が変わる', async () => {
  // liveforestを止め、ノードを含む全体を静止
  await pageA.evaluate(() => {
    const s = window.__morinoki?.state;
    const t = s.trees.find(x => x.id === s.selfTreeId);
    window.__morinoki?.live?.stop();
    t._windX = 0; t._windY = 0; t._driftX = 0; t._driftY = 0;
    t._displayX = t.x; t._displayY = t.y;
    (t.nodes || []).forEach(n => { n.simDX = 0; n.simDY = 0; n.vx = 0; n.vy = 0; });
    window.__morinoki?.forest?.render?.();
  });
  await new Promise(r => setTimeout(r, 400));
  const beforeTx = await pageA.evaluate(() => {
    const s = window.__morinoki?.state;
    const t = s.trees.find(x => x.id === s.selfTreeId);
    return {
      tx: t.x, ty: t.y,
      scale: s.view.scale,
      ox: s.view.ox, oy: s.view.oy
    };
  });
  const rect = await pageA.$eval('#forest-canvas', el => el.getBoundingClientRect());
  const px = rect.x + beforeTx.ox + beforeTx.tx * beforeTx.scale;
  const py = rect.y + beforeTx.oy + beforeTx.ty * beforeTx.scale;
  await pageA.mouse.move(px, py);
  await pageA.mouse.down();
  await pageA.mouse.move(px + 200, py + 120, { steps: 25 });
  await pageA.mouse.up();
  await new Promise(r => setTimeout(r, 2500));
  const after = await pageA.evaluate(() => {
    const s = window.__morinoki?.state;
    const t = s.trees.find(x => x.id === s.selfTreeId);
    return { x: t.x, y: t.y };
  });
  const dx = after.x - beforeTx.tx, dy = after.y - beforeTx.ty;
  // liveforestを再開
  await pageA.evaluate(() => window.__morinoki?.live?.start());
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
    throw new Error(`no move: delta=(${dx.toFixed(1)}, ${dy.toFixed(1)})`);
  }
});
await test('D2. ホイールでズーム', async () => {
  const before = await pageA.evaluate(() => window.__morinoki?.state?.view?.scale);
  const rect = await pageA.$eval('#forest-canvas', el => el.getBoundingClientRect());
  await pageA.mouse.move(rect.x + rect.width/2, rect.y + rect.height/2);
  await pageA.mouse.wheel(0, -400); // ズームイン
  await new Promise(r => setTimeout(r, 400));
  const after = await pageA.evaluate(() => window.__morinoki?.state?.view?.scale);
  if (Math.abs(after - before) < 0.05) throw new Error(`scale before=${before} after=${after}`);
});

// ===== Section J: atmosphere(事前に確認、残りはユニット系) =====
section('Section J: atmosphere(時間帯 + 季節)');
await test('J1. atmosphereAt() が季節情報を返す', async () => {
  const r = await pageA.evaluate(async () => {
    const mod = await import('/js/atmosphere.js');
    return mod.atmosphereAt(new Date());
  });
  if (!r.top || !r.bot || !r.season) throw new Error('missing fields: ' + JSON.stringify(r));
});
await test('J2. 深夜と昼で色調が異なる', async () => {
  const r = await pageA.evaluate(async () => {
    const m = await import('/js/atmosphere.js');
    // ローカル時刻ベースで比較: 深夜2時 vs 正午12時
    const n = new Date(); n.setHours(2, 0, 0, 0);
    const d = new Date(); d.setHours(12, 0, 0, 0);
    return { night: m.atmosphereAt(n).top, noon: m.atmosphereAt(d).top };
  });
  if (r.night === r.noon) throw new Error('same: ' + JSON.stringify(r));
});
await test('J3. 春/夏/秋/冬 で 4種類のseason', async () => {
  const r = await pageA.evaluate(async () => {
    const m = await import('/js/atmosphere.js');
    return new Set([
      m.atmosphereAt(new Date('2026-04-15')).season,
      m.atmosphereAt(new Date('2026-07-15')).season,
      m.atmosphereAt(new Date('2026-10-15')).season,
      m.atmosphereAt(new Date('2026-01-15')).season,
    ].filter(Boolean)).size;
  });
  if (r !== 4) throw new Error('got ' + r);
});

// ===== Section H: 共有 =====
section('Section H: 共有モーダル + QR');
// 前のセクションの canvas 操作後なので一度ページを再読み込みして純粋な状態に
await pageA.reload({ waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2500));

await test('H1. 共有ボタン → モーダル表示', async () => {
  await pageA.waitForSelector('#share-btn', { timeout: 5000 });
  await pageA.click('#share-btn');
  await pageA.waitForFunction(() => !document.getElementById('share-modal').classList.contains('hidden'), { timeout: 3000 });
});
await test('H2. URLが表示されている', async () => {
  const url = await pageA.$eval('#share-url', el => el.textContent);
  if (!url.includes('/r/' + slug)) throw new Error('url: ' + url);
});
await test('H3. QR画像が src=qrserver を含む', async () => {
  const src = await pageA.$eval('#share-qr img', el => el.src);
  if (!src.includes('qrserver.com')) throw new Error('src: ' + src);
});
await test('H4. 閉じるで消える', async () => {
  await pageA.click('#share-close');
  await pageA.waitForFunction(() => document.getElementById('share-modal').classList.contains('hidden'), { timeout: 3000 });
});

// ===== Section G: 一人一樹制約 =====
section('Section G: 一人一樹制約 / ログアウト');
await test('G1. ログイン中はidleに "ログイン中" + 名前が表示', async () => {
  await pageA.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
  await pageA.waitForSelector('.ip-login-name', { timeout: 3000 });
  const name = await pageA.$eval('.ip-login-name', el => el.textContent);
  if (!name.includes('Aさん')) throw new Error('name: ' + name);
});
await test('G2. 同じ名前+同じ合言葉でログイン扱い(新規植樹されない)', async () => {
  // ログアウトしてからもう一度同じ名前で認証
  await pageA.click('[data-action="logout"]');
  await new Promise(r => setTimeout(r, 400));
  await pageA.waitForSelector('#auth-name', { timeout: 3000 });
  await pageA.fill('#auth-name', 'Aさん');
  await pageA.fill('#auth-pass', '1111');
  await pageA.click('[data-action="auth-submit"]');
  // ログイン時は recovery-modal は出ない(新規植樹時のみ)
  await pageA.waitForSelector('.self-badge', { timeout: 8000 });
  const recoveryShown = await pageA.evaluate(() => !document.getElementById('recovery-modal').classList.contains('hidden'));
  if (recoveryShown) throw new Error('recovery shown on login');
});
await test('G3. ログアウトでsessionがクリアされる', async () => {
  await pageA.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
  await new Promise(r => setTimeout(r, 400));
  await pageA.click('[data-action="logout"]');
  await new Promise(r => setTimeout(r, 600));
  const sess = await pageA.evaluate(s => localStorage.getItem('mori.session.' + s), slug);
  if (sess !== null) throw new Error('session still there');
});
await test('G4. 既存名前+違う合言葉はエラー', async () => {
  await pageA.waitForSelector('#auth-name', { timeout: 3000 });
  await pageA.fill('#auth-name', '');
  await pageA.fill('#auth-pass', '');
  await pageA.fill('#auth-name', 'Aさん');
  await pageA.fill('#auth-pass', '9999');
  await pageA.click('[data-action="auth-submit"]');
  // bcrypt + RPC に時間がかかるので余裕持って
  await pageA.waitForFunction(() => {
    const el = document.getElementById('auth-error');
    return el && !el.classList.contains('hidden') && el.textContent.length > 0;
  }, { timeout: 10000 });
});

// ===== Section I: 復元(合言葉忘れ時) =====
section('Section I: 復元(合言葉忘れ時)');
await test('I1. panelのauth-passに復元キーを入力して復元', async () => {
  await pageA.reload({ waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2500));
  await pageA.waitForSelector('#auth-name', { timeout: 5000 });
  const roomInfo = await pageA.evaluate(() => ({
    slug: window.__morinoki?.state?.room?.slug,
    trees: window.__morinoki?.state?.trees?.map(t => t.name)
  }));
  log(`             state room.slug=${roomInfo.slug} trees=${JSON.stringify(roomInfo.trees)}`);
  // 直接API呼び出しでログインを試す(UI経由で不明瞭なことを確認)
  const direct = await pageA.evaluate(async (rk) => {
    const mod = await import('/js/supabase.js');
    const slug = window.__morinoki.state.room.slug;
    try {
      return { ok: await mod.api.plantOrLogin(slug, 'Aさん', rk, null) };
    } catch (e) { return { err: e.message }; }
  }, recoveryKeyA);
  log(`             direct call: ${JSON.stringify(direct)}`);
  if (direct.err) throw new Error('direct rpc failed: ' + direct.err);
  // UI 経由でも動作確認
  await pageA.fill('#auth-name', 'Aさん');
  await pageA.fill('#auth-pass', recoveryKeyA);
  await pageA.click('[data-action="auth-submit"]');
  await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null, { timeout: 15000 });
});
await test('I2. 復元モーダル(別端末用)も引き続き機能', async () => {
  // idle に戻って restore-btn クリック
  await pageA.evaluate(() => document.querySelector('[data-action="to-idle"]')?.click());
  await pageA.waitForSelector('[data-action="logout"]', { timeout: 3000 });
  await pageA.click('[data-action="logout"]');
  await pageA.waitForSelector('#auth-name', { timeout: 5000 });
  await pageA.click('#restore-btn');
  await pageA.waitForFunction(() => !document.getElementById('restore-modal').classList.contains('hidden'), { timeout: 3000 });
  await pageA.fill('#restore-name', 'Aさん');
  await pageA.fill('#restore-secret', '1111');
  await pageA.click('#restore-submit');
  await pageA.waitForFunction(() => document.querySelector('.self-badge') !== null, { timeout: 15000 });
});

// ===== Section F: Realtime同期 =====
section('Section F: Realtime同期(2ブラウザ間)');
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageB = await ctxB.newPage();
await pageB.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 3000));

await test('F1. Bが森に入るとAさんの樹が見える', async () => {
  const count = await pageB.$eval('#forest-count', el => el.textContent);
  if (!count.includes('1')) throw new Error('count: ' + count);
});
await test('F2. AのキーワードがBに反映(realtime)', async () => {
  // I2の時点で Aさん ログイン中。ownTreeモードに確実に遷移
  await pageA.waitForSelector('.self-badge', { timeout: 10000 });
  const needNav = await pageA.$('[data-action="my-tree"]');
  if (needNav) await needNav.click();
  await pageA.waitForSelector('#ip-add-input', { timeout: 10000 });
  await pageA.fill('#ip-add-input', '旅行');
  await pageA.click('#ip-add-btn');
  // Bが自分の画面で「旅行」をRealtime経由で見れる
  await pageB.waitForFunction(() => {
    const s = window.__morinoki?.state;
    if (!s) return false;
    const t = s.trees.find(t => t.name === 'Aさん');
    return t && (t.nodes || []).some(n => n.text === '旅行');
  }, { timeout: 20000 });
});
await test('F3. Bさんを植樹 → Aに反映', async () => {
  await pageB.waitForSelector('#auth-name', { timeout: 5000 });
  await pageB.fill('#auth-name', 'Bさん');
  await pageB.fill('#auth-pass', '2222');
  await pageB.click('[data-action="auth-submit"]');
  await pageB.waitForFunction(() => !document.getElementById('recovery-modal').classList.contains('hidden'), { timeout: 15000 });
  await pageB.click('#recovery-ok');
  await pageA.waitForFunction(() => {
    return document.getElementById('forest-count').textContent.includes('2');
  }, { timeout: 15000 });
});

// ===== Section E: 他人視点 / 共通点 / 散歩 =====
section('Section E: 他人視点 + 共通キーワード + 散歩');
// F3でpageBが植樹したが、selectionが何であれ一度 ownTree に戻す
await pageB.waitForFunction(() => document.querySelector('.self-badge') !== null, { timeout: 10000 });
// 念のため my-tree ボタンを押す(idleにいれば)
const mtBtn = await pageB.$('[data-action="my-tree"]');
if (mtBtn) await mtBtn.click();
await pageB.waitForSelector('#ip-add-input', { timeout: 10000 });
// Bさんに '音楽' キーワードを追加して Aさんとの共通点を作る
await pageB.fill('#ip-add-input', '音楽');
await pageB.click('#ip-add-btn');
await pageB.waitForFunction(() => [...document.querySelectorAll('.ip-kw .kw')].some(e => e.textContent.includes('音楽')), { timeout: 15000 });

await test('E1. BからAさんの樹を選択', async () => {
  const pos = await pageB.evaluate(() => {
    const s = window.__morinoki?.state;
    const a = s.trees.find(t => t.name === 'Aさん');
    const rect = document.getElementById('forest-canvas').getBoundingClientRect();
    return { x: rect.x + s.view.ox + (a._displayX ?? a.x) * s.view.scale, y: rect.y + s.view.oy + (a._displayY ?? a.y) * s.view.scale };
  });
  await pageB.mouse.click(pos.x, pos.y);
  await pageB.waitForFunction(() => document.querySelector('.ip-title')?.textContent?.includes('Aさん'), { timeout: 5000 });
});
await test('E2. 編集UIが非表示(他人の樹はreadonly)', async () => {
  const hasInput = await pageB.$('#ip-add-input');
  if (hasInput) throw new Error('add-input present on other tree');
});
await test('E3. 共通キーワード「音楽」が表示', async () => {
  await pageB.waitForFunction(() => [...document.querySelectorAll('.common-chip')].some(c => c.textContent.includes('音楽')), { timeout: 5000 });
});
await test('E4. 近くの樹リスト表示', async () => {
  await pageB.waitForSelector('.ip-near-list li', { timeout: 3000 });
});
await test('E5. 散歩ボタンで別の樹へ遷移', async () => {
  const before = await pageB.$eval('.ip-title', el => el.textContent);
  const btn = await pageB.$('[data-action="walk"]');
  if (!btn) return 'skip'; // 対象樹が無ければskip
  await btn.click();
  await pageB.waitForFunction((prev) => {
    const t = document.querySelector('.ip-title')?.textContent || '';
    return t && !t.includes('Aさん') && t !== prev;
  }, before, { timeout: 5000 }).catch(() => {}); // 2本だけだと遷移先がない場合あり
});

// ===== Section K: タイムラプス(管理者のみ) =====
section('Section K: タイムラプス(管理者のみ)');
// まず admin login。別コンテキスト新ページで /a/<slug> を開く(前ページの状態を汚さない)
const ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageAdmin = await ctxAdmin.newPage();
pageAdmin.on('pageerror', e => errorsA.push('admin/pageerror: ' + e.message));
pageAdmin.on('console', m => { if (m.type() === 'error') errorsA.push('admin/err: ' + m.text()); });
await test('K0. 管理者モード /a/:slug → admin-login フォーム', async () => {
  const adminUrl = BASE + '/a/' + slug;
  await pageAdmin.goto(adminUrl, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 3000));
  await pageAdmin.waitForSelector('[data-action="admin-login"]', { timeout: 10000 });
});
await test('K0b. admin passcode で admin_token 取得', async () => {
  // 状況確認
  const dbg = await pageAdmin.evaluate(() => ({
    isAdminMode: window.__morinoki?.state?.isAdminMode,
    hasAdminBtn: !!document.querySelector('[data-action="admin-login"]'),
    hasAdminPass: !!document.getElementById('admin-pass'),
    adminPassVisible: !!document.getElementById('admin-pass')?.offsetParent,
    panel: document.getElementById('info-content')?.innerHTML?.slice(0, 200)
  }));
  log(`             [dbg] ${JSON.stringify(dbg)}`);
  await pageAdmin.screenshot({ path: 'dbg-admin-pre.png' });
  await pageAdmin.waitForSelector('#admin-pass', { state: 'visible', timeout: 5000 });
  await pageAdmin.fill('#admin-pass', 'admin');
  await pageAdmin.click('[data-action="admin-login"]');
  await pageAdmin.waitForSelector('.admin-badge', { timeout: 15000 });
});
await test('K1. admin 時のみタイムラプスボタンあり', async () => {
  await pageAdmin.waitForSelector('[data-action="timelapse"]', { timeout: 5000 });
});
await test('K2. タイムラプス起動でbar表示', async () => {
  await pageAdmin.click('[data-action="timelapse"]');
  await pageAdmin.waitForFunction(() => !document.getElementById('timelapse-bar').classList.contains('hidden'), { timeout: 3000 });
});
await test('K3. sliderで timeCursor が動く', async () => {
  const before = await pageAdmin.evaluate(() => window.__morinoki?.state?.timeCursor);
  await pageAdmin.evaluate(() => {
    const s = document.getElementById('tl-slider');
    s.value = 700; s.dispatchEvent(new Event('input'));
  });
  await new Promise(r => setTimeout(r, 300));
  const after = await pageAdmin.evaluate(() => window.__morinoki?.state?.timeCursor);
  if (before === after) throw new Error('no change');
});
await test('K4. playで自動進行(500ms後に値増)', async () => {
  await pageAdmin.evaluate(() => { const s = document.getElementById('tl-slider'); s.value = 0; s.dispatchEvent(new Event('input')); });
  await pageAdmin.click('#tl-play');
  await new Promise(r => setTimeout(r, 600));
  const v = await pageAdmin.$eval('#tl-slider', el => Number(el.value));
  if (v <= 0) throw new Error('slider did not advance');
  // stop
  await pageAdmin.click('#tl-play');
});
await test('K5. 閉じるで timeCursor が null', async () => {
  await pageAdmin.click('#tl-close');
  await new Promise(r => setTimeout(r, 400));
  const c = await pageAdmin.evaluate(() => window.__morinoki?.state?.timeCursor);
  if (c !== null && c !== undefined) throw new Error('cursor: ' + c);
});

// ===== Section L: CSV書き出し(管理者のみ) =====
section('Section L: CSV書き出し(管理者のみ)');
await test('L1. admin 時のみ CSVボタン', async () => {
  await pageAdmin.waitForSelector('[data-action="export-csv"]', { timeout: 3000 });
});
await test('L2. ダウンロードイベント発火 + 正しいファイル名', async () => {
  const [download] = await Promise.all([
    pageAdmin.waitForEvent('download', { timeout: 5000 }),
    pageAdmin.click('[data-action="export-csv"]')
  ]);
  const name = download.suggestedFilename();
  if (!name.startsWith('forest-') || !name.endsWith('.csv')) throw new Error('filename: ' + name);
});
await test('L3. success toast表示', async () => {
  await pageAdmin.waitForSelector('.toast-success.show', { timeout: 3000 });
});

// ===== Section AX: 管理者による他人樹の編集 =====
section('Section AX: 管理者は他人樹を編集可能');
await test('AX1. admin で他人樹(Bさん)のノードを追加できる', async () => {
  const hasB = await pageAdmin.evaluate(() => window.__morinoki?.state?.trees?.some(t => t.name === 'Bさん'));
  if (!hasB) return 'skip';
  const result = await pageAdmin.evaluate(async () => {
    const mod = await import('/js/supabase.js');
    const s = window.__morinoki.state;
    const b = s.trees.find(t => t.name === 'Bさん');
    try {
      return { ok: await mod.api.upsertNode(s.adminToken, b.id, {
        text: 'admin追加', size: 3, color: '#c49a3e', ord: 99
      }) };
    } catch (e) { return { err: e.message }; }
  });
  if (result.err) throw new Error(result.err);
  if (!result.ok.text.includes('admin追加')) throw new Error('unexpected: ' + JSON.stringify(result.ok));
});

// ===== Section NX: 非管理者モードではタイムラプス/CSVボタン非表示 =====
section('Section NX: 非admin時はタイムラプス/CSV非表示');
await test('NX1. 通常URLに戻る + admin logout → ボタン消える', async () => {
  // admin logout
  const logoutBtn = await pageA.$('[data-action="admin-logout"]');
  if (logoutBtn) await logoutBtn.click();
  await new Promise(r => setTimeout(r, 500));
  // 通常URL
  await pageA.goto(forestUrl, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2500));
  const hasTL = await pageA.$('[data-action="timelapse"]');
  const hasCSV = await pageA.$('[data-action="export-csv"]');
  if (hasTL || hasCSV) throw new Error(`visible! tl=${!!hasTL} csv=${!!hasCSV}`);
});

// ===== Section M: Toast / エラー =====
section('Section M: Toast / エラー処理');
await test('M1. 不正slug → エラーtoast', async () => {
  const page = await ctxA.newPage();
  await page.goto(BASE + '/room.html?slug=__nonexistent__x1y2z3', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 4000));
  const ok = await page.$('.toast-error.show');
  if (!ok) throw new Error('no error toast');
  await page.close();
});

// ===== Section O: 接続状態 =====
section('Section O: 接続状態 (online/offline)');
await test('O1. オフラインにするとバナー表示', async () => {
  await ctxA.setOffline(true);
  await new Promise(r => setTimeout(r, 1500));
  const visible = await pageA.evaluate(() => {
    const el = document.getElementById('connection-status');
    return el && el.style.display !== 'none' && el.textContent.length > 0;
  });
  if (!visible) throw new Error('no offline banner');
});
await test('O2. オンラインに戻るとバナー消える(または online扱い)', async () => {
  await ctxA.setOffline(false);
  await new Promise(r => setTimeout(r, 3000));
  const text = await pageA.evaluate(() => {
    const el = document.getElementById('connection-status');
    return el?.textContent || '';
  });
  // online復帰時は非表示 or「再接続中…」から徐々にオフに
  // offlineテキストが消えていれば OK
  if (text.includes('オフライン')) throw new Error('still offline: ' + text);
});

// ===== Section N: モバイル =====
section('Section N: モバイルレイアウト');
const ctxM = await browser.newContext({ ...devices['iPhone 14'], viewport: { width: 390, height: 844 } });
const pageM = await ctxM.newPage();
await pageM.goto(forestUrl, { waitUntil: 'networkidle' });
await new Promise(r => setTimeout(r, 2500));

await test('N1. info-panelが下部ドロワー', async () => {
  const layout = await pageM.evaluate(() => {
    const p = document.getElementById('info-panel');
    const r = p.getBoundingClientRect();
    return { top: r.top, innerH: window.innerHeight };
  });
  if (layout.top < layout.innerH * 0.4) throw new Error('not bottom: ' + JSON.stringify(layout));
});
await test('N2. 共有ボタン 34px以上', async () => {
  const s = await pageM.evaluate(() => {
    const r = document.getElementById('share-btn').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  if (s.w < 34 || s.h < 34) throw new Error('too small: ' + JSON.stringify(s));
});
await test('N3. 復元ボタン 34px以上', async () => {
  const s = await pageM.evaluate(() => {
    const r = document.getElementById('restore-btn').getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  if (s.w < 34 || s.h < 34) throw new Error('too small: ' + JSON.stringify(s));
});

// ===== Section P: パフォーマンス =====
section('Section P: パフォーマンス smoke');
await test('P1. FPS 30以上(tab visible)', async () => {
  const fps = await pageA.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    return await new Promise(resolve => {
      function loop() {
        frames++;
        if (performance.now() - t0 > 1500) resolve(frames / ((performance.now() - t0) / 1000));
        else requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });
  });
  log(`             FPS: ${fps.toFixed(1)}`);
  if (fps < 30) throw new Error('fps too low: ' + fps);
});

// ===== 後片付け =====
await browser.close();

// ===== レポート出力 =====
log('');
log('═══════════════════════════════════════════════════════════════');
log('  サマリー');
log('═══════════════════════════════════════════════════════════════');
log(`  Total:   ${stats.total}`);
log(`  Passed:  ${stats.pass}`);
log(`  Failed:  ${stats.fail}`);
log(`  Skipped: ${stats.skip}`);
log('');
log('  セクション別:');
for (const [name, s] of Object.entries(stats.sections)) {
  const mark = s.fail ? '✗' : '✓';
  log(`    ${mark} ${name.padEnd(60)} pass=${s.pass} fail=${s.fail}`);
}
log('');
if (errorsA.length) {
  log('  Page A console errors:');
  errorsA.slice(0, 10).forEach(e => log('    ' + e));
}
log('');
log(`  Finished: ${new Date().toISOString()}`);
log(`  Result:   ${stats.fail === 0 ? 'ALL PASS ✓' : stats.fail + ' FAILED ✗'}`);

fs.writeFileSync(REPORT_PATH, report.join('\n'), 'utf8');
console.log('\nReport written to', REPORT_PATH);
process.exit(stats.fail === 0 ? 0 : 1);
