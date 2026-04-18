import { api } from './supabase.js';
import { isValidSlug, randomSlug } from './utils.js';

const isIndex = document.body.classList.contains('page-index');
const isRoom = document.body.classList.contains('page-room');

if (isIndex) initIndex();
if (isRoom) initRoom();

// 森全体が見えるようビューをフィット
function fitForestToView(canvas, state) {
  if (!state.trees.length) return;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const pad = 140; // 樹1本の半径+余白
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.trees.forEach(t => {
    minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y);
  });
  const bboxW = Math.max(1, maxX - minX + pad * 2);
  const bboxH = Math.max(1, maxY - minY + pad * 2);
  const scale = Math.min(1.2, Math.min(W / bboxW, H / bboxH));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  state.view = { ox: W / 2 - cx * scale, oy: H / 2 - cy * scale, scale };
}

function initIndex() {
  const form = document.getElementById('create-form');
  const created = document.getElementById('created');
  const createdUrl = document.getElementById('created-url');
  const openBtn = document.getElementById('open-forest');
  const copyBtn = document.getElementById('copy-url');
  const errBox = document.getElementById('error');
  const slugInput = document.getElementById('forest-slug');

  if (!slugInput.value) slugInput.value = randomSlug();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const name = document.getElementById('forest-name').value.trim();
    const slug = slugInput.value.trim().toLowerCase();
    if (!isValidSlug(slug)) return showError('URLは英小文字・数字・ハイフンで3〜40文字');
    try {
      await api.createRoom(slug, name);
      const url = `${location.origin}/r/${slug}`;
      createdUrl.textContent = url;
      openBtn.href = url;
      created.classList.remove('hidden');
      form.classList.add('hidden');
    } catch (err) { showError(err.message || String(err)); }
  });

  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(createdUrl.textContent);
    copyBtn.textContent = 'コピーしました';
    setTimeout(() => copyBtn.textContent = 'URLをコピー', 1500);
  });
  function showError(msg){ errBox.textContent = msg; errBox.classList.remove('hidden'); }
}

async function initRoom() {
  const { createForest, layoutRandom } = await import('./forest.js');
  const { openPlantModal, openNodePanel } = await import('./editor.js');
  const { loadSession, isTokenExpired, clearSession } = await import('./auth.js');

  const slug = location.pathname.match(/\/r\/([^\/]+)/)?.[1] || new URLSearchParams(location.search).get('slug');
  if (!slug) { alert('ルームが指定されていません'); return; }

  const state = {
    room: null, trees: [], session: null, selfTreeId: null,
    onTreeTap: null, onEmptyTap: null, view: null
  };

  try { state.room = await api.getRoomBySlug(slug); }
  catch { alert('森が見つかりません: ' + slug); return; }

  document.getElementById('forest-name').textContent = state.room.name || state.room.slug;

  const sess = loadSession(slug);
  if (sess && !isTokenExpired(sess.editToken)) {
    state.session = sess; state.selfTreeId = sess.treeId;
  } else if (sess) {
    clearSession(slug);
  }

  await reload();
  const canvas = document.getElementById('forest-canvas');
  const forest = createForest(canvas, state);

  // 初期表示: 森全体が画面に収まるようフィット
  if (state.trees.length) {
    fitForestToView(canvas, state);
  }

  state.onTreeTap = (tree) => {
    if (state.session && tree.id === state.selfTreeId) {
      openNodePanel(state, tree, () => forest.render());
    } else {
      alert(`${tree.name}さん\nキーワード: ${(tree.nodes||[]).map(n=>n.text).join(' / ') || '(まだ)'}`);
    }
  };

  // 植樹フロー: plant-btn または 空地タップ → 常に開く(別の人がこの端末で植えるケースに対応)
  function openPlanting() {
    openPlantModal(state, async () => {
      state.session = loadSession(slug);
      state.selfTreeId = state.session.treeId;
      await reload();
      fitForestToView(canvas, state);
      forest.render();
      const mine = state.trees.find(t => t.id === state.selfTreeId);
      if (mine) openNodePanel(state, mine, () => forest.render());
    });
  }
  state.onEmptyTap = () => openPlanting();

  document.getElementById('plant-btn').addEventListener('click', openPlanting);
  forest.render();

  async function reload() {
    const trees = await api.getTrees(state.room.id);
    const ids = trees.map(t => t.id);
    const nodes = ids.length ? await api.getNodes(ids) : [];
    const byTree = {};
    nodes.forEach(n => (byTree[n.tree_id] ||= []).push(n));
    trees.forEach(t => { t.nodes = (byTree[t.id] || []).sort((a,b) => a.ord - b.ord); });
    state.trees = trees;
    layoutRandom(state.trees);
    document.getElementById('forest-count').textContent = `${trees.length}本の樹`;
  }
}
