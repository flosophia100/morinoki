import { api } from './supabase.js';
import { mergeDesign, mergeAmbience } from './designconfig.js';

const isAdmin = document.body.classList.contains('page-admin');
const isRoom = document.body.classList.contains('page-room');

if (isAdmin) initAdminPage();
if (isRoom) initRoom();

async function initAdminPage() {
  const { initAdmin } = await import('./admin.js');
  await initAdmin();
}

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

async function initRoom() {
  const { createForest, layoutRandom } = await import('./forest.js');
  const { renderInfoPanel, exportForestCsv } = await import('./editor.js');
  const { loadSession, isTokenExpired, clearSession } = await import('./auth.js');
  const { subscribeRoom, debounce } = await import('./realtime.js');
  const { LiveForest } = await import('./liveforest.js');
  const { atmosphereAt } = await import('./atmosphere.js');
  const { showToast, showError, setConnectionStatus } = await import('./toast.js');

  // /r/:slug
  const urlMatch = location.pathname.match(/\/r\/([^\/]+)/);
  const slug = urlMatch?.[1] || new URLSearchParams(location.search).get('slug');
  if (!slug) {
    const t = await import('./toast.js');
    t.showError('ルームが指定されていません');
    return;
  }

  const state = {
    room: null, trees: [], session: null, selfTreeId: null,
    adminToken: null,
    onTrunkTap: null, onNodeTap: null, onEmptyTap: null,
    onTreeMoved: null, onNodeMoved: null,
    view: null,
    selection: null,
    atmo: atmosphereAt(),
    design: mergeDesign(null),
    ambience: mergeAmbience(null),
    hideAllTrees: false,   // 管理者用(ローカル)
    // セッションごとに変わる乱数シード。layoutRandom が x=y=0 の樹を
    // ばらまくときに使う(=開くたびに配置が変わる)
    sessionSeed: Math.floor(Math.random() * 2147483647) + 1,
  };
  const HIDE_ALL_KEY  = 'mori.hideAll.'  + slug;
  state.hideAllTrees  = localStorage.getItem(HIDE_ALL_KEY)  === '1';
  // グローバル管理者トークンを復元(/admin5002 でログインしてれば有効)
  const ADMIN_KEY = 'mori.admin.global.token';
  const savedAdmin = localStorage.getItem(ADMIN_KEY);
  if (savedAdmin) state.adminToken = savedAdmin;

  try { state.room = await api.getRoomBySlug(slug); }
  catch {
    const t = await import('./toast.js');
    t.showError('森が見つかりません: ' + slug);
    return;
  }
  state.design = mergeDesign(state.room?.design);
  state.ambience = mergeAmbience(state.room?.ambience);
  state.atmo = atmosphereAt(new Date(), state.ambience);

  // URLパラメタからトークン処理
  const params = new URLSearchParams(location.search);
  // 合言葉/メール変更の承認リンク
  const credChangeToken = params.get('credchange');
  if (credChangeToken) {
    try {
      const res = await api.verifyCredentialChange(credChangeToken);
      const row = Array.isArray(res) ? res[0] : res;
      const { showToast } = await import('./toast.js');
      if (row.kind === 'passcode_change') showToast('合言葉を変更しました', 'success');
      else if (row.kind === 'email_change') showToast('メールアドレスを変更しました', 'success');
      else if (row.kind === 'tree_delete') {
        showToast('樹(ログインID)を削除しました', 'success');
        clearSession(slug);
        state.session = null; state.selfTreeId = null;
      }
    } catch (e) {
      const { showError } = await import('./toast.js');
      showError(e, 'リンクの検証に失敗しました');
    }
    const u = new URL(location.href);
    u.searchParams.delete('credchange');
    history.replaceState(null, '', u.toString());
  }
  // 合言葉リセットリンク
  const resetToken = params.get('reset');
  if (resetToken) {
    // 新合言葉をpromptで受け取る(最小UI)
    const newPw = prompt('新しい合言葉を入力してください(4桁以上)');
    if (newPw && newPw.length >= 4) {
      try {
        const res = await api.verifyPasscodeReset(resetToken, newPw);
        const row = Array.isArray(res) ? res[0] : res;
        const { saveSession } = await import('./auth.js');
        state.session = { treeId: row.tree_id, editToken: row.edit_token, treeName: row.name };
        saveSession(slug, state.session);
        state.selfTreeId = row.tree_id;
        const { showToast } = await import('./toast.js');
        showToast('合言葉を変更しました。ログイン済みです。', 'success');
      } catch (e) {
        const { showError } = await import('./toast.js');
        showError(e, 'リンクの検証に失敗しました');
      }
    }
    const u = new URL(location.href);
    u.searchParams.delete('reset');
    history.replaceState(null, '', u.toString());
  }

  // 新規登録の本登録リンク: ?verify=<token>
  const verifyToken = params.get('verify');
  if (verifyToken) {
    try {
      const res = await api.verifyRegistration(verifyToken);
      const row = Array.isArray(res) ? res[0] : res;
      const { saveSession } = await import('./auth.js');
      state.session = { treeId: row.tree_id, editToken: row.edit_token, treeName: row.name };
      saveSession(slug, state.session);
      state.selfTreeId = row.tree_id;
      // 復元キーを一度だけ表示
      const m = document.getElementById('recovery-modal');
      if (m && row.recovery_key) {
        document.getElementById('recovery-key').textContent = row.recovery_key;
        m.classList.remove('hidden');
        document.getElementById('recovery-copy').onclick = async () => {
          await navigator.clipboard.writeText(row.recovery_key);
          document.getElementById('recovery-copy').textContent = 'コピーしました';
        };
        document.getElementById('recovery-ok').onclick = () => m.classList.add('hidden');
      }
      const { showToast } = await import('./toast.js');
      showToast('本登録が完了しました', 'success');
    } catch (e) {
      const { showError } = await import('./toast.js');
      showError(e, '本登録に失敗しました');
    }
    // URLから?verifyを除去(リロードで再実行しない)
    const url = new URL(location.href);
    url.searchParams.delete('verify');
    history.replaceState(null, '', url.toString());
  }

  const roomLabel = state.room.name || state.room.slug;
  document.getElementById('forest-name').textContent = roomLabel;
  document.title = `${roomLabel} — morinokki`;

  // 画面右上のリアルタイム時計(HH:MM:SS)
  const clockEl = document.getElementById('room-clock');
  if (clockEl) {
    const pad = (n) => String(n).padStart(2, '0');
    const updateClock = () => {
      const d = new Date();
      clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

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
      clearSession(slug);
      state.session = null;
      state.selfTreeId = null;
      state.selection = null;
      updatePanel(); updatePlantBtn(); forest.render();
      showToast('ログアウトしました', 'success');
    },
    onRerender: () => { updatePanel(); forest.render(); },
    onExportCsv: () => {
      try { exportForestCsv(state); showToast('CSVをダウンロードしました', 'success'); }
      catch (e) { showError(e, 'CSV書き出しに失敗しました'); }
    },
    onTimelapse: () => startTimelapse(),
    onAdminCreateTree: async (name) => {
      if (!state.adminToken) throw new Error('管理者でログインしてください');
      const tree = await api.adminCreateTree(state.adminToken, state.room.slug, name);
      await reload();
      const created = state.trees.find(t => t.id === tree.id);
      if (created) state.selection = { kind: 'tree', tree: created };
      live.notifyDataChanged();
      updatePanel(); forest.render();
      showToast(`幹「${name}」を作成しました`, 'success');
    },
    onAdminLogout: () => {
      // グローバル管理者ログアウト: localStorageを消して/admin5002へ
      state.adminToken = null;
      localStorage.removeItem(ADMIN_KEY);
      showToast('管理者ログアウト', 'success');
      location.href = '/admin5002';
    },
    onDesignPreview: (nextDesign) => {
      state.design = mergeDesign(nextDesign);
      forest.render();
    },
    onDesignChange: async (nextDesign) => {
      state.design = mergeDesign(nextDesign);
      forest.render();
      if (!state.adminToken) return;
      try { await api.setRoomDesign(state.adminToken, state.room.slug, state.design); }
      catch (e) { showError(e, 'デザイン保存に失敗しました'); }
    },
    onAuthLogin: async ({ name, passcode }) => {
      const res = await api.loginTree(state.room.slug, name, passcode);
      const row = Array.isArray(res) ? res[0] : res;
      state.session = { treeId: row.tree_id, editToken: row.edit_token, treeName: name };
      const { saveSession } = await import('./auth.js');
      saveSession(slug, state.session);
      state.selfTreeId = row.tree_id;
      await reload();
      const mine = state.trees.find(t => t.id === state.selfTreeId);
      if (mine) state.selection = { kind: 'tree', tree: mine };
      live.notifyDataChanged();
      updatePanel(); forest.render();
      showToast('ログインしました', 'success');
    },
    onAuthPlant: async ({ name, passcode, email }) => {
      // 仮登録: メール送信まで。実体化(trees行生成)はメールリンククリックで。
      await api.requestTreeRegistration(state.room.slug, name, passcode, email, location.origin);
      showToast('確認メールを送りました', 'success');
      return { pending: true };
    },
    onForgotPass: async ({ name }) => {
      const res = await api.requestPasscodeReset(state.room.slug, name, location.origin);
      if (res?.sent) return { sent: true };
      if (res?.reason === 'name_not_found') return { nameNotFound: true };
      if (res?.reason === 'no_email') return { noEmail: true };
      return {};
    },
    onRequestPasscodeChange: async (newPasscode) => {
      if (!state.session?.editToken) throw new Error('ログインが必要です');
      await api.requestPasscodeChange(state.session.editToken, newPasscode, location.origin);
      showToast('確認メールを送りました。現在のメール宛のリンクをクリックして完了してください。', 'success');
    },
    onRequestEmailChange: async (newEmail) => {
      if (!state.session?.editToken) throw new Error('ログインが必要です');
      await api.requestEmailChange(state.session.editToken, newEmail, location.origin);
      showToast(`確認メールを ${newEmail} に送りました。リンクをクリックして完了してください。`, 'success');
    },
    onRequestTreeDeletion: async () => {
      if (!state.session?.editToken) throw new Error('ログインが必要です');
      await api.requestTreeSelfDeletion(state.session.editToken, location.origin);
      showToast('削除確認メールを送りました。メール内のリンクをクリックすると削除が確定します。', 'success');
    },
    onRequestPasscodeReset: async (name) => {
      const res = await api.requestPasscodeReset(state.room.slug, name, location.origin);
      if (res?.sent) showToast('登録メールに再設定リンクを送りました', 'success');
      else showToast('この名前にはメールが登録されていません', 'error');
    },
    // 管理者: ユーザー管理
    onAdminListUsers: async () => {
      if (!state.adminToken) return [];
      return await api.adminListUsers(state.adminToken, state.room.slug);
    },
    onAdminDeleteUser: async (treeId) => {
      await api.adminDeleteUser(state.adminToken, treeId);
      await reload();
      state.selection = null;
      live.notifyDataChanged();
      updatePanel(); forest.render();
      showToast('削除しました', 'success');
    },
    onAdminResetUserPasscode: async (treeId) => {
      const res = await api.adminResetUserPasscode(state.adminToken, treeId);
      const row = Array.isArray(res) ? res[0] : res;
      if (row?.sent) showToast('新しい合言葉を本人のメールに送りました', 'success');
      else alert('メール未登録のユーザーです。新しい合言葉:\n\n' + (row?.new_passcode || ''));
    },
    onAdminSetUserEmail: async (treeId, newEmail) => {
      await api.adminSetUserEmail(state.adminToken, treeId, newEmail || '');
      await reload();
      updatePanel();
      showToast('メールを更新しました', 'success');
    },
    // 樹の表示/非表示トグル(ローカル)
    onToggleHideAll: () => {
      state.hideAllTrees = !state.hideAllTrees;
      localStorage.setItem(HIDE_ALL_KEY, state.hideAllTrees ? '1' : '0');
      updatePanel(); forest.render();
    },
    // 管理者: 背景・ギミック
    onAmbiencePreview: (nextAmbience) => {
      state.ambience = mergeAmbience(nextAmbience);
      state.atmo = atmosphereAt(new Date(), state.ambience);
      forest.render();
    },
    onAmbienceChange: async (nextAmbience) => {
      state.ambience = mergeAmbience(nextAmbience);
      state.atmo = atmosphereAt(new Date(), state.ambience);
      forest.render();
      if (!state.adminToken) return;
      try { await api.setRoomAmbience(state.adminToken, state.room.slug, state.ambience); }
      catch (e) { showError(e, '背景設定の保存に失敗しました'); }
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
  function updatePlantBtn() { /* plant-btn removed in favor of panel-in auth */ }
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

  // ===== Phase 2: 生きている森 =====
  console.log('[phase2] init');
  const treeIdsRef = new Set((state.trees || []).map(t => t.id));
  const live = new LiveForest(() => state.trees, () => forest.render(), () => state.design);

  // 初回表示の前に 2-step pre-tick で「安定した初期状態」を仕込む。
  //   1) 最初の render:  nodes の _x / _restX を populate(tree.x ベース)
  //   2) live.tick():    trunk sway + node sim + hard separation を適用
  //   3) 次の render:   step 2 を反映した「すでに揺らいで・重なりも解消した」状態
  // これにより最初にユーザーが見る画面が既に動作中の状態になり、
  // アプリを開いた瞬間の "ぱっ" という立ち上がりジャンプが消える。
  forest.render();
  live.tick();
  forest.render();
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
  state.onNodeReparented = async (tree, node, newParent) => {
    const token = state.adminToken || state.session?.editToken;
    if (!token) return;
    try {
      const saved = await api.reparentNode(token, node.id, newParent.id);
      Object.assign(node, saved);
      forest.render();
      showToast(`「${newParent.text}」の子に移しました`, 'success');
    } catch (e) { showError(e, '付け替えに失敗しました'); }
  };
  state.onNodeMoved = async (tree, node) => {
    forest.render();
    // ドラッグ終了で連動波紋
    live.bumpNode(node, 4);
    const token = state.adminToken || state.session?.editToken;
    if (!token) return;
    try {
      const saved = await api.upsertNode(token, tree.id, {
        id: node.id, text: node.text, size: node.size, color: node.color, ord: node.ord,
        offset_x: node.offset_x, offset_y: node.offset_y, description: node.description
      });
      Object.assign(node, saved);
      forest.render();
    } catch (e) { showError(e, 'ノードの移動を保存できませんでした'); }
  };

  // パネル開閉トグル
  const PANEL_HIDE_KEY = 'mori.panel.hidden';
  const panelToggle = document.getElementById('panel-toggle');
  if (localStorage.getItem(PANEL_HIDE_KEY) === '1') document.body.classList.add('panel-hidden');
  panelToggle?.addEventListener('click', () => {
    const hidden = document.body.classList.toggle('panel-hidden');
    localStorage.setItem(PANEL_HIDE_KEY, hidden ? '1' : '0');
    // 描画領域が変わったらcanvasもresize+再描画
    setTimeout(() => { forest.resize(); forest.render(); }, 260);
  });

  // 時間帯を1分ごとに更新(1時間/24段階でゆっくり推移)
  setInterval(() => {
    state.atmo = atmosphereAt(new Date(), state.ambience);
    forest.render();
  }, 60000);

  // ===== タイムラプス =====
  const tlBar = document.getElementById('timelapse-bar');
  const tlPlay = document.getElementById('tl-play');
  const tlSlider = document.getElementById('tl-slider');
  const tlLabel = document.getElementById('tl-label');
  const tlClose = document.getElementById('tl-close');
  let tlInterval = null;
  let tlRange = null;

  function startTimelapse() {
    if (!state.trees.length) { showToast('樹がまだありません'); return; }
    const ts = state.trees.map(t => Date.parse(t.created_at || Date.now())).filter(Number.isFinite);
    (state.trees || []).forEach(t => (t.nodes || []).forEach(n => {
      const nt = Date.parse(n.created_at || 0);
      if (Number.isFinite(nt)) ts.push(nt);
    }));
    const minT = Math.min(...ts), maxT = Math.max(...ts);
    if (minT >= maxT) { showToast('時間の幅が足りません'); return; }
    tlRange = { min: minT, max: maxT };
    tlBar.classList.remove('hidden');
    tlSlider.value = 0;
    state.timeCursor = minT;
    updateTlLabel();
    forest.render();
    tlPlay.textContent = '▶';
  }
  function stopTimelapse() {
    if (tlInterval) { clearInterval(tlInterval); tlInterval = null; }
    state.timeCursor = null;
    tlBar.classList.add('hidden');
    forest.render();
  }
  function updateTlLabel() {
    if (!state.timeCursor) return;
    const d = new Date(state.timeCursor);
    tlLabel.textContent = `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  tlClose?.addEventListener('click', stopTimelapse);
  tlSlider?.addEventListener('input', () => {
    if (!tlRange) return;
    const ratio = Number(tlSlider.value) / 1000;
    state.timeCursor = tlRange.min + (tlRange.max - tlRange.min) * ratio;
    updateTlLabel();
    forest.render();
  });
  tlPlay?.addEventListener('click', () => {
    if (tlInterval) {
      clearInterval(tlInterval); tlInterval = null; tlPlay.textContent = '▶'; return;
    }
    if (Number(tlSlider.value) >= 1000) tlSlider.value = 0;
    tlPlay.textContent = '⏸';
    tlInterval = setInterval(() => {
      const next = Math.min(1000, Number(tlSlider.value) + 8);
      tlSlider.value = next;
      tlSlider.dispatchEvent(new Event('input'));
      if (next >= 1000) { clearInterval(tlInterval); tlInterval = null; tlPlay.textContent = '▶'; }
    }, 80);
  });

  // テスト/デバッグ用にstateを公開
  window.__morinoki = { state, forest, live };

  async function reload() {
    const trees = await api.getTrees(state.room.id);
    const ids = trees.map(t => t.id);
    const nodes = ids.length ? await api.getNodes(ids) : [];
    const byTree = {};
    nodes.forEach(n => (byTree[n.tree_id] ||= []).push(n));
    trees.forEach(t => { t.nodes = (byTree[t.id] || []).sort((a,b) => a.ord - b.ord); });
    state.trees = trees;
    layoutRandom(state.trees, state.sessionSeed);
    document.getElementById('forest-count').textContent = `${trees.length}本の樹`;
  }
}
