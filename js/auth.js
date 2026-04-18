const KEY_PREFIX = 'mori.session.';

export function saveSession(roomSlug, session) {
  localStorage.setItem(KEY_PREFIX + roomSlug, JSON.stringify(session));
}

export function loadSession(roomSlug) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + roomSlug);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.editToken || !s.treeId) return null;
    return s;
  } catch { return null; }
}

export function clearSession(roomSlug) {
  localStorage.removeItem(KEY_PREFIX + roomSlug);
}

export function isTokenExpired(token) {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    return (json.exp || 0) * 1000 < Date.now();
  } catch { return true; }
}
