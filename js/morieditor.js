// moritetu1st 部屋の初期化と UI 配線
//   - 完全wiki: 誰でもログイン不要でノード作成・編集・削除・接続
//   - sessionStorage の anonId を使って RPC を呼ぶ(スパムスロットルキー)
//   - admin 用: ユーザータブ=アクティブUU、メッセージ編集、ヒートマップ
//
// app.js の initRoom 内、field_type='moritetu1st' のときのみ
// import + 呼び出される。

import { api } from './supabase.js';
import { renderRoomMessageHtml } from './app.js';

export async function initMoriRoom({ state, slug }) {
  const { createMoriForest } = await import('./moriforest.js');
  const { renderInfoPanel } = await import('./editor.js');
  const { showToast, showError } = await import('./toast.js');
  const { subscribeRoom, debounce } = await import('./realtime.js');

  state.moriNodes = [];
  state.moriEdges = [];
  state.headerMessage = '';

  const PALETTE = [
    '#5a9b6e','#6f8a7d',
    '#c9dca8','#a8c19a','#8ab0a0','#b8e0cc',
    '#f4ecb0','#f2ece0','#f4cfd6','#cdb4dc',
  ];
  state.moriPalette = PALETTE;

  // 部屋データ読み込み(ノード・エッジ・メッセージ)
  async function reload() {
    const res = await api.moriList(slug);
    const r = Array.isArray(res) ? res[0] : res;
    state.moriNodes = (r?.nodes || []).map(normalizeNode);
    state.moriEdges = (r?.edges || []);
    state.headerMessage = r?.message || '';
    state.applyRoomMessage && state.applyRoomMessage(state.headerMessage);
    document.getElementById('forest-count').textContent = `${state.moriNodes.length}本の樹`;
    const ncEl = document.getElementById('node-count');
    if (ncEl) ncEl.textContent = '';  // moritetu では枝総数を出さない
  }

  await reload();

  const canvas = document.getElementById('forest-canvas');
  const forest = createMoriForest(canvas, state);

  // インフォパネルの簡易wire(編集モーダル等は editor.js のものを部分流用)
  function updatePanel() {
    renderInfoPanel(state, state.selection, callbacks);
  }

  const onTreeMovedDebounced = debounce(async (n) => {
    if (!state.anonId) return;
    try { await api.moriMoveNode(slug, state.anonId, n.id, n.x, n.y); }
    catch (e) { console.warn('moveNode', e); }
  }, 300);

  const callbacks = {
    onRerender: () => updatePanel(),
    onLogout: () => {},  // moritetu はログイン無し
    onMoriEditNode: (node) => {
      state.selection = { kind: 'mori-node', node };
      updatePanel();
    },
    onMoriBack: () => {
      state.selection = null;
      updatePanel();
    },
    onMoriUpdateNode: async ({ nodeId, text, color, description }) => {
      if (!state.anonId) return;
      try {
        await api.moriUpdateNode(slug, state.anonId, nodeId, { text, color, description });
        await reload();
        updatePanel();
        forest.render();
      } catch (e) { showError(e, '保存失敗'); }
    },
    onMoriDeleteNode: async (nodeId) => {
      if (!state.anonId) return;
      if (!confirm('このマイワードを削除しますか?')) return;
      try {
        await api.moriDeleteNode(slug, state.anonId, nodeId);
        state.selection = null;
        await reload();
        updatePanel();
        forest.render();
      } catch (e) { showError(e, '削除失敗'); }
    },
    // 管理者
    onAdminListActiveUsers: async (withinMinutes = 30) => {
      if (!state.adminToken) return [];
      try { return await api.adminListActiveUsers(state.adminToken, slug, withinMinutes); }
      catch { return []; }
    },
    onAdminGetUniqueUsersHourly: async (days = 7) => {
      if (!state.adminToken) return [];
      try { return await api.adminGetUniqueUsersHourly(state.adminToken, slug, days); }
      catch { return []; }
    },
    onAdminGetStats: async (days = 30) => {
      if (!state.adminToken) return null;
      try {
        const res = await api.adminGetStats(state.adminToken, slug, days);
        return Array.isArray(res) ? res[0] : res;
      } catch (e) { console.warn('adminGetStats', e); return null; }
    },
    // Tips(お知らせ)
    onAdminListTips: async () => {
      if (!state.adminToken) return [];
      return await api.adminListTips(state.adminToken, slug);
    },
    onAdminCreateTip: async ({ title, body, enabled }) => {
      if (!state.adminToken) throw new Error('管理者ログインが必要です');
      await api.adminCreateTip(state.adminToken, slug, title, body, enabled);
      showToast('お知らせを追加しました', 'success');
    },
    onAdminUpdateTip: async ({ tipId, title, body, enabled }) => {
      if (!state.adminToken) throw new Error('管理者ログインが必要です');
      await api.adminUpdateTip(state.adminToken, tipId, title, body, enabled);
      showToast('お知らせを保存しました', 'success');
    },
    onAdminDeleteTip: async (tipId) => {
      if (!state.adminToken) throw new Error('管理者ログインが必要です');
      await api.adminDeleteTip(state.adminToken, tipId);
      showToast('お知らせを削除しました', 'success');
    },
    onAdminListTipReads: async (tipId) => {
      if (!state.adminToken) return [];
      return await api.adminListTipReads(state.adminToken, tipId);
    },
    onAdminSetRoomMessage: async (message) => {
      if (!state.adminToken) throw new Error('管理者ログインが必要です');
      await api.adminSetRoomMessage(state.adminToken, slug, message);
      state.headerMessage = message;
      state.applyRoomMessage && state.applyRoomMessage(message);
      showToast('メッセージを保存しました', 'success');
    },
    onAdminMoriResetRoom: async () => {
      if (!state.adminToken) throw new Error('管理者ログインが必要です');
      if (!confirm('この部屋のすべてのノードと接続を削除します。取り消し不可。よろしいですか?')) return;
      try {
        await api.adminMoriResetRoom(state.adminToken, slug);
        state.selection = null;
        await reload();
        updatePanel();
        forest.render();
        showToast('部屋をリセットしました', 'success');
      } catch (e) { showError(e, 'リセット失敗'); }
    },
    onAmbiencePreview: (nextAmbience) => {
      const { mergeAmbience } = pickAmbienceFns();
      state.ambience = mergeAmbience(nextAmbience);
      state._updateWeatherBadge && state._updateWeatherBadge();
      forest.render();
    },
    onAmbienceChange: async (nextAmbience) => {
      const { mergeAmbience } = pickAmbienceFns();
      state.ambience = mergeAmbience(nextAmbience);
      state._updateWeatherBadge && state._updateWeatherBadge();
      forest.render();
      if (!state.adminToken) return;
      try { await api.setRoomAmbience(state.adminToken, slug, state.ambience); }
      catch (e) { showError(e, '背景設定の保存に失敗しました'); }
    },
    onDesignPreview: (nextDesign) => {
      const { mergeDesign } = pickAmbienceFns();
      state.design = mergeDesign(nextDesign);
      forest.render();
    },
    onDesignChange: async (nextDesign) => {
      const { mergeDesign } = pickAmbienceFns();
      state.design = mergeDesign(nextDesign);
      forest.render();
      if (!state.adminToken) return;
      try { await api.setRoomDesign(state.adminToken, slug, state.design); }
      catch (e) { showError(e, 'デザイン設定の保存に失敗しました'); }
    },
    onAdminLogout: () => {
      localStorage.removeItem('mori.admin.global.token');
      state.adminToken = null;
      updatePanel();
    },
  };

  // モリビュー側のコールバック設定
  state.onMoriCreateNode = async (text, x, y) => {
    if (!state.anonId) return;
    try {
      const color = '#f4cfd6'; // ピンク色をデフォルトに
      await api.moriCreateNode(slug, state.anonId, text, color, x, y);
      await reload();        // 自分の操作は即時反映
      forest.render();        // 他のユーザーも Realtime broadcast 経由で同期される
    } catch (e) { showError(e, 'ノード作成失敗'); }
  };
  state.onMoriNodeMoved = async (n) => {
    onTreeMovedDebounced(n);
  };
  state.onMoriToggleEdge = async (a, b) => {
    if (!state.anonId) return;
    try {
      const res = await api.moriToggleEdge(slug, state.anonId, a.id, b.id);
      const r = Array.isArray(res) ? res[0] : res;
      const status = (typeof r === 'string') ? r : (r?.mori_toggle_edge || r);
      void status;
      await reload();
      forest.render();
    } catch (e) { showError(e, '接続/解除失敗'); }
  };
  state.onMoriNodeTap = (n) => {
    state.selection = { kind: 'mori-node', node: n };
    // ノード編集 → パネルを開く
    if (document.body.classList.contains('panel-hidden')) {
      document.body.classList.remove('panel-hidden');
      setTimeout(() => { forest.resize(); forest.render(); }, 260);
    }
    updatePanel();
  };
  state.onMoriEmptyTap = () => {
    state.selection = null;
    updatePanel();
  };

  // 初期描画
  updatePanel();
  forest.render();

  // パネル開閉トグル
  //   - 管理者: localStorage で永続(従来どおり、デフォルトは表示)
  //   - 非管理者(moritetu): 常に初期は非表示。トグルはセッション内のみ効く
  const PANEL_HIDE_KEY = 'mori.panel.hidden';
  const panelToggle = document.getElementById('panel-toggle');
  const isAdmin = !!state.adminToken;
  const stored = localStorage.getItem(PANEL_HIDE_KEY);
  const initiallyHidden = isAdmin ? (stored === '1') : true;
  if (initiallyHidden) {
    document.body.classList.add('panel-hidden');
    // パネル状態の変化に合わせて canvas 内部解像度を再計算
    //   ※ これがないと初回の getBoundingClientRect が古い大きさで固まり、
    //     CSS だけ伸びて canvas の内容が縦/横にストレッチされる
    requestAnimationFrame(() => { forest.resize(); forest.render(); });
  }
  panelToggle?.addEventListener('click', () => {
    const hidden = document.body.classList.toggle('panel-hidden');
    if (isAdmin) localStorage.setItem(PANEL_HIDE_KEY, hidden ? '1' : '0');
    setTimeout(() => { forest.resize(); forest.render(); }, 260);
  });

  // モバイルで初期ロード時にレイアウトが確定する前に resize() してしまい
  // canvas が縦伸びする問題への対策。ResizeObserver でキャンバスのサイズ
  // 変化(URLバー縮小・フォント読み込み完了・パネル表示変化など)を監視。
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { forest.resize(); forest.render(); });
    const canvasEl = document.getElementById('forest-canvas');
    if (canvasEl) ro.observe(canvasEl);
  }
  // visualViewport(モバイルブラウザのアドレスバー収縮)
  if (typeof window.visualViewport !== 'undefined') {
    window.visualViewport.addEventListener('resize', () => {
      forest.resize(); forest.render();
    });
  }

  // Realtime 購読
  const { realtimeReady } = await import('./supabase.js');
  await realtimeReady;
  const debouncedReload = debounce(async () => {
    await reload();
    forest.render();
  }, 250);
  subscribeRoom(state.room.id, new Set(), debouncedReload, () => {});

  // 描画ループ(ゆらぎを毎フレーム回したい場合)
  function loop() {
    if (document.visibilityState === 'visible') forest.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 公開
  window.__morinoki = { state, forest };
}

function normalizeNode(n) {
  return {
    id: n.id,
    text: n.text,
    color: n.color || '#5a9b6e',
    description: n.description || '',
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    size: n.size || 3,
    created_at: n.created_at,
    updated_at: n.updated_at,
  };
}

function pickAmbienceFns() {
  // designconfig は他で import 済みだが、循環回避のため遅延に dynamic import を使ってもよい
  // ここでは最小限、merge ロジックを再利用
  return {
    mergeAmbience: (raw) => raw,  // app.js の state.ambience はすでに merge 済みなのでスルー
    mergeDesign:   (raw) => raw,
  };
}
