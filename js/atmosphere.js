// 時間帯に応じた背景色/ヘッダ色を返す
// keyframes: ローカル時刻(0-24) に対して色を定義、線形補間
// Nordic色調: 冷たい白+フィヨルドブルー+淡いアンバー。サンセットも控えめ。
const KEYFRAMES = [
  { h: 0,  top: '#16233a', bot: '#0c1424', tone: 'night',     ambient: 'rgba(200,210,230,0.05)' },
  { h: 4,  top: '#28334f', bot: '#151c30', tone: 'predawn',   ambient: 'rgba(200,210,230,0.08)' },
  { h: 6,  top: '#c8d4de', bot: '#a5b4c2', tone: 'dawn',      ambient: 'rgba(210,220,230,0.14)' },
  { h: 8,  top: '#e4ebec', bot: '#c9d4d7', tone: 'morning',   ambient: 'rgba(220,228,232,0.10)' },
  { h: 11, top: '#ecefe9', bot: '#d5dbd7', tone: 'noon',      ambient: 'rgba(230,235,230,0.04)' },
  { h: 14, top: '#ecefe9', bot: '#d5dbd7', tone: 'noon',      ambient: 'rgba(230,235,230,0.04)' },
  { h: 16, top: '#e6d5c6', bot: '#c9a99d', tone: 'afternoon', ambient: 'rgba(220,190,160,0.08)' },
  { h: 18, top: '#c0857a', bot: '#5f546b', tone: 'sunset',    ambient: 'rgba(200,150,130,0.14)' },
  { h: 20, top: '#45415e', bot: '#1d1e34', tone: 'dusk',      ambient: 'rgba(170,170,200,0.12)' },
  { h: 22, top: '#1f2842', bot: '#10172a', tone: 'night',     ambient: 'rgba(200,210,230,0.06)' },
  { h: 24, top: '#16233a', bot: '#0c1424', tone: 'night',     ambient: 'rgba(200,210,230,0.05)' }
];

function hexToRgb(h) {
  const m = h.replace('#','');
  return [parseInt(m.slice(0,2),16), parseInt(m.slice(2,4),16), parseInt(m.slice(4,6),16)];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = Math.round(lerp(A[0],B[0],t));
  const g = Math.round(lerp(A[1],B[1],t));
  const bl = Math.round(lerp(A[2],B[2],t));
  return `rgb(${r},${g},${bl})`;
}

// 季節プロファイル — atmosphere結果に色味/アンビエントを重ねる
// 月(0..11)から季節を推定
function seasonOf(date) {
  const m = date.getMonth(); // 0=Jan
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

// 季節別のアクセント色(描画側で使用)とアンビエント補正
// Nordic季節アクセント
const SEASON_ACCENT = {
  spring:  { leaf: '#a8c18a', bloom: '#ebd2d0', mist: 'rgba(230,210,210,0.08)', name: '春' },
  summer:  { leaf: '#5d7f6a', bloom: '#aec7b5', mist: 'rgba(170,200,180,0.05)', name: '夏' },
  autumn:  { leaf: '#b07a4c', bloom: '#c88a55', mist: 'rgba(205,165,120,0.10)', name: '秋' },
  winter:  { leaf: '#8ea0a8', bloom: '#eaf0f4', mist: 'rgba(220,230,240,0.16)', name: '冬' },
};

// tone固定(管理者指定)用: 一致する最初のフレームを返す
function frameByTone(tone) {
  return KEYFRAMES.find(k => k.tone === tone) || KEYFRAMES[4]; // noon fallback
}

export function atmosphereAt(date = new Date(), ambience = null) {
  const timeCurve = ambience?.timeCurve || 'auto';
  let prev, next, t;
  if (timeCurve && timeCurve !== 'auto') {
    prev = frameByTone(timeCurve);
    next = prev;
    t = 0;
  } else {
    const h = date.getHours() + date.getMinutes() / 60;
    prev = KEYFRAMES[0]; next = KEYFRAMES[0];
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (h >= KEYFRAMES[i].h && h < KEYFRAMES[i+1].h) {
        prev = KEYFRAMES[i]; next = KEYFRAMES[i+1];
        break;
      }
    }
    const span = next.h - prev.h;
    t = span > 0 ? (h - prev.h) / span : 0;
  }

  const seasonFix = ambience?.season || 'auto';
  const season = (seasonFix && seasonFix !== 'auto') ? seasonFix : seasonOf(date);
  const accent = SEASON_ACCENT[season] || SEASON_ACCENT.spring;
  const h = date.getHours() + date.getMinutes() / 60;
  return {
    top: lerpHex(prev.top, next.top, t),
    bot: lerpHex(prev.bot, next.bot, t),
    ambient: prev.ambient,
    tone: prev.tone,
    hour: h,
    season,
    seasonName: accent.name,
    seasonMist: accent.mist,
    seasonLeaf: accent.leaf,
    seasonBloom: accent.bloom
  };
}
