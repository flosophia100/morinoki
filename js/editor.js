import { api } from './supabase.js';
import { saveSession } from './auth.js';
import { escapeHtml } from './utils.js';

const PALETTE = ['#5a6b3e','#8b6a4a','#c49a3e','#d4694a','#6b4a2b','#3a4828','#b8c18c','#e8a298','#7d8f5a','#a87e55'];

export function openPlantModal(state, onPlanted) {
  const m = document.getElementById('plant-modal');
  const err = document.getElementById('plant-error');
  const name = document.getElementById('plant-name');
  const p1 = document.getElementById('plant-pass');
  const p2 = document.getElementById('plant-pass2');
  const email = document.getElementById('plant-email');
  err.classList.add('hidden');
  name.value = ''; p1.value = ''; p2.value = ''; email.value = '';
  m.classList.remove('hidden');
  name.focus();

  document.getElementById('plant-cancel').onclick = () => m.classList.add('hidden');
  document.getElementById('plant-submit').onclick = async () => {
    err.classList.add('hidden');
    const nm = name.value.trim();
    if (!nm) return showErr('名前を入力してください');
    if (p1.value.length < 4) return showErr('合言葉は4桁以上');
    if (p1.value !== p2.value) return showErr('合言葉が一致しません');
    try {
      const res = await api.createTree(state.room.slug, nm, p1.value, email.value.trim() || null);
      const row = Array.isArray(res) ? res[0] : res;
      const treeId = row.tree_id;
      const recovery = row.recovery_key;
      const token = await api.authTree(treeId, p1.value);
      saveSession(state.room.slug, { treeId, editToken: token, treeName: nm });
      m.classList.add('hidden');
      showRecoveryModal(recovery, () => onPlanted({ treeId, editToken: token, treeName: nm }));
    } catch (e) { showErr(e.message || String(e)); }
  };
  function showErr(msg){ err.textContent = msg; err.classList.remove('hidden'); }
}

function showRecoveryModal(key, onClose) {
  const m = document.getElementById('recovery-modal');
  document.getElementById('recovery-key').textContent = key;
  m.classList.remove('hidden');
  document.getElementById('recovery-copy').onclick = async () => {
    await navigator.clipboard.writeText(key);
    document.getElementById('recovery-copy').textContent = 'コピーしました';
  };
  document.getElementById('recovery-ok').onclick = () => { m.classList.add('hidden'); onClose && onClose(); };
}

// 自分の樹: 幹タップ → ノード一覧パネル
export function openNodePanel(state, tree, onChange) {
  const panel = document.getElementById('node-panel');
  document.getElementById('node-panel-name').textContent = tree.name;
  renderList();
  panel.classList.remove('hidden');

  document.getElementById('node-panel-close').onclick = () => panel.classList.add('hidden');
  document.getElementById('node-add-btn').onclick = addOne;
  const input = document.getElementById('node-input');
  input.value = ''; input.focus();
  input.onkeydown = (e) => { if (e.key === 'Enter') addOne(); };

  async function addOne() {
    const txt = input.value.trim();
    if (!txt) return;
    try {
      const saved = await api.upsertNode(state.session.editToken, tree.id, {
        text: txt, size: 3, color: PALETTE[0], ord: (tree.nodes||[]).length
      });
      tree.nodes = tree.nodes || [];
      tree.nodes.push(saved);
      input.value = '';
      renderList();
      onChange && onChange();
    } catch (e) {
      alert('保存に失敗しました: ' + e.message);
    }
  }

  function renderList() {
    const ul = document.getElementById('node-list');
    ul.innerHTML = (tree.nodes || []).map((n, i) =>
      `<li data-idx="${i}"><span class="dot" style="background:${n.color}"></span>${escapeHtml(n.text)}${n.description ? '<span class="desc-mark">…</span>' : ''}</li>`
    ).join('');
    ul.querySelectorAll('li').forEach(li => {
      li.onclick = () => openNodeEdit(state, tree, Number(li.dataset.idx), renderList, onChange);
    });
  }
}

// 自分のノードの編集ポップオーバー
export function openNodeEdit(state, tree, idx, rerender, onChange) {
  const n = tree.nodes[idx];
  const box = document.getElementById('node-edit');
  const txt = document.getElementById('node-edit-text');
  const desc = document.getElementById('node-edit-desc');
  txt.value = n.text;
  desc.value = n.description || '';

  box.querySelectorAll('.size-row button').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.size) === n.size);
    b.onclick = () => {
      box.querySelectorAll('.size-row button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
  });

  const cr = document.getElementById('color-row');
  cr.innerHTML = PALETTE.map(c => `<button data-color="${c}" style="background:${c}"></button>`).join('');
  cr.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.color === n.color);
    b.onclick = () => {
      cr.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
  });

  box.style.left = '50%'; box.style.top = '50%'; box.style.transform = 'translate(-50%,-50%)';
  box.classList.remove('hidden');

  document.getElementById('node-edit-save').onclick = async () => {
    const newSize = Number(box.querySelector('.size-row button.on')?.dataset.size || n.size);
    const newColor = cr.querySelector('button.on')?.dataset.color || n.color;
    const newText = txt.value.trim();
    const newDesc = desc.value.trim();
    if (!newText) return;
    try {
      const saved = await api.upsertNode(state.session.editToken, tree.id, {
        id: n.id, text: newText, size: newSize, color: newColor, ord: n.ord,
        description: newDesc || null
      });
      tree.nodes[idx] = saved;
      box.classList.add('hidden');
      rerender && rerender();
      onChange && onChange();
    } catch (e) {
      alert('保存に失敗しました: ' + e.message);
    }
  };
  document.getElementById('node-edit-delete').onclick = async () => {
    if (!confirm('このキーワードを削除しますか?')) return;
    try {
      await api.deleteNode(state.session.editToken, n.id);
      tree.nodes.splice(idx, 1);
      box.classList.add('hidden');
      rerender && rerender();
      onChange && onChange();
    } catch (e) {
      alert('削除に失敗しました: ' + e.message);
    }
  };
  document.getElementById('node-edit-cancel').onclick = () => box.classList.add('hidden');
}

// 読み取り専用ノード詳細(他人の樹のノードをタップしたとき)
export function openNodeDetail(tree, node) {
  const box = document.getElementById('node-detail');
  document.getElementById('node-detail-title').textContent = node.text;
  document.getElementById('node-detail-owner').textContent = `${tree.name} さんのキーワード`;
  const descEl = document.getElementById('node-detail-desc');
  if (node.description) {
    descEl.textContent = node.description;
    descEl.style.display = '';
  } else {
    descEl.textContent = '';
    descEl.style.display = 'none';
  }
  // サイズと色のプレビュー
  document.getElementById('node-detail-dot').style.background = node.color;
  box.classList.remove('hidden');
  document.getElementById('node-detail-close').onclick = () => box.classList.add('hidden');
}

// 他人の樹タップ(幹)→ ノード一覧(読み取り専用)
export function openTreeDetail(tree) {
  const box = document.getElementById('tree-detail');
  document.getElementById('tree-detail-name').textContent = tree.name;
  const d = new Date(tree.createdAt || tree.created_at);
  const dateStr = isNaN(d) ? '' : ` · ${d.getMonth()+1}月${d.getDate()}日植樹`;
  document.getElementById('tree-detail-meta').textContent = `${(tree.nodes||[]).length}個のキーワード${dateStr}`;
  const ul = document.getElementById('tree-detail-list');
  ul.innerHTML = (tree.nodes || []).map(n =>
    `<li><span class="dot" style="background:${n.color}"></span>
      <span class="kw">${escapeHtml(n.text)}</span>
      ${n.description ? `<div class="desc">${escapeHtml(n.description)}</div>` : ''}
    </li>`
  ).join('');
  box.classList.remove('hidden');
  document.getElementById('tree-detail-close').onclick = () => box.classList.add('hidden');
}
