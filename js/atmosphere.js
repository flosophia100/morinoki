// 時間帯に応じた背景色/ヘッダ色を返す
// keyframes: ローカル時刻(0-24) に対して色を定義、線形補間
// ---- 背景パレット: それぞれ独自の時間帯キーフレームを持つ ----
// 全て同じ時刻を使うので h (時刻) の列は共通
const H_STOPS = [0, 4, 6, 8, 11, 14, 16, 18, 20, 22, 24];
const TONES   = ['night','predawn','dawn','morning','noon','noon','afternoon','sunset','dusk','night','night'];
// ambient(全体に被せる淡い色膜)はパレットと同じで共有
const AMBIENT = [
  'rgba(200,210,230,0.05)','rgba(200,210,230,0.08)','rgba(210,220,230,0.14)',
  'rgba(220,228,232,0.10)','rgba(230,235,230,0.04)','rgba(230,235,230,0.04)',
  'rgba(220,190,160,0.08)','rgba(200,150,130,0.14)','rgba(170,170,200,0.12)',
  'rgba(200,210,230,0.06)','rgba(200,210,230,0.05)'
];

const PALETTES = {
  // Nordic: 冷たい白+フィヨルドブルー+淡いアンバー
  nordic: [
    ['#16233a','#0c1424'], ['#28334f','#151c30'], ['#c8d4de','#a5b4c2'],
    ['#e4ebec','#c9d4d7'], ['#ecefe9','#d5dbd7'], ['#ecefe9','#d5dbd7'],
    ['#e6d5c6','#c9a99d'], ['#c0857a','#5f546b'], ['#45415e','#1d1e34'],
    ['#1f2842','#10172a'], ['#16233a','#0c1424'],
  ],
  // 桜: 淡いピンク+桃色夕焼け
  sakura: [
    ['#2a1f3a','#160f22'], ['#3a2840','#1f1528'], ['#f5c6d4','#d8a0b2'],
    ['#fce6ec','#f0c8d4'], ['#fff0ec','#f5d8d8'], ['#fff0ec','#f5d8d8'],
    ['#f8c8b8','#d89080'], ['#e88ba0','#6a3f5a'], ['#5a3a5f','#2a1f3a'],
    ['#281c3a','#140e22'], ['#2a1f3a','#160f22'],
  ],
  // 夕焼け: 暖色・鮮やかサンセット
  sunset: [
    ['#1e1a30','#0f0b1a'], ['#2e2640','#180f28'], ['#ffd4a0','#e89c68'],
    ['#ffe8c4','#f2c888'], ['#fff4d0','#f5d898'], ['#fff4d0','#f5d898'],
    ['#ffb880','#e27848'], ['#e65c48','#582838'], ['#3a2540','#1a1025'],
    ['#1e1a30','#0f0b1a'], ['#1e1a30','#0f0b1a'],
  ],
  // パステル: 穏やかな淡色
  pastel: [
    ['#282538','#14121f'], ['#383650','#1e1c2e'], ['#d4c4e8','#b0a0d0'],
    ['#e8e0f2','#d0c8e0'], ['#f0f5e8','#d8e0c8'], ['#f0f5e8','#d8e0c8'],
    ['#f4dcc8','#d8b8a0'], ['#dc9aa5','#786a8a'], ['#4a4260','#2a2238'],
    ['#282538','#14121f'], ['#282538','#14121f'],
  ],
  // 墨: モノトーン
  mono: [
    ['#1a1a1a','#0a0a0a'], ['#2a2a2a','#151515'], ['#b0b0b0','#909090'],
    ['#d0d0d0','#b0b0b0'], ['#e0e0e0','#c0c0c0'], ['#e0e0e0','#c0c0c0'],
    ['#c0c0c0','#909090'], ['#888888','#454545'], ['#3a3a3a','#1a1a1a'],
    ['#1a1a1a','#0a0a0a'], ['#1a1a1a','#0a0a0a'],
  ],
  // オーロラ: 緑青の冷たい北の光
  aurora: [
    ['#0a1a2e','#050a18'], ['#123050','#081828'], ['#a0d0c0','#5a8080'],
    ['#c4e0d8','#90b8b0'], ['#d8e8e0','#b0c8c0'], ['#d8e8e0','#b0c8c0'],
    ['#a0b8c0','#688090'], ['#7066a0','#3a3060'], ['#2a2850','#10142a'],
    ['#0a1a2e','#050a18'], ['#0a1a2e','#050a18'],
  ],
};

function keyframesFor(paletteName) {
  const p = PALETTES[paletteName] || PALETTES.nordic;
  return H_STOPS.map((h, i) => ({
    h, top: p[i][0], bot: p[i][1], tone: TONES[i], ambient: AMBIENT[i]
  }));
}

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

export function atmosphereAt(date = new Date(), ambience = null) {
  const paletteName = ambience?.palette || 'nordic';
  const frames = keyframesFor(paletteName);
  const timeCurve = ambience?.timeCurve || 'auto';
  let prev, next, t;
  if (timeCurve && timeCurve !== 'auto') {
    prev = frames.find(k => k.tone === timeCurve) || frames[4];
    next = prev;
    t = 0;
  } else {
    const h = date.getHours() + date.getMinutes() / 60;
    prev = frames[0]; next = frames[0];
    for (let i = 0; i < frames.length - 1; i++) {
      if (h >= frames[i].h && h < frames[i+1].h) {
        prev = frames[i]; next = frames[i+1];
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
