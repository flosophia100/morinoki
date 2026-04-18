// Node.js test runner. jsdomでブラウザAPIを模擬してutils.js/auth.jsをimportしテストする。
// Run: node test-node.mjs
import { JSDOM } from './reference/wordmap/node_modules/jsdom/lib/api.js';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.btoa = dom.window.btoa.bind(dom.window);
global.atob = dom.window.atob.bind(dom.window);

const { stringHash, seededRandom, isValidSlug, randomSlug, escapeHtml } = await import('./js/utils.js');
const { saveSession, loadSession, clearSession, isTokenExpired } = await import('./js/auth.js');

let fails = 0, count = 0;
function t(name, fn) {
  count++;
  try { fn(); console.log(`  OK  ${name}`); }
  catch(e) { fails++; console.log(`  FAIL ${name}: ${e.message}`); }
}
function eq(a,b,m){ if(a!==b) throw new Error((m||'')+' expected '+JSON.stringify(b)+' got '+JSON.stringify(a)); }
function ok(v,m){ if(!v) throw new Error(m||'expected truthy'); }

console.log('--- utils ---');
t('stringHash deterministic', () => eq(stringHash('abc'), stringHash('abc')));
t('stringHash differs', () => ok(stringHash('abc') !== stringHash('abd')));
t('stringHash positive', () => { ok(stringHash('')>=1); ok(stringHash('x')>=1); });
t('seededRandom deterministic', () => { const a=seededRandom(42),b=seededRandom(42); eq(a(),b()); eq(a(),b()); });
t('seededRandom 0..1', () => { const r=seededRandom(7); for(let i=0;i<10;i++){ const v=r(); ok(v>=0&&v<1); } });
t('isValidSlug accepts', () => { ok(isValidSlug('abc-def')); ok(isValidSlug('3a-forest')); ok(isValidSlug('abc')); });
t('isValidSlug rejects', () => { ok(!isValidSlug('AB')); ok(!isValidSlug('ab')); ok(!isValidSlug('ab_cd')); ok(!isValidSlug('')); });
t('randomSlug valid', () => { for(let i=0;i<20;i++) ok(isValidSlug(randomSlug())); });
t('escapeHtml', () => { eq(escapeHtml('<b>"&'), '&lt;b&gt;"&amp;'); });

console.log('--- auth ---');
t('saveSession/loadSession', () => {
  saveSession('_test_room_', { treeId: 'tid1', editToken: 'aaa.bbb.ccc', treeName: 'テスト' });
  const s = loadSession('_test_room_');
  ok(s); eq(s.treeId, 'tid1'); eq(s.treeName, 'テスト');
  clearSession('_test_room_');
  eq(loadSession('_test_room_'), null);
});
t('loadSession invalid returns null', () => {
  localStorage.setItem('mori.session._bad_', 'not json');
  eq(loadSession('_bad_'), null);
  localStorage.removeItem('mori.session._bad_');
});
t('loadSession missing fields returns null', () => {
  localStorage.setItem('mori.session._partial_', JSON.stringify({ treeId: 'x' }));
  eq(loadSession('_partial_'), null);
  localStorage.removeItem('mori.session._partial_');
});
t('isTokenExpired empty/garbage', () => { ok(isTokenExpired('')); ok(isTokenExpired('garbage')); });
t('isTokenExpired past/future', () => {
  const mk = (exp) => {
    const header = btoa('{"alg":"HS256"}').replace(/=+$/,'');
    const payload = btoa(JSON.stringify({ exp })).replace(/=+$/,'');
    return `${header}.${payload}.sig`;
  };
  ok(isTokenExpired(mk(1)));
  ok(!isTokenExpired(mk(Math.floor(Date.now()/1000) + 3600)));
});

console.log('');
console.log(fails === 0 ? `ALL ${count} TESTS PASS` : `${fails}/${count} FAILED`);
process.exit(fails === 0 ? 0 : 1);
