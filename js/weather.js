// 岐阜県美濃市の現在天気を Open-Meteo から取得し、キャンバスに演出を重ねる。
//   - fetchWeather(): 現在天気を取得、state.weather に格納
//   - 10分キャッシュ(外側の setInterval で定期更新)
//   - drawWeather(ctx, W, H, weather, t): 天気に応じた雲 / 雨粒オーバーレイ
//   - 読みやすさを害さないよう、オーバーレイは薄く(alpha 控えめ)
//
// WMO weather_code → category:
//   0            → 'sunny'
//   1, 2, 3      → 'cloudy'
//   45, 48       → 'cloudy' (霧)
//   51-67, 80-82 → 'rainy'
//   71-77, 85-86 → 'rainy' (雪は雨として扱う、暫定)
//   95-99        → 'rainy' (雷雨)

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

// ------ 描画 ------
// t: パフォーマンス時刻(ms)。アニメーション用。
// weather: { category } | null
export function drawWeather(ctx, W, H, weather, t) {
  if (!weather) return;
  if (weather.category === 'cloudy') drawClouds(ctx, W, H, t);
  else if (weather.category === 'rainy') drawRain(ctx, W, H, t);
  // sunny は特に重ね無し(背景の atmosphere に任せる)
}

// ---- 雲: ゆっくり水平に漂う楕円 6〜8個、alpha 控えめ ----
function drawClouds(ctx, W, H, t) {
  ctx.save();
  // わずかに画面トーンを落とす(読みやすさを害さない程度)
  ctx.fillStyle = 'rgba(90, 100, 110, 0.06)';
  ctx.fillRect(0, 0, W, H);

  const CLOUDS = 7;
  for (let i = 0; i < CLOUDS; i++) {
    const speed = 0.008 + (i % 3) * 0.004; // 比較的ゆっくり
    const baseX = (i * W) / CLOUDS - W * 0.2;
    const x = ((baseX + t * speed) % (W * 1.4)) - W * 0.2;
    const y = 60 + ((i * 73) % 180);
    const rx = 80 + (i % 3) * 25;
    const ry = 22 + (i % 2) * 8;
    drawCloud(ctx, x, y, rx, ry);
  }
  ctx.restore();
}

function drawCloud(ctx, cx, cy, rx, ry) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  // 3つの円を重ねてもこもこ形に
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.55, ry * 1.0, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.45, cy + ry * 0.2, rx * 0.35, ry * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.45, cy + ry * 0.2, rx * 0.4, ry * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---- 雨: 斜めのストロークを多数落下(しとしと、読みやすさ優先で薄め) ----
//   deterministic に位相を分布させ、総数を制限
function drawRain(ctx, W, H, t) {
  ctx.save();
  // 薄い青灰色のティント
  ctx.fillStyle = 'rgba(70, 85, 110, 0.08)';
  ctx.fillRect(0, 0, W, H);

  const N = 90;
  const FALL = 380;   // px/sec
  const LEN = 18;
  const ANGLE = 0.18; // ラジアン(ほぼ垂直)
  const sx = Math.sin(ANGLE), cx = Math.cos(ANGLE);

  ctx.strokeStyle = 'rgba(200, 215, 235, 0.35)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tSec = t / 1000;
  for (let i = 0; i < N; i++) {
    // deterministic per i + time offset
    const col = (i * 131) % W;
    const phase = (i * 37) % 1000;
    const period = 1.8 + (i % 11) * 0.08;
    const y = ((tSec * FALL + phase) % (H + 120)) - 60;
    const xBase = col + ((tSec * 28 + i * 41) % 60);
    const x0 = xBase;
    const y0 = y;
    const x1 = x0 + sx * LEN;
    const y1 = y0 + cx * LEN;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    void period;
  }
  ctx.stroke();
  ctx.restore();
}
