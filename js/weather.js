// 岐阜県美濃市の現在天気を Open-Meteo から取得し、キャンバスに演出を重ねる。
//   - fetchWeather(): 現在天気を取得
//   - drawWeather(ctx, W, H, weather, t, ambience): 天気に応じたオーバーレイ
//
// 管理者は ambience.weatherOverride で 'auto' 以外を指定すると
// 手動でエフェクトを固定できる。

const MINO_LAT = 35.54;
const MINO_LON = 136.92;
const ENDPOINT =
  `https://api.open-meteo.com/v1/forecast?latitude=${MINO_LAT}&longitude=${MINO_LON}&current_weather=true`;

export function categorize(code) {
  if (code === 0) return 'sunny';
  if (code === 1 || code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'cloudy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'rainy';
  if (code >= 95 && code <= 99) return 'rainy';
  return 'sunny';
}

export function weatherLabel(category) {
  return category === 'sunny' ? '☀ 晴れ'
       : category === 'cloudy' ? '☁ 曇り'
       : category === 'rainy'  ? '🌧 雨'
       : '—';
}

// ------ 取得 ------
export async function fetchWeather() {
  try {
    const res = await fetch(ENDPOINT, { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    const cw = data.current_weather;
    if (!cw) return null;
    return {
      code: cw.weathercode,
      category: categorize(cw.weathercode),
      tempC: cw.temperature,
      windKmh: cw.windspeed,
      at: Date.now(),
    };
  } catch {
    return null;
  }
}

function resolveCategory(weather, ambience) {
  const ov = ambience?.weatherOverride;
  if (ov && ov !== 'auto' && ['sunny','cloudy','rainy'].includes(ov)) return ov;
  return weather?.category || null;
}

function clamp01(v, fallback = 0.5) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

// 決定論的な [0,1) のハッシュ。i は整数、salt は定数ごとに異なる整数を渡す。
function hash01(i, salt) {
  // Math.imul で 32bit 整数乗算
  let h = Math.imul(i | 0, 73856093) ^ Math.imul((salt | 0) + 1, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// ------ 描画 ------
export function drawWeather(ctx, W, H, weather, t, ambience = null) {
  const category = resolveCategory(weather, ambience);
  if (!category) return;
  if (category === 'cloudy') drawClouds(ctx, W, H, t, ambience);
  else if (category === 'rainy') {
    drawClouds(ctx, W, H, t, ambience); // 雨雲下地
    drawRain(ctx, W, H, t, ambience);
  }
  // sunny は特に重ね無し
}

// ---- 雲: ふわっとした「固まり」を複数、各自ランダム方向に2Dで漂流 ----
//   ambience.mistIntensity (0-1) で雲の数・濃さを制御
//   各雲は 4-6 の重なった半透明円(mochiパターン)
function drawClouds(ctx, W, H, t, ambience) {
  const intensity = clamp01(ambience?.mistIntensity, 0.5);
  if (intensity <= 0.01) return;

  ctx.save();
  // 全体のトーン落とし(控えめ)
  ctx.fillStyle = `rgba(85, 95, 105, ${0.03 + intensity * 0.07})`;
  ctx.fillRect(0, 0, W, H);

  const NUM = Math.floor(6 + intensity * 10);    // 6〜16個の雲
  const baseAlpha = 0.14 + intensity * 0.24;     // 0.14〜0.38
  const tSec = t / 1000;
  const MARGIN = 220;
  const FIELD_W = W + MARGIN * 2;
  const FIELD_H = H + MARGIN * 2;

  for (let i = 0; i < NUM; i++) {
    const s1 = hash01(i, 11); // 初期 X
    const s2 = hash01(i, 22); // 初期 Y
    const s3 = hash01(i, 33); // 速度
    const s4 = hash01(i, 44); // 方向
    const s5 = hash01(i, 55); // サイズ
    const s6 = hash01(i, 66); // alpha jitter

    // 速度 4〜18 px/sec、方向 0〜2π(全方向)
    const speed = 4 + s3 * 14;
    const angle = s4 * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed * 0.6; // 縦はやや遅め(自然に)

    // トロイダル wrap で画面端から反対側に再登場
    const rawX = s1 * FIELD_W + tSec * vx;
    const rawY = s2 * FIELD_H + tSec * vy;
    const cx = ((rawX % FIELD_W) + FIELD_W) % FIELD_W - MARGIN;
    const cy = ((rawY % FIELD_H) + FIELD_H) % FIELD_H - MARGIN;

    const R = 50 + s5 * 90;                     // 雲のサイズ 50〜140
    const alpha = baseAlpha * (0.7 + s6 * 0.3);
    drawOnePuff(ctx, cx, cy, R, alpha, i);
  }
  ctx.restore();
}

// 雲1つ = 4〜6個の半透明ラジアル円をまとめて描く(mochi のような形)
function drawOnePuff(ctx, cx, cy, R, alpha, seed) {
  const N = 4 + (seed % 3); // 4, 5, 6
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 + hash01(seed, 100 + k) * 0.6;
    const d = R * (0.35 + hash01(seed, 200 + k) * 0.35); // 中心からの距離
    const r = R * (0.45 + hash01(seed, 300 + k) * 0.35); // 半径
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0,   `rgba(252, 252, 255, ${alpha})`);
    g.addColorStop(0.6, `rgba(250, 250, 254, ${alpha * 0.45})`);
    g.addColorStop(1,   'rgba(250, 250, 254, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- 雨: 細く・小さく・ゆっくり(デフォルト)。ambience で調整可 ----
function drawRain(ctx, W, H, t, ambience) {
  const speedParam   = clamp01(ambience?.rainSpeed,   0.25);
  const sizeParam    = clamp01(ambience?.rainSize,    0.25);
  const densityParam = clamp01(ambience?.rainDensity, 0.5);

  ctx.save();
  // 薄い青灰色のティント(湿り気)
  ctx.fillStyle = `rgba(70, 85, 110, ${0.05 + sizeParam * 0.04})`;
  ctx.fillRect(0, 0, W, H);

  const N = 30 + Math.floor(densityParam * 220);  // 30〜250本
  const FALL = 60 + speedParam * 500;             // 60〜560 px/sec
  const LEN = 5 + sizeParam * 20;                 // 5〜25 px
  const THICKNESS = 0.35 + sizeParam * 1.15;      // 0.35〜1.5 px
  const ANGLE = 0.12;                             // ほぼ垂直
  const ax = Math.sin(ANGLE), ay = Math.cos(ANGLE);

  ctx.strokeStyle = `rgba(210, 225, 240, ${0.22 + sizeParam * 0.25})`;
  ctx.lineWidth = THICKNESS;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tSec = t / 1000;
  for (let i = 0; i < N; i++) {
    const col = (i * 131) % W;
    const phase = (i * 37) % 1000;
    const y = ((tSec * FALL + phase) % (H + 120)) - 60;
    const xBase = col + ((tSec * 18 + i * 41) % 50);
    const x0 = xBase;
    const y0 = y;
    const x1 = x0 + ax * LEN;
    const y1 = y0 + ay * LEN;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.restore();
}
