// 時間帯に応じた背景色/ヘッダ色を返す
// keyframes: ローカル時刻(0-24) に対して色を定義、線形補間
const KEYFRAMES = [
  { h: 0,  top: '#1b2441', bot: '#0f1629', tone: 'night',   ambient: 'rgba(180,190,220,0.06)' },
  { h: 4,  top: '#2c3655', bot: '#171d36', tone: 'predawn', ambient: 'rgba(196,200,220,0.10)' },
  { h: 6,  top: '#e8d6c4', bot: '#d5b8a0', tone: 'dawn',    ambient: 'rgba(255,220,180,0.15)' },
  { h: 8,  top: '#f3e9d3', bot: '#e4d7b4', tone: 'morning', ambient: 'rgba(255,245,210,0.12)' },
  { h: 11, top: '#f2ead4', bot: '#e2d4b5', tone: 'noon',    ambient: 'rgba(255,250,230,0.05)' },
  { h: 14, top: '#f2ead4', bot: '#e2d4b5', tone: 'noon',    ambient: 'rgba(255,250,230,0.05)' },
  { h: 16, top: '#f2d9b0', bot: '#dfa882', tone: 'afternoon', ambient: 'rgba(255,210,150,0.10)' },
  { h: 18, top: '#d88b6a', bot: '#7e4c5e', tone: 'sunset',  ambient: 'rgba(255,160,120,0.18)' },
  { h: 20, top: '#554172', bot: '#241a3a', tone: 'dusk',    ambient: 'rgba(160,140,200,0.15)' },
  { h: 22, top: '#232a4c', bot: '#11192e', tone: 'night',   ambient: 'rgba(180,190,220,0.08)' },
  { h: 24, top: '#1b2441', bot: '#0f1629', tone: 'night',   ambient: 'rgba(180,190,220,0.06)' }
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
const SEASON_ACCENT = {
  spring:  { leaf: '#8dab5e', bloom: '#f4c5cd', mist: 'rgba(240,210,220,0.10)', name: '春' },
  summer:  { leaf: '#3d5826', bloom: '#b8d98a', mist: 'rgba(170,200,130,0.06)', name: '夏' },
  autumn:  { leaf: '#a87034', bloom: '#d66f2c', mist: 'rgba(220,150,80,0.12)',  name: '秋' },
  winter:  { leaf: '#6a7a5a', bloom: '#e6eaf0', mist: 'rgba(230,235,245,0.16)', name: '冬' },
};

export function atmosphereAt(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  let prev = KEYFRAMES[0], next = KEYFRAMES[0];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (h >= KEYFRAMES[i].h && h < KEYFRAMES[i+1].h) {
      prev = KEYFRAMES[i]; next = KEYFRAMES[i+1];
      break;
    }
  }
  const span = next.h - prev.h;
  const t = span > 0 ? (h - prev.h) / span : 0;
  const season = seasonOf(date);
  const accent = SEASON_ACCENT[season];
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
