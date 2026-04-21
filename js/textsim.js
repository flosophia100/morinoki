// 文言の類似度(ノード text / 樹 name 共通)
// - normalize: NFKC + lowercase + trim + 記号類除去
// - bigrams: 2文字N-gram集合(1文字文言は unigram で代用)
// - jaccardSim: |A∩B| / |A∪B| (0〜1)
//
// 用途:
//   liveforest.js treeSim — 樹の類似度で引力を決める
//   nodesim.js textAffinity — 似たノード同士を弱く引き合わせる
//
// 日本語のカタカナ/ひらがな違いは同一視しない(意味が変わるため)。
// 半角/全角・大文字/小文字のみ NFKC で正規化する。

const PUNCT_RE = /[\s\p{P}\p{S}]+/gu;

export function normalize(s) {
  if (!s) return '';
  let t;
  try { t = s.normalize('NFKC'); } catch { t = s; }
  return t.toLowerCase().replace(PUNCT_RE, '').trim();
}

export function bigrams(s) {
  const n = normalize(s);
  const out = new Set();
  if (n.length === 0) return out;
  if (n.length === 1) { out.add(n); return out; }
  for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
  return out;
}

export function jaccardSim(aSet, bSet) {
  if (!aSet || !bSet || aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  const [small, big] = aSet.size <= bSet.size ? [aSet, bSet] : [bSet, aSet];
  small.forEach(x => { if (big.has(x)) inter++; });
  const uni = aSet.size + bSet.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

export function textSim(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  return jaccardSim(bigrams(na), bigrams(nb));
}

// ノードに bigram 集合をキャッシュ(sim ループを O(N×k) に)
export function ensureBigrams(obj, field = 'text') {
  const src = obj?.[field];
  if (!src) { obj._bigrams = new Set(); obj._bigramSrc = ''; return obj._bigrams; }
  if (obj._bigrams && obj._bigramSrc === src) return obj._bigrams;
  obj._bigrams = bigrams(src);
  obj._bigramSrc = src;
  return obj._bigrams;
}
