// JSDOMで実ページを読み込み、起動時のJSエラーを捕捉する
// Run: node test-pages.mjs
// Supabase呼び出しはモックで差し替える (ネットワーク不要)。
import { JSDOM, VirtualConsole } from './reference/wordmap/node_modules/jsdom/lib/api.js';
import fs from 'node:fs/promises';

async function loadPage(path, bodyClass) {
  const html = await fs.readFile(path, 'utf8');
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', e => errors.push('jsdom: ' + (e.message || e)));
  vc.on('error', e => errors.push('error: ' + (e.message || e)));
  vc.sendTo(console, { omitJSDOMErrors: true });

  const dom = new JSDOM(html, {
    url: 'http://localhost:8765/' + (bodyClass === 'page-index' ? 'index.html' : 'r/abc'),
    runScripts: 'dangerously',
    resources: undefined, // 外部リソースはfetchしない
    virtualConsole: vc,
    pretendToBeVisual: true
  });

  const w = dom.window;

  // Canvas getContextのスタブ (jsdomはCanvasを実装しない)
  w.HTMLCanvasElement.prototype.getContext = function () {
    return {
      clearRect(){}, fillRect(){}, save(){}, restore(){},
      translate(){}, scale(){}, setTransform(){},
      beginPath(){}, arc(){}, ellipse(){}, moveTo(){}, quadraticCurveTo(){}, fill(){}, stroke(){},
      createLinearGradient(){ return { addColorStop(){} }; },
      measureText(){ return { width: 20 }; },
      fillText(){}, setLineDash(){},
      get fillStyle(){return ''} ,set fillStyle(v){},
      get strokeStyle(){return ''} ,set strokeStyle(v){},
      get lineWidth(){return 1} ,set lineWidth(v){},
      get lineCap(){return 'butt'} ,set lineCap(v){},
      get font(){return ''} ,set font(v){},
      get textAlign(){return 'start'} ,set textAlign(v){},
      get textBaseline(){return 'alphabetic'} ,set textBaseline(v){},
    };
  };

  // Supabaseクライアント取込みをモックに差し替え
  const origFetch = w.fetch;
  w.fetch = async (url) => {
    if (typeof url === 'string' && url.includes('esm.sh')) {
      const stub = `export function createClient() {
        return {
          auth: { persistSession: false },
          rpc: async () => ({ data: null, error: { message: 'mock' } }),
          from: () => ({
            select: () => ({
              eq: () => ({ single: async () => ({ data: null, error: { message: 'not found' } }) }),
              in: () => Promise.resolve({ data: [], error: null })
            })
          })
        };
      }`;
      return new w.Response(stub, { headers: { 'content-type': 'application/javascript' } });
    }
    return origFetch ? origFetch(url) : new w.Response('', { status: 404 });
  };

  // ESM scriptを手動で実行する (jsdomがtype=module scriptを解釈しないため)
  const scripts = Array.from(dom.window.document.querySelectorAll('script[type="module"][src]'));
  for (const s of scripts) {
    const src = s.getAttribute('src');
    const code = await fs.readFile(new URL(src, 'file:///' + path.replace(/\\/g,'/').replace(/[^/]+$/, '')), 'utf8').catch(() => null);
    // JSDOM では type=module を走らせるのが面倒なので import() を使う
    try {
      await import('./' + src);
    } catch (e) {
      errors.push('import ' + src + ': ' + e.message);
    }
  }

  // ちょっと待ってpromise chainを消化
  await new Promise(r => setTimeout(r, 200));

  return { errors, dom };
}

let anyFail = false;
async function run(name, path, bodyClass, expectedIds) {
  console.log(`=== ${name} ===`);
  const { errors, dom } = await loadPage(path, bodyClass);
  for (const id of expectedIds) {
    const el = dom.window.document.getElementById(id);
    if (!el) {
      anyFail = true;
      console.log(`  FAIL missing element #${id}`);
    } else {
      console.log(`  OK   #${id} present`);
    }
  }
  if (errors.length) {
    anyFail = true;
    for (const e of errors) console.log('  FAIL ' + e);
  } else {
    console.log('  OK   no runtime errors');
  }
}

await run('index.html', './index.html', 'page-index',
  ['create-form','forest-name','forest-slug','created','created-url','copy-url','open-forest','error']);

await run('room.html', './room.html', 'page-room',
  ['forest-name','forest-count','forest-canvas','plant-btn','plant-modal','plant-name','plant-pass',
   'plant-pass2','plant-email','plant-cancel','plant-submit','plant-error',
   'recovery-modal','recovery-key','recovery-copy','recovery-ok',
   'node-panel','node-panel-name','node-panel-close','node-input','node-add-btn','node-list',
   'node-edit','node-edit-text','color-row','node-edit-delete','node-edit-save']);

console.log('');
console.log(anyFail ? 'FAILURES detected' : 'ALL PAGE CHECKS PASS');
process.exit(anyFail ? 1 : 0);
