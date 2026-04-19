// Toast通知: info / success / error
// 重ねて表示、3秒後に自動消去(errorは5秒)
let container = null;
function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type = 'info', opts = {}) {
  const { duration } = opts;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  ensureContainer().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const d = duration ?? (type === 'error' ? 5000 : type === 'success' ? 2500 : 3000);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, d);
  return el;
}

// エラー共通フォーマット(RPC失敗など)
export function showError(err, fallback = '操作に失敗しました') {
  const msg = err?.message || (typeof err === 'string' ? err : fallback);
  return showToast(msg, 'error');
}

// 接続状態バナー(画面上部、永続)
let statusEl = null;
export function setConnectionStatus(status) {
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'connection-status';
    statusEl.className = 'connection-status';
    document.body.appendChild(statusEl);
  }
  // status: 'online' | 'offline' | 'reconnecting' | 'realtime-down'
  const map = {
    online: { text: '', show: false, cls: 'online' },
    offline: { text: 'オフラインです', show: true, cls: 'offline' },
    reconnecting: { text: '再接続中…', show: true, cls: 'reconnecting' },
    'realtime-down': { text: 'リアルタイム同期が止まっています', show: true, cls: 'warning' },
  };
  const cfg = map[status] || map.online;
  statusEl.textContent = cfg.text;
  statusEl.className = 'connection-status ' + cfg.cls;
  statusEl.style.display = cfg.show ? 'block' : 'none';
}
