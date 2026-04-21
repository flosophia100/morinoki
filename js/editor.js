import { api } from './supabase.js';
import { escapeHtml } from './utils.js';
import { META as DESIGN_META, DEFAULTS as DESIGN_DEFAULTS,
         AMBIENCE_DEFAULTS, TIME_CURVE_OPTIONS, SEASON_OPTIONS } from './designconfig.js';

// ===== CSVエクスポート(主催者向け) =====
export function exportForestCsv(state) {
  const rows = [['tree_name', 'created_at', 'keyword', 'size', 'color', 'description', 'parent_keyword']];
  (state.trees || []).forEach(t => {
    const nodes = t.nodes || [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    if (nodes.length === 0) {
      rows.push([t.name, t.created_at || '', '', '', '', '', '']);
      return;
    }
    nodes.forEach(n => {
      const parentName = n.parent_id ? byId.get(n.parent_id)?.text || '' : '';
      rows.push([t.name, t.created_at || '', n.text, n.size || '', n.color || '', n.description || '', parentName]);
    });
  });
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forest-${state.room?.slug || 'export'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Nordic色調のパレット(fjord sage / slate blue / amber / terracotta / birch)
const PALETTE = ['#6f8a7d','#7d98a8','#c89566','#b0624a','#9d8972','#435e52','#a7bcad','#e3c2b3','#8ea0a8','#b09d84'];

// ===== 左常駐パネル =====
// selection: null | { kind:'tree', tree } | { kind:'node', tree, node }
export function renderInfoPanel(state, selection, callbacks) {
  const el = document.getElementById('info-content');
  // admin モードなら 全樹を "自分の樹扱い" で編集UI表示
  const isSelfTree = (tree) => !!state.adminToken || (!!state.session && tree.id === state.selfTreeId);

  // ログイン済ならタイトル画面ではなく常に自分の樹を表示(未選択時のデフォルト)
  if (!selection && state.session) {
    const mine = (state.trees || []).find(t => t.id === state.selfTreeId);
    if (mine) selection = { kind: 'tree', tree: mine };
  }

  if (!selection) {
    el.innerHTML = idleHTML(state);
    wireIdle(el, state, callbacks);
    return;
  }
  if (selection.kind === 'tree') {
    if (isSelfTree(selection.tree)) {
      el.innerHTML = ownTreeHTML(selection.tree);
      wireOwnTree(el, state, selection.tree, callbacks);
    } else {
      el.innerHTML = otherTreeHTML(selection.tree, state);
      wireOtherTree(el, state, selection.tree, callbacks);
    }
    return;
  }
  if (selection.kind === 'node') {
    if (isSelfTree(selection.tree)) {
      el.innerHTML = ownNodeHTML(selection.tree, selection.node);
      wireOwnNode(el, state, selection.tree, selection.node, callbacks);
    } else {
      el.innerHTML = otherNodeHTML(selection.tree, selection.node);
      wireOtherNode(el, state, selection.tree, selection.node, callbacks);
    }
  }
}

// ----- Idle(未ログイン/タイトル画面) -----
function idleHTML(state) {
  const isAdmin = !!state.adminToken;
  const tab = state.authTab || 'login'; // 'login' | 'new'
  return `
    <div class="ip-block">
      <h2 class="ip-title">${escapeHtml(state.room?.name || state.room?.slug || 'morinokki')}${isAdmin ? ' <span class="admin-badge">管理</span>' : ''}</h2>
      <p class="ip-hint">${(state.trees || []).length} 本の樹${isAdmin ? ' ・ 管理者モード' : ''}</p>
    </div>
    ${isAdmin ? adminPanelHTML(state) : ''}
    ${!isAdmin ? `
      <div class="ip-block ip-auth-form">
        <div class="auth-tabs">
          <button data-auth-tab="login" class="auth-tab ${tab==='login'?'on':''}">ログイン</button>
          <button data-auth-tab="new" class="auth-tab ${tab==='new'?'on':''}">新しく植える</button>
        </div>
        ${tab === 'login' ? `
          <p class="ip-desc" style="margin-bottom:0.4rem">前に登録した名前と合言葉で入ります。</p>
          <label class="mini-label">名前</label>
          <input id="auth-name" type="text" maxlength="20" placeholder="登録した名前" autocomplete="off">
          <label class="mini-label">合言葉</label>
          <input id="auth-pass" type="password" minlength="4" maxlength="40" autocomplete="off" placeholder="合言葉">
          <button data-action="auth-login" class="btn-primary w-full" style="margin-top:0.6rem">ログイン</button>
          <p class="ip-hint" style="font-size:0.74rem;margin-top:0.5rem">
            合言葉を忘れた方は
            <button data-action="forgot-pass" class="btn-link">メールで再設定</button>
            (メール登録済みの方)
          </p>
          <p id="auth-error" class="error hidden"></p>
        ` : `
          <p class="ip-desc" style="margin-bottom:0.4rem">この森に新しい樹を植えます。名前は後から変更できません。確認メールのリンクで本登録を完了します。</p>
          <label class="mini-label">名前</label>
          <input id="auth-name" type="text" maxlength="20" placeholder="あなたの名前 / ニックネーム" autocomplete="off">
          <label class="mini-label">合言葉(4桁以上)</label>
          <input id="auth-pass" type="password" minlength="4" maxlength="40" autocomplete="off" placeholder="合言葉">
          <label class="mini-label">メール(必須)</label>
          <input id="auth-email" type="email" autocomplete="off" placeholder="you@example.com" required>
          <button data-action="auth-plant" class="btn-primary w-full" style="margin-top:0.6rem">登録メールを送る</button>
          <p id="auth-error" class="error hidden"></p>
          <p id="auth-pending" class="ip-hint hidden" style="font-size:0.8rem;margin-top:0.4rem;color:var(--moss-deep)"></p>
        `}
      </div>
    ` : ''}
  `;
}
// ----- 管理者パネル(タブ式) -----
function adminPanelHTML(state) {
  const tab = state.adminTab || 'users';
  const tabs = [
    ['users',    'ユーザー'],
    ['trunks',   '幹'],
    ['design',   'デザイン'],
    ['shimmer',  'ゆらぎ'],
    ['ambience', '背景'],
    ['tools',    'ツール'],
  ];
  return `
    <div class="ip-block admin-block">
      <label class="mini-label">管理者モード</label>
      <div class="admin-tabs">
        ${tabs.map(([k,l]) => `<button data-admin-tab="${k}" class="admin-tab ${tab===k?'on':''}">${l}</button>`).join('')}
      </div>
    </div>
    ${tab === 'users'    ? adminUsersTab(state)    : ''}
    ${tab === 'trunks'   ? adminTrunksTab(state)   : ''}
    ${tab === 'design'   ? adminDesignTab(state)   : ''}
    ${tab === 'shimmer'  ? adminShimmerTab(state)  : ''}
    ${tab === 'ambience' ? adminAmbienceTab(state) : ''}
    ${tab === 'tools'    ? adminToolsTab(state)    : ''}
    <div class="ip-block">
      <a href="/admin5002" class="btn-secondary w-full" style="display:inline-block;text-align:center;text-decoration:none">ダッシュボードへ</a>
      <button data-action="admin-logout" class="btn-secondary w-full" style="margin-top:0.4rem">管理者ログアウト</button>
    </div>
  `;
}

function adminUsersTab(state) {
  const users = state.adminUsers || [];
  const loading = state.adminUsersLoading;
  return `
    <div class="ip-block">
      <label class="mini-label">ユーザー管理</label>
      <p class="ip-desc" style="font-size:0.78rem;margin-bottom:0.4rem">幹の削除・合言葉リセット・メール変更</p>
      ${loading ? '<p class="ip-hint">読み込み中...</p>' : ''}
      ${!loading && !users.length ? '<p class="ip-hint">ユーザーはまだいません</p>' : ''}
      <ul class="admin-user-list">
        ${users.map(u => `
          <li class="admin-user-item" data-tree-id="${escapeHtml(u.tree_id)}">
            <div class="admin-user-head">
              <strong>${escapeHtml(u.name)}</strong>
              <span class="admin-user-meta">${u.node_count}ノード${u.email ? '・メール登録済' : '・メール未登録'}</span>
            </div>
            <div class="admin-user-email">${escapeHtml(u.email || '(未登録)')}</div>
            <div class="admin-user-actions">
              <button data-action="admin-user-reset" data-tree-id="${escapeHtml(u.tree_id)}" class="btn-sm btn-secondary">合言葉リセット</button>
              <button data-action="admin-user-email" data-tree-id="${escapeHtml(u.tree_id)}" class="btn-sm btn-secondary">メール変更</button>
              <button data-action="admin-user-delete" data-tree-id="${escapeHtml(u.tree_id)}" data-name="${escapeHtml(u.name)}" class="btn-sm btn-danger">削除</button>
            </div>
          </li>
        `).join('')}
      </ul>
      <button data-action="admin-users-refresh" class="btn-secondary w-full" style="margin-top:0.4rem">再読み込み</button>
    </div>
  `;
}

function adminTrunksTab(state) {
  return `
    <div class="ip-block">
      <label class="mini-label">新しい幹を作る(管理者特権)</label>
      <p class="ip-desc" style="font-size:0.78rem;margin-bottom:0.4rem">メール認証なしで幹を作成します。ユーザーログインはできません。</p>
      <div class="ip-row">
        <input id="admin-tree-name" type="text" maxlength="20" placeholder="幹の名前">
        <button id="admin-tree-create-btn" class="btn-sm btn-ink">＋作成</button>
      </div>
      <p id="admin-tree-error" class="error hidden" style="font-size:0.78rem"></p>
    </div>
  `;
}

function adminDesignTab(state) {
  const designKeys = ['trunkSize','nodeSize','density','lengthVar','bend','spikeChance','spikeLen','branchThickness','branchMeander'];
  return `
    <div class="ip-block">
      <label class="mini-label">樹のデザイン</label>
      <p class="ip-desc" style="font-size:0.78rem;margin-bottom:0.4rem">スライダーを動かすと、すべての樹の見た目が変わります。</p>
      ${DESIGN_META.filter(m => designKeys.includes(m.key)).map(m => {
        const v = state.design?.[m.key] ?? DESIGN_DEFAULTS[m.key];
        return `<div class="design-row">
          <label for="ds-${m.key}" class="design-label">${escapeHtml(m.label)}</label>
          <input id="ds-${m.key}" data-design-key="${m.key}" type="range" min="0" max="1" step="0.01" value="${v}">
        </div>`;
      }).join('')}
      <button data-action="design-reset" class="btn-secondary w-full" style="margin-top:0.4rem">既定に戻す</button>
    </div>
  `;
}

function adminShimmerTab(state) {
  const keys = ['shimmerAmp','shimmerSpeed','nodeShimmer'];
  return `
    <div class="ip-block">
      <label class="mini-label">ゆらぎ</label>
      <p class="ip-desc" style="font-size:0.78rem;margin-bottom:0.4rem">幹やノードの動きの強さ・速さ。</p>
      ${DESIGN_META.filter(m => keys.includes(m.key)).map(m => {
        const v = state.design?.[m.key] ?? DESIGN_DEFAULTS[m.key];
        return `<div class="design-row">
          <label for="ds-${m.key}" class="design-label">${escapeHtml(m.label)}</label>
          <input id="ds-${m.key}" data-design-key="${m.key}" type="range" min="0" max="1" step="0.01" value="${v}">
        </div>`;
      }).join('')}
    </div>
  `;
}

function adminAmbienceTab(state) {
  const amb = state.ambience || AMBIENCE_DEFAULTS;
  return `
    <div class="ip-block">
      <label class="mini-label">背景・ギミック</label>
      <p class="ip-desc" style="font-size:0.78rem;margin-bottom:0.4rem">時間帯・季節・鳥の頻度・背景森影の密度を調整。</p>
      <label class="design-label">時間帯</label>
      <select data-ambience-key="timeCurve" class="admin-select">
        ${TIME_CURVE_OPTIONS.map(o => `<option value="${o.value}" ${amb.timeCurve===o.value?'selected':''}>${escapeHtml(o.label)}</option>`).join('')}
      </select>
      <label class="design-label" style="margin-top:0.5rem">季節</label>
      <select data-ambience-key="season" class="admin-select">
        ${SEASON_OPTIONS.map(o => `<option value="${o.value}" ${amb.season===o.value?'selected':''}>${escapeHtml(o.label)}</option>`).join('')}
      </select>
      <div class="design-row" style="margin-top:0.5rem">
        <label class="design-label">鳥の出現頻度</label>
        <input data-ambience-key="birdFreq" type="range" min="0" max="1" step="0.01" value="${amb.birdFreq ?? 0.5}">
      </div>
      <div class="design-row">
        <label class="design-label">背景森影の密度</label>
        <input data-ambience-key="canopyDensity" type="range" min="0" max="1" step="0.01" value="${amb.canopyDensity ?? 0.5}">
      </div>
      <button data-action="ambience-reset" class="btn-secondary w-full" style="margin-top:0.4rem">既定に戻す</button>
    </div>
  `;
}

function adminToolsTab(state) {
  return `
    <div class="ip-block">
      <label class="mini-label">ツール</label>
      ${(state.trees || []).length > 0 ? `
        <button data-action="timelapse" class="btn-secondary w-full">タイムラプスで振り返る</button>
        <button data-action="export-csv" class="btn-secondary w-full" style="margin-top:0.4rem">森をCSVで書き出す</button>
      ` : '<p class="ip-hint">まだ幹がありません</p>'}
    </div>
  `;
}

function wireIdle(el, state, cb) {
  el.querySelector('[data-action="export-csv"]')?.addEventListener('click', () => cb.onExportCsv && cb.onExportCsv());
  el.querySelector('[data-action="timelapse"]')?.addEventListener('click', () => cb.onTimelapse && cb.onTimelapse());

  // タブ切替(ログイン ↔ 新規作成)
  el.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.authTab = btn.dataset.authTab;
      cb.onRerender && cb.onRerender();
    });
  });

  // 管理者ログアウト(ログインは /admin5002 でのみ行う)
  el.querySelector('[data-action="admin-logout"]')?.addEventListener('click', () => cb.onAdminLogout && cb.onAdminLogout());

  // 管理者タブ切替
  el.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.adminTab = btn.dataset.adminTab;
      // ユーザータブを開いたときだけ一覧をフェッチ
      if (state.adminTab === 'users' && cb.onAdminListUsers) {
        state.adminUsersLoading = true;
        cb.onRerender && cb.onRerender();
        try { state.adminUsers = await cb.onAdminListUsers(); }
        catch { state.adminUsers = []; }
        state.adminUsersLoading = false;
      }
      cb.onRerender && cb.onRerender();
    });
  });

  // ユーザー管理: 再読み込み
  el.querySelector('[data-action="admin-users-refresh"]')?.addEventListener('click', async () => {
    if (!cb.onAdminListUsers) return;
    state.adminUsersLoading = true;
    cb.onRerender && cb.onRerender();
    state.adminUsers = await cb.onAdminListUsers();
    state.adminUsersLoading = false;
    cb.onRerender && cb.onRerender();
  });
  // 削除
  el.querySelectorAll('[data-action="admin-user-delete"]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.treeId; const name = b.dataset.name;
      if (!confirm(`「${name}」を削除します。幹と枝が全て消えます。よろしいですか?`)) return;
      await cb.onAdminDeleteUser(id);
      if (cb.onAdminListUsers) state.adminUsers = await cb.onAdminListUsers();
      cb.onRerender && cb.onRerender();
    });
  });
  // 合言葉リセット
  el.querySelectorAll('[data-action="admin-user-reset"]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.treeId;
      if (!confirm('このユーザーの合言葉をリセットします。新合言葉がメールに送信されます(メール未登録なら画面表示)。よろしいですか?')) return;
      await cb.onAdminResetUserPasscode(id);
    });
  });
  // メール変更(管理者)
  el.querySelectorAll('[data-action="admin-user-email"]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.treeId;
      const newEmail = prompt('新しいメールアドレス(空でメール解除)');
      if (newEmail == null) return;
      await cb.onAdminSetUserEmail(id, newEmail);
      if (cb.onAdminListUsers) state.adminUsers = await cb.onAdminListUsers();
      cb.onRerender && cb.onRerender();
    });
  });

  // 背景・ギミック(ambience)
  let ambTimer = null;
  function saveAmbienceSoon() {
    clearTimeout(ambTimer);
    ambTimer = setTimeout(() => cb.onAmbienceChange && cb.onAmbienceChange({ ...state.ambience }), 350);
  }
  el.querySelectorAll('[data-ambience-key]').forEach(input => {
    input.addEventListener('input', () => {
      const k = input.dataset.ambienceKey;
      const raw = input.value;
      const val = (input.type === 'range') ? Number(raw) : raw;
      state.ambience = { ...(state.ambience || {}), [k]: val };
      cb.onAmbiencePreview && cb.onAmbiencePreview(state.ambience);
      saveAmbienceSoon();
    });
    input.addEventListener('change', () => {
      const k = input.dataset.ambienceKey;
      const val = (input.type === 'range') ? Number(input.value) : input.value;
      state.ambience = { ...(state.ambience || {}), [k]: val };
      cb.onAmbiencePreview && cb.onAmbiencePreview(state.ambience);
      saveAmbienceSoon();
    });
  });
  el.querySelector('[data-action="ambience-reset"]')?.addEventListener('click', () => {
    state.ambience = { ...AMBIENCE_DEFAULTS };
    cb.onAmbiencePreview && cb.onAmbiencePreview(state.ambience);
    cb.onAmbienceChange && cb.onAmbienceChange({ ...state.ambience });
    cb.onRerender && cb.onRerender();
  });

  // 管理者による幹の作成
  const admTreeBtn = el.querySelector('#admin-tree-create-btn');
  const admTreeErr = el.querySelector('#admin-tree-error');
  admTreeBtn?.addEventListener('click', async () => {
    admTreeErr?.classList.add('hidden');
    const name = el.querySelector('#admin-tree-name')?.value?.trim();
    if (!name) { admTreeErr.textContent = '名前を入力してください'; admTreeErr.classList.remove('hidden'); return; }
    if (!cb.onAdminCreateTree) return;
    try { await cb.onAdminCreateTree(name); }
    catch (e) { admTreeErr.textContent = e.message || '作成失敗'; admTreeErr.classList.remove('hidden'); }
  });
  el.querySelector('#admin-tree-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') admTreeBtn?.click(); });

  // デザインスライダー(管理者のみ存在)
  const sliders = el.querySelectorAll('input[data-design-key]');
  if (sliders.length) {
    let tSave = null;
    const saveSoon = () => {
      clearTimeout(tSave);
      tSave = setTimeout(() => cb.onDesignChange && cb.onDesignChange({ ...state.design }), 350);
    };
    sliders.forEach(s => {
      s.addEventListener('input', () => {
        const k = s.dataset.designKey;
        const v = Number(s.value);
        if (!Number.isFinite(v)) return;
        state.design = { ...(state.design || {}), [k]: v };
        // 即時にpreviewだけ反映(サーバ保存はdebounce)
        cb.onDesignPreview && cb.onDesignPreview(state.design);
        saveSoon();
      });
    });
    el.querySelector('[data-action="design-reset"]')?.addEventListener('click', () => {
      state.design = { ...DESIGN_DEFAULTS };
      sliders.forEach(s => { s.value = state.design[s.dataset.designKey]; });
      cb.onDesignPreview && cb.onDesignPreview(state.design);
      cb.onDesignChange && cb.onDesignChange({ ...state.design });
    });
  }

  const err = el.querySelector('#auth-error');
  function showErr(msg) { if (err) { err.textContent = msg; err.classList.remove('hidden'); } }

  const loginBtn = el.querySelector('[data-action="auth-login"]');
  loginBtn?.addEventListener('click', async () => {
    err?.classList.add('hidden');
    const nm = el.querySelector('#auth-name').value.trim();
    const pw = el.querySelector('#auth-pass').value;
    if (!nm) return showErr('名前を入力してください');
    if (pw.length < 4) return showErr('合言葉または復元キーを入力してください');
    if (!cb.onAuthLogin) return;
    try { await cb.onAuthLogin({ name: nm, passcode: pw }); }
    catch (e) { showErr(e.message || 'ログインできませんでした'); }
  });

  const plantBtn = el.querySelector('[data-action="auth-plant"]');
  plantBtn?.addEventListener('click', async () => {
    err?.classList.add('hidden');
    const pending = el.querySelector('#auth-pending');
    pending?.classList.add('hidden');
    const nm = el.querySelector('#auth-name').value.trim();
    const pw = el.querySelector('#auth-pass').value;
    const email = el.querySelector('#auth-email')?.value.trim() || '';
    if (!nm) return showErr('名前を入力してください');
    if (pw.length < 4) return showErr('合言葉は4桁以上にしてください');
    if (!email || !email.includes('@')) return showErr('メールアドレスを入力してください(本登録に必要です)');
    if (!cb.onAuthPlant) return;
    try {
      const result = await cb.onAuthPlant({ name: nm, passcode: pw, email });
      // 仮登録成功: メール案内を表示しフォームはそのまま残す
      if (result?.pending) {
        if (pending) {
          pending.textContent = `「${email}」に確認メールを送りました。届いたリンクをクリックして本登録を完了してください。`;
          pending.classList.remove('hidden');
        }
        plantBtn.disabled = true;
        plantBtn.textContent = '送信済み';
      }
    }
    catch (e) { showErr(e.message || '登録できませんでした'); }
  });

  el.querySelector('[data-action="forgot-pass"]')?.addEventListener('click', async () => {
    err?.classList.add('hidden');
    const nm = el.querySelector('#auth-name').value.trim();
    if (!nm) return showErr('先に名前を入力してください');
    if (!cb.onForgotPass) return;
    try { await cb.onForgotPass({ name: nm }); }
    catch (e) { showErr(e.message || 'メール送信できませんでした'); }
  });

  // Enterで送信(どちらのタブでも)
  el.querySelectorAll('#auth-name, #auth-pass, #auth-email').forEach(inp => {
    inp?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      (loginBtn || plantBtn)?.click();
    });
  });
}

// ----- 自分の樹(幹タップ) -----
function ownTreeHTML(tree) {
  const topLevel = (tree.nodes || []).filter(n => !n.parent_id).sort((a,b) => (a.ord||0) - (b.ord||0));
  const email = tree.recovery_email || '';
  return `
    <div class="ip-block">
      <div class="ip-head">
        <span class="self-badge">自分の樹</span>
        <h2 class="ip-title">${escapeHtml(tree.name)}</h2>
      </div>
    </div>
    <div class="ip-block">
      <label class="mini-label">キーワードを増やす</label>
      <div class="ip-row">
        <input id="ip-add-input" type="text" maxlength="20" placeholder="例: 音楽">
        <button id="ip-add-btn" class="btn-sm btn-ink">＋</button>
      </div>
    </div>
    <div class="ip-block ip-list">
      <label class="mini-label">キーワード</label>
      ${topLevel.length === 0
        ? '<p class="ip-hint">まだありません</p>'
        : `<ul class="ip-kw-list">${topLevel.map(n => kwItemHTML(tree, n)).join('')}</ul>`}
    </div>
    <details class="ip-block">
      <summary class="mini-label" style="cursor:pointer">合言葉・メールを変える</summary>
      <div style="margin-top:0.6rem">
        <p class="ip-hint" style="font-size:0.74rem;margin-bottom:0.4rem">どちらの変更も、登録メール宛に届く確認リンクをクリックするまで反映されません。</p>

        <label class="mini-label">新しい合言葉(4桁以上)</label>
        <input id="cr-pass" type="password" minlength="4" maxlength="40" autocomplete="new-password" placeholder="新しい合言葉">
        <button id="cr-pass-save" class="btn-secondary w-full" style="margin-top:0.4rem">合言葉の変更を申請</button>

        <label class="mini-label" style="margin-top:0.6rem">現在のメール</label>
        <input id="cr-email-current" type="email" value="${escapeHtml(email)}" readonly style="background:rgba(82,97,110,0.06)">
        <label class="mini-label">新しいメール</label>
        <input id="cr-email-new" type="email" autocomplete="off" placeholder="new@example.com">
        <button id="cr-email-save" class="btn-secondary w-full" style="margin-top:0.4rem">メールの変更を申請</button>

        <p id="cr-msg" class="ip-hint" style="font-size:0.74rem;margin-top:0.4rem"></p>
      </div>
    </details>
    <div class="ip-block">
      <button data-action="logout" class="btn-secondary w-full">ログアウト</button>
    </div>
  `;
}
function kwItemHTML(tree, node) {
  const sub = (tree.nodes || []).filter(n => n.parent_id === node.id).sort((a,b) => (a.ord||0) - (b.ord||0));
  return `
    <li class="ip-kw" data-node-id="${node.id}">
      <div class="ip-kw-row">
        <span class="dot" style="background:${node.color}"></span>
        <span class="kw">${escapeHtml(node.text)}</span>
        ${node.description ? '<span class="desc-mark" title="説明あり">…</span>' : ''}
      </div>
      ${sub.length ? `<ul class="ip-sub">${sub.map(s => `<li class="ip-sub-item" data-node-id="${s.id}"><span class="dot-sm" style="background:${s.color}"></span>${escapeHtml(s.text)}</li>`).join('')}</ul>` : ''}
    </li>
  `;
}
function wireOwnTree(el, state, tree, cb) {
  el.querySelector('[data-action="logout"]')?.addEventListener('click', () => cb.onLogout && cb.onLogout());

  // 合言葉変更(メール認証経由)
  const crPassBtn = el.querySelector('#cr-pass-save');
  crPassBtn?.addEventListener('click', async () => {
    const msg = el.querySelector('#cr-msg');
    const pw = el.querySelector('#cr-pass').value;
    if (!pw || pw.length < 4) { if (msg) msg.textContent = '合言葉は4桁以上にしてください'; return; }
    if (!cb.onRequestPasscodeChange) return;
    try {
      await cb.onRequestPasscodeChange(pw);
      if (msg) msg.textContent = '確認メールを送りました。届いたリンクをクリックして完了してください。';
      el.querySelector('#cr-pass').value = '';
    } catch (e) { if (msg) msg.textContent = '送信失敗: ' + (e.message || ''); }
  });

  // メール変更(新メール宛に認証リンク、旧メール宛に通知)
  const crEmailBtn = el.querySelector('#cr-email-save');
  crEmailBtn?.addEventListener('click', async () => {
    const msg = el.querySelector('#cr-msg');
    const newEmail = el.querySelector('#cr-email-new').value.trim();
    if (!newEmail || !newEmail.includes('@')) { if (msg) msg.textContent = '新しいメールアドレスを正しく入力してください'; return; }
    if (!cb.onRequestEmailChange) return;
    try {
      await cb.onRequestEmailChange(newEmail);
      if (msg) msg.textContent = `「${newEmail}」に確認メールを送りました。`;
      el.querySelector('#cr-email-new').value = '';
    } catch (e) { if (msg) msg.textContent = '送信失敗: ' + (e.message || ''); }
  });

  const input = el.querySelector('#ip-add-input');
  const btn = el.querySelector('#ip-add-btn');
  async function addOne() {
    const txt = input.value.trim();
    if (!txt) return;
    try {
      const saved = await api.upsertNode((state.adminToken || state.session?.editToken), tree.id, {
        text: txt, size: 3, color: PALETTE[0],
        ord: (tree.nodes || []).filter(n => !n.parent_id).length,
        parent_id: null
      });
      tree.nodes = tree.nodes || [];
      tree.nodes.push(saved);
      input.value = '';
      cb.onRerender && cb.onRerender();
    } catch (e) { import('./toast.js').then(m => m.showError(e, '保存失敗')); }
  }
  btn?.addEventListener('click', addOne);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addOne(); });
  el.querySelectorAll('.ip-kw').forEach(li => {
    li.addEventListener('click', (ev) => {
      if (ev.target.closest('.ip-sub-item')) return;
      const nid = li.dataset.nodeId;
      const node = tree.nodes.find(n => n.id === nid);
      if (node && cb.onSelectNode) cb.onSelectNode(tree, node);
    });
  });
  el.querySelectorAll('.ip-sub-item').forEach(li => {
    li.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const nid = li.dataset.nodeId;
      const node = tree.nodes.find(n => n.id === nid);
      if (node && cb.onSelectNode) cb.onSelectNode(tree, node);
    });
  });
}

// ----- 他人の樹 -----
function otherTreeHTML(tree, state) {
  const topLevel = (tree.nodes || []).filter(n => !n.parent_id).sort((a,b) => (a.ord||0) - (b.ord||0));
  const d = new Date(tree.createdAt || tree.created_at);
  const dateStr = isNaN(d) ? '' : ` · ${d.getMonth()+1}月${d.getDate()}日`;

  // 共通キーワードと近くの樹を計算
  const myTree = state?.trees?.find(t => t.id === state.selfTreeId);
  const common = myTree ? findCommonKeywords(myTree, tree) : [];
  const near = findNearbyTrees(tree, state?.trees || [], 3);

  return `
    <div class="ip-block">
      <p class="ip-back-link"><button data-action="to-self" class="btn-link">← 自分の樹へ</button></p>
      <div class="ip-head">
        <h2 class="ip-title">${escapeHtml(tree.name)} さん</h2>
        <p class="ip-hint">${(tree.nodes||[]).length} 個のキーワード${dateStr}</p>
      </div>
    </div>
    <div class="ip-block ip-list">
      <label class="mini-label">キーワード</label>
      ${topLevel.length === 0
        ? '<p class="ip-hint">まだありません</p>'
        : `<ul class="ip-kw-list">${topLevel.map(n => kwItemReadHTML(tree, n)).join('')}</ul>`}
    </div>
    ${common.length > 0 ? `
      <div class="ip-block">
        <label class="mini-label">あなたとの共通キーワード</label>
        <div class="ip-common">${common.map(c => `<span class="common-chip">${escapeHtml(c.mine)}${c.theirs !== c.mine ? ` ⇄ ${escapeHtml(c.theirs)}` : ''}</span>`).join('')}</div>
      </div>
    ` : ''}
    ${near.length > 0 ? `
      <div class="ip-block">
        <label class="mini-label">近くにいる樹</label>
        <ul class="ip-near-list">
          ${near.map(n => `<li data-tree-id="${n.tree.id}"><span class="dot-sm" style="background:${n.tree.id === state?.selfTreeId ? '#c49a3e' : '#6b4a2b'}"></span>${escapeHtml(n.tree.name)}${n.tree.id === state?.selfTreeId ? ' (あなた)' : ''}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;
}

// 自分と相手の共通キーワード
function findCommonKeywords(mine, other) {
  const mineTexts = (mine.nodes || []).map(n => ({ raw: n.text, norm: (n.text || '').toLowerCase().trim() }));
  const otherTexts = (other.nodes || []).map(n => ({ raw: n.text, norm: (n.text || '').toLowerCase().trim() }));
  const seen = new Set();
  const out = [];
  for (const m of mineTexts) {
    for (const o of otherTexts) {
      if (!m.norm || !o.norm) continue;
      const key = m.norm + '|' + o.norm;
      if (seen.has(key)) continue;
      let match = false;
      if (m.norm === o.norm) match = true;
      else if (m.norm.length >= 2 && o.norm.length >= 2 && (m.norm.includes(o.norm) || o.norm.includes(m.norm))) match = true;
      if (match) { seen.add(key); out.push({ mine: m.raw, theirs: o.raw }); }
    }
  }
  return out.slice(0, 6);
}

// 森の中で「この樹」に近い樹(空間距離ベース)
function findNearbyTrees(tree, allTrees, n) {
  const cx = tree._displayX ?? tree.x;
  const cy = tree._displayY ?? tree.y;
  return allTrees
    .filter(t => t.id !== tree.id)
    .map(t => {
      const dx = (t._displayX ?? t.x) - cx, dy = (t._displayY ?? t.y) - cy;
      return { tree: t, dist: Math.hypot(dx, dy), sim: keywordSim(tree, t) };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n);
}

function keywordSim(a, b) {
  const ka = new Set((a.nodes || []).map(n => (n.text || '').toLowerCase().trim()));
  const kb = new Set((b.nodes || []).map(n => (n.text || '').toLowerCase().trim()));
  if (!ka.size || !kb.size) return 0;
  let overlap = 0;
  for (const x of ka) if (kb.has(x)) overlap++;
  return overlap / Math.max(ka.size, kb.size);
}
function kwItemReadHTML(tree, node) {
  const sub = (tree.nodes || []).filter(n => n.parent_id === node.id);
  return `
    <li class="ip-kw" data-node-id="${node.id}">
      <div class="ip-kw-row">
        <span class="dot" style="background:${node.color}"></span>
        <span class="kw">${escapeHtml(node.text)}</span>
        ${node.description ? '<span class="desc-mark">…</span>' : ''}
      </div>
      ${node.description ? `<div class="ip-kw-desc">${escapeHtml(node.description)}</div>` : ''}
      ${sub.length ? `<ul class="ip-sub">${sub.map(s => `<li class="ip-sub-item" data-node-id="${s.id}"><span class="dot-sm" style="background:${s.color}"></span>${escapeHtml(s.text)}${s.description ? '<span class="desc-mark">…</span>' : ''}</li>`).join('')}</ul>` : ''}
    </li>
  `;
}
function wireOtherTree(el, state, tree, cb) {
  el.querySelector('[data-action="to-self"]')?.addEventListener('click', () => cb.onFocusSelf && cb.onFocusSelf());
  el.querySelectorAll('.ip-kw, .ip-sub-item').forEach(li => {
    li.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const nid = li.dataset.nodeId;
      const node = tree.nodes.find(n => n.id === nid);
      if (node && cb.onSelectNode) cb.onSelectNode(tree, node);
    });
  });
  // 近くの樹クリックで選択切替
  el.querySelectorAll('.ip-near-list li[data-tree-id]').forEach(li => {
    li.addEventListener('click', () => {
      const tid = li.dataset.treeId;
      const t = (state.trees || []).find(x => x.id === tid);
      if (t && cb.onSelectTree) cb.onSelectTree(t);
    });
  });
}

// ----- 自分のノード(編集) -----
function ownNodeHTML(tree, node) {
  const subs = (tree.nodes || []).filter(n => n.parent_id === node.id).sort((a,b) => (a.ord||0) - (b.ord||0));
  return `
    <div class="ip-block">
      <p class="ip-back-link"><button data-action="back" class="btn-link">← ${escapeHtml(tree.name)}の樹</button></p>
      <div class="ip-head">
        <span class="self-badge">自分のキーワード</span>
      </div>
    </div>
    <div class="ip-block">
      <label class="mini-label">キーワード</label>
      <input id="nf-text" type="text" maxlength="20" value="${escapeHtml(node.text)}">
      <label class="mini-label">サイズ</label>
      <div class="size-row" id="nf-size">
        ${[1,2,3,4,5].map(sz => `<button data-size="${sz}" class="${sz===node.size?'on':''}">${['XS','S','M','L','XL'][sz-1]}</button>`).join('')}
      </div>
      <label class="mini-label">色</label>
      <div class="color-row" id="nf-color">
        ${PALETTE.map(c => `<button data-color="${c}" style="background:${c}" class="${c===node.color?'on':''}"></button>`).join('')}
      </div>
      <label class="mini-label">説明(任意・300字)</label>
      <textarea id="nf-desc" maxlength="300" rows="4">${escapeHtml(node.description || '')}</textarea>
      <div class="ip-actions">
        <button id="nf-delete" class="btn-danger">削除</button>
        <button id="nf-save" class="btn-primary">保存</button>
      </div>
    </div>
    <div class="ip-block">
      <label class="mini-label">子のキーワード(孫ノード)</label>
      <div class="ip-row">
        <input id="nf-sub-input" type="text" maxlength="20" placeholder="例: ジャズ">
        <button id="nf-sub-btn" class="btn-sm btn-ink">＋</button>
      </div>
      ${subs.length ? `<ul class="ip-sub-list">${subs.map(s => `<li data-node-id="${s.id}"><span class="dot-sm" style="background:${s.color}"></span>${escapeHtml(s.text)}</li>`).join('')}</ul>` : ''}
    </div>
  `;
}
function wireOwnNode(el, state, tree, node, cb) {
  el.querySelector('[data-action="back"]')?.addEventListener('click', () => cb.onSelectTree && cb.onSelectTree(tree));
  // size buttons
  el.querySelectorAll('#nf-size button').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('#nf-size button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));
  el.querySelectorAll('#nf-color button').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('#nf-color button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  }));

  el.querySelector('#nf-save').addEventListener('click', async () => {
    const newText = el.querySelector('#nf-text').value.trim();
    if (!newText) return;
    const newSize = Number(el.querySelector('#nf-size .on')?.dataset.size || node.size);
    const newColor = el.querySelector('#nf-color .on')?.dataset.color || node.color;
    const newDesc = el.querySelector('#nf-desc').value.trim() || null;
    try {
      const saved = await api.upsertNode((state.adminToken || state.session?.editToken), tree.id, {
        id: node.id, text: newText, size: newSize, color: newColor,
        ord: node.ord, description: newDesc
      });
      Object.assign(node, saved);
      cb.onRerender && cb.onRerender();
    } catch (e) { import('./toast.js').then(m => m.showError(e, '保存失敗')); }
  });

  el.querySelector('#nf-delete').addEventListener('click', async () => {
    if (!confirm('このキーワード(と孫)を削除しますか?')) return;
    try {
      await api.deleteNode((state.adminToken || state.session?.editToken), node.id);
      // 自分自身とsubを配列からも除去
      const victims = new Set([node.id]);
      (tree.nodes || []).forEach(n => { if (victims.has(n.parent_id)) victims.add(n.id); });
      tree.nodes = tree.nodes.filter(n => !victims.has(n.id));
      cb.onSelectTree && cb.onSelectTree(tree); // 親に戻る
    } catch (e) { import('./toast.js').then(m => m.showError(e, '削除失敗')); }
  });

  // 子ノード(孫)追加
  async function addSub() {
    const input = el.querySelector('#nf-sub-input');
    const txt = input.value.trim();
    if (!txt) return;
    try {
      const saved = await api.upsertNode((state.adminToken || state.session?.editToken), tree.id, {
        text: txt, size: 2, color: node.color, ord: (tree.nodes || []).filter(n => n.parent_id === node.id).length,
        parent_id: node.id
      });
      tree.nodes.push(saved);
      input.value = '';
      cb.onRerender && cb.onRerender();
    } catch (e) { import('./toast.js').then(m => m.showError(e, '保存失敗')); }
  }
  el.querySelector('#nf-sub-btn')?.addEventListener('click', addSub);
  el.querySelector('#nf-sub-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSub(); });

  el.querySelectorAll('.ip-sub-list li').forEach(li => {
    li.addEventListener('click', () => {
      const nid = li.dataset.nodeId;
      const n = tree.nodes.find(x => x.id === nid);
      if (n && cb.onSelectNode) cb.onSelectNode(tree, n);
    });
  });
}

// ----- 他人のノード(閲覧) -----
function otherNodeHTML(tree, node) {
  const subs = (tree.nodes || []).filter(n => n.parent_id === node.id);
  return `
    <div class="ip-block">
      <p class="ip-back-link"><button data-action="back" class="btn-link">← ${escapeHtml(tree.name)}さんの樹</button></p>
      <div class="ip-head">
        <p class="ip-hint">${escapeHtml(tree.name)} さんのキーワード</p>
        <div class="ip-kw-head">
          <span class="dot-lg" style="background:${node.color}"></span>
          <h2 class="ip-title">${escapeHtml(node.text)}</h2>
        </div>
      </div>
    </div>
    ${node.description ? `<div class="ip-block"><div class="ip-desc-box">${escapeHtml(node.description)}</div></div>` : '<div class="ip-block"><p class="ip-hint">(説明なし)</p></div>'}
    ${subs.length ? `
      <div class="ip-block">
        <label class="mini-label">関連するキーワード</label>
        <ul class="ip-sub-list">${subs.map(s => `<li data-node-id="${s.id}"><span class="dot-sm" style="background:${s.color}"></span>${escapeHtml(s.text)}${s.description ? '<span class="desc-mark">…</span>' : ''}</li>`).join('')}</ul>
      </div>` : ''}
  `;
}
function wireOtherNode(el, state, tree, node, cb) {
  el.querySelector('[data-action="back"]')?.addEventListener('click', () => cb.onSelectTree && cb.onSelectTree(tree));
  el.querySelectorAll('.ip-sub-list li').forEach(li => {
    li.addEventListener('click', () => {
      const nid = li.dataset.nodeId;
      const n = tree.nodes.find(x => x.id === nid);
      if (n && cb.onSelectNode) cb.onSelectNode(tree, n);
    });
  });
}
