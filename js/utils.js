export function stringHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function isValidSlug(s) {
  return /^[a-z0-9-]{3,40}$/.test(s);
}

export function randomSlug() {
  const adj = ['midori','kigi','koke','yama','tani','sora','tsuchi','hikari'];
  const noun = ['mori','yabu','ne','hara','oka'];
  const pick = a => a[Math.floor(Math.random()*a.length)];
  return pick(adj) + '-' + pick(noun) + '-' + Math.floor(Math.random()*9000+1000);
}
