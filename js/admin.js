// 管理者ダッシュボード: /admin5002 用
// グローバル管理者トークンで森の作成・削除・一覧、管理者資格の変更
import { api } from './supabase.js';
import { showToast, showError } from './toast.js';
import { escapeHtml } from './utils.js';

const TOKEN_KEY = 'mori.admin.global.token';

export async function initAdmin() {
  const loginBox = document.getElementById('admin-login-box');
  const dashboard = document.getElementById('admin-dashboard');

  async function enterDashboard(token) {
    loginBox.classList.add('hidden');
    dashboard.classList.remove('hidden');
    await refreshRooms(token);
  }

  // 既存トークンで自動ログイン(失効していればログイン画面に戻す)
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) {
    try {
      await api.listRooms(saved);
      await enterDashboard(saved);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  // ログインボタン
  const loginBtn = document.getElementById('admin-login-btn');
  const loginErr = document.getElementById('admin-login-error');
  async function doLogin() {
    loginErr.classList.add('hidden');
    const id = document.getElementById('admin-login-id').value.trim();
    const pw = document.getElementById('admin-login-pw').value;
    if (!id || pw.length < 4) {
      loginErr.textContent = 'IDと4桁以上の合言葉を入力してください';
      loginErr.classList.remove('hidden');
      return;
    }
    try {
      const token = await api.adminLogin(id, pw);
      localStorage.setItem(TOKEN_KEY, token);
      await enterDashboard(token);
      showToast('ログインしました', 'success');
    } catch (e) {
      loginErr.textContent = 'ログインできませんでした';
      loginErr.classList.remove('hidden');
    }
  }
  loginBtn.addEventListener('click', doLogin);
  document.getElementById('admin-login-id').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('admin-login-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  // ログアウト
  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  });

  // 森作成
  const createForm = document.getElementById('create-room-form');
  const createErr = document.getElementById('create-room-error');
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    createErr.classList.add('hidden');
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const name = document.getElementById('new-room-name').value.trim();
    const slug = document.getElementById('new-room-slug').value.trim().toLowerCase();
    try {
      await api.createRoom(token, slug, name);
      showToast(`森「${name || slug}」を作成しました`, 'success');
      document.getElementById('new-room-name').value = '';
      document.getElementById('new-room-slug').value = '';
      await refreshRooms(token);
    } catch (e) {
      createErr.textContent = e.message || '作成に失敗しました';
      createErr.classList.remove('hidden');
    }
  });

  // 管理者資格の変更
  document.getElementById('update-creds-btn').addEventListener('click', async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const msg = document.getElementById('update-creds-msg');
    const newId = document.getElementById('new-admin-id').value.trim();
    const newPw = document.getElementById('new-admin-pw').value;
    if (newId.length < 3 || newPw.length < 4) {
      msg.textContent = 'IDは3文字以上、合言葉は4桁以上にしてください';
      return;
    }
    if (!confirm('管理者のIDと合言葉を変更します。よろしいですか?')) return;
    try {
      await api.setAdminCredentials(token, newId, newPw);
      msg.textContent = '更新しました。次回ログインから新しい資格が必要です。';
      document.getElementById('new-admin-id').value = '';
      document.getElementById('new-admin-pw').value = '';
      showToast('管理者情報を更新しました', 'success');
    } catch (e) {
      msg.textContent = '更新失敗: ' + (e.message || '');
    }
  });
}

async function refreshRooms(token) {
  const rooms = await api.listRooms(token);
  renderRoomList(rooms, token);
}

function renderRoomList(rooms, token) {
  const ul = document.getElementById('room-list');
  const empty = document.getElementById('room-list-empty');
  if (!rooms.length) {
    ul.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  ul.innerHTML = rooms.map(r => `
    <li class="room-item" data-slug="${escapeHtml(r.slug)}">
      <div class="room-info">
        <div class="room-name">${escapeHtml(r.name || r.slug)}</div>
        <div class="room-meta">/${escapeHtml(r.slug)} ・ ${r.tree_count}樹 ・ ${r.node_count}ノード</div>
      </div>
      <div class="room-actions">
        <a class="btn-secondary btn-sm" href="/r/${encodeURIComponent(r.slug)}" target="_blank">開く</a>
        <button class="btn-danger btn-sm delete-room-btn" data-slug="${escapeHtml(r.slug)}" data-name="${escapeHtml(r.name || r.slug)}">削除</button>
      </div>
    </li>
  `).join('');

  ul.querySelectorAll('.delete-room-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.slug;
      const name = btn.dataset.name;
      if (!confirm(`森「${name}」を削除します。中のすべての樹・枝も消えます。取り消しできません。よろしいですか?`)) return;
      try {
        await api.deleteRoom(token, slug);
        showToast('削除しました', 'success');
        await refreshRooms(token);
      } catch (e) {
        showError(e, '削除失敗');
      }
    });
  });
}
