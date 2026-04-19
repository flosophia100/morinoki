import { api } from './supabase.js';
import { isValidSlug, randomSlug } from './utils.js';

const isIndex = document.body.classList.contains('page-index');
const isRoom = document.body.classList.contains('page-room');

if (isIndex) initIndex();
if (isRoom) initRoom();

function fitForestToView(canvas, state) {
  if (!state.trees.length) return;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  const pad = 180;
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
  const { openPlantModal, renderInfoPanel, openShareModal, openRestoreModal, exportForestCsv } = await import('./editor.js');
  const { loadSession, isTokenExpired, clearSession } = await import('./auth.js');
  const { subscribeRoom, debounce } = await import('./realtime.js');
  const { LiveForest } = await import('./liveforest.js');
  const { atmosphereAt } = await import('./atmosphere.js');
  const { showToast, showError, setConnectionStatus } = await import('./toast.js');

  const slug = location.pathname.match(/\/r\/([^\/]+)/)?.[1] || new URLSearchParams(location.search).get('slug');
  if (!slug) {
    const t = await import('./toast.js');
    t.showError('ルームが指定されていません');
    return;
  }

  const state = {
    room: null, trees: [], session: null, selfTreeId: null,
    onTrunkTap: null, onNodeTap: null, onEmptyTap: null,
    onTreeMoved: null, onNodeMoved: null,
    view: null,
    selection: null,
    atmo: atmosphereAt(), // 時間帯(render時に毎回最新を使うので実質更新)
  };

  try { state.room = await api.getRoomBySlug(slug); }
  catch {
    const t = await import('./toast.js');
    t.showError('森が見つかりません: ' + slug);
    return;
  }

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

  if (state.trees.length) fitForestToView(canvas, state);

  // ==== コールバック群(先に定義 — updatePanelから参照される) ====
  const panelCallbacks = {
    onIdle: () => { state.selection = null; updatePanel(); forest.render(); },
    onPlant: () => openPlanting(),
    onFocusSelf: () => {
      const mine = state.trees.find(t => t.id === state.selfTreeId);
      if (mine) {
        state.selection = { kind: 'tree', tree: mine };
        centerOn(mine);
      }
      updatePanel();
      forest.render();
    },
    onLogout: () => {
      if (!confirm('session切替: あなたの編集権限を端末から消します(復元キーと合言葉があれば後から再認証可能)')) return;
      clearSession(slug);
      state.session = null;
      state.selfTreeId = null;
      state.selection = null;
      updatePanel(); updatePlantBtn(); forest.render();
    },
    onRerender: () => { updatePanel(); forest.render(); },
    onExportCsv: () => {
      try { exportForestCsv(state); showToast('CSVをダウンロードしました', 'success'); }
      catch (e) { showError(e, 'CSV書き出しに失敗しました'); }
    },
    onSelectNode: (tree, node) => {
      state.selection = { kind: 'node', tree, node };
      updatePanel(); forest.render();
    },
    onSelectTree: (tree) => {
      state.selection = { kind: 'tree', tree };
      updatePanel(); forest.render();
    },
  };

  function updatePanel() {
    renderInfoPanel(state, state.selection, panelCallbacks);
  }
  function updatePlantBtn() {
    const btn = document.getElementById('plant-btn');
    if (!btn) return;
    if (state.session) {
      btn.textContent = '自分の樹';
      btn.dataset.mode = 'self';
    } else {
      btn.textContent = '+ 樹を植える';
      btn.dataset.mode = 'plant';
    }
  }
  function centerOn(tree) {
    const rect = canvas.getBoundingClientRect();
    state.view = { ox: rect.width / 2 - tree.x * state.view.scale, oy: rect.height / 2 - tree.y * state.view.scale, scale: state.view.scale };
  }

  // 初期の左パネル: 自分の樹があれば自分の樹、なければidle
  if (state.session) {
    const mine = state.trees.find(t => t.id === state.selfTreeId);
    if (mine) state.selection = { kind: 'tree', tree: mine };
  }
  updatePanel();
  updatePlantBtn();
  forest.render();

  // ===== Phase 2: 生きている森 =====
  console.log('[phase2] init');
  const treeIdsRef = new Set((state.trees || []).map(t => t.id));
  const live = new LiveForest(() => state.trees, () => forest.render());
  live.notifyDataChanged();
  live.start();
  console.log('[phase2] liveforest started, treeIds:', [...treeIdsRef]);

  // Realtime setAuth完了を待つ
  const { realtimeReady } = await import('./supabase.js');
  await realtimeReady;

  // Realtime購読: 他ユーザーの変更を検知 → reload
  const onRealtime = debounce(async ({ source, payload }) => {
    try {
      await reload();
      // 新しい tree_id を treeIdsRef に反映
      treeIdsRef.clear();
      (state.trees || []).forEach(t => treeIdsRef.add(t.id));
      // 選択中のtree/nodeが削除された場合はselectionクリア
      if (state.selection?.kind === 'tree') {
        const stillExists = state.trees.find(t => t.id === state.selection.tree.id);
        if (!stillExists) state.selection = null;
        else state.selection.tree = stillExists;
      } else if (state.selection?.kind === 'node') {
        const tree = state.trees.find(t => t.id === state.selection.tree.id);
        const node = tree?.nodes?.find(n => n.id === state.selection.node.id);
        if (!node) state.selection = tree ? { kind: 'tree', tree } : null;
        else { state.selection.tree = tree; state.selection.node = node; }
      }
      live.notifyDataChanged();
      updatePanel();
      forest.render();
    } catch (e) { console.error('realtime reload', e); }
  }, 500);
  let realtimeOk = false;
  const unsubscribeRealtime = subscribeRoom(state.room.id, treeIdsRef, onRealtime, (status) => {
    if (status === 'SUBSCRIBED') {
      realtimeOk = true;
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      realtimeOk = false;
      if (navigator.onLine) setConnectionStatus('reconnecting');
    }
  });

  // online/offline監視
  function updateOnline() {
    if (!navigator.onLine) {
      setConnectionStatus('offline');
    } else {
      setConnectionStatus(realtimeOk ? 'online' : 'reconnecting');
    }
  }
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  window.addEventListener('beforeunload', () => {
    live.stop();
    unsubscribeRealtime && unsubscribeRealtime();
  });

  // ==== canvas クリック ====
  state.onTrunkTap = (tree) => { state.selection = { kind: 'tree', tree }; updatePanel(); forest.render(); };
  state.onNodeTap = (tree, node) => { state.selection = { kind: 'node', tree, node }; updatePanel(); forest.render(); };
  state.onEmptyTap = () => { state.selection = null; updatePanel(); forest.render(); };

  // ==== ドラッグ永続化 ====
  state.onTreeMoved = async (tree) => {
    forest.render();
    if (!state.session) return;
    try {
      await api.updateTreePosition(state.session.editToken, tree.id, tree.x, tree.y);
    } catch (e) { showError(e, '樹の移動を保存できませんでした'); }
  };
  state.onNodeMoved = async (tree, node) => {
    forest.render();
    if (!state.session) return;
    try {
      const saved = await api.upsertNode(state.session.editToken, tree.id, {
        id: node.id, text: node.text, size: node.size, color: node.color, ord: node.ord,
        offset_x: node.offset_x, offset_y: node.offset_y, description: node.description
      });
      Object.assign(node, saved);
      forest.render();
    } catch (e) { showError(e, 'ノードの移動を保存できませんでした'); }
  };

  // ==== 植樹ボタン ====
  function openPlanting() {
    if (state.session) {
      // 一人一樹制約: 自分の樹にフォーカス
      const mine = state.trees.find(t => t.id === state.selfTreeId);
      if (mine) {
        state.selection = { kind: 'tree', tree: mine };
        centerOn(mine);
        updatePanel(); forest.render();
      }
      return;
    }
    openPlantModal(state, async () => {
      state.session = loadSession(slug);
      state.selfTreeId = state.session.treeId;
      await reload();
      fitForestToView(canvas, state);
      const mine = state.trees.find(t => t.id === state.selfTreeId);
      if (mine) state.selection = { kind: 'tree', tree: mine };
      updatePanel(); updatePlantBtn(); forest.render();
    });
  }
  document.getElementById('plant-btn').addEventListener('click', openPlanting);

  // 共有ボタン
  document.getElementById('share-btn').addEventListener('click', () => {
    const url = `${location.origin}/r/${state.room.slug}`;
    openShareModal(url);
  });

  // 復元ボタン
  document.getElementById('restore-btn').addEventListener('click', () => {
    openRestoreModal(state, async (sess) => {
      state.session = sess;
      state.selfTreeId = sess.treeId;
      await reload();
      const mine = state.trees.find(t => t.id === state.selfTreeId);
      if (mine) state.selection = { kind: 'tree', tree: mine };
      updatePanel(); updatePlantBtn(); forest.render();
    });
  });

  // 時間帯を1分ごとに更新(1時間/24段階でゆっくり推移)
  setInterval(() => { state.atmo = atmosphereAt(); forest.render(); }, 60000);

  // テスト/デバッグ用にstateを公開
  window.__morinoki = { state, forest };

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
