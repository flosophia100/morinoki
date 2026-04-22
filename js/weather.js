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

// 管理者が天気エフェクトを上書きしていればそれを優先。
//   ambience.weatherOverride: 'auto' | 'sunny' | 'cloudy' | 'rainy'
function resolveCategory(weather, ambience) {
  const ov = ambience?.weatherOverride;
  if (ov && ov !== 'auto' && ['sunny','cloudy','rainy'].includes(ov)) return ov;
  return weather?.category || null;
}

// ------ 描画 ------
// t: パフォーマンス時刻(ms)。アニメーション用。
// weather: { category } | null
// ambience: mistIntensity / weatherOverride を参照
export function drawWeather(ctx, W, H, weather, t, ambience = null) {
  const category = resolveCategory(weather, ambience);
  if (!category) return;
  if (category === 'cloudy') drawMist(ctx, W, H, t, ambience);
  else if (category === 'rainy') {
    // 雨のときも薄く霧を重ねて湿っぽさを出す
    drawMist(ctx, W, H, t, ambience);
    drawRain(ctx, W, H, t);
  }
  // sunny は特に重ね無し(背景の atmosphere に任せる)
}

// ---- 曇り=霧: 高解像度の霧パッチ(複数の固まり)が 2D ランダム方向にゆっくり漂う ----
//   mistIntensity(0-1) で密度・濃さを制御。0 = ほぼ見えない、1 = 濃霧
//   各パッチは固有の方向ベクトルを持ち、画面外に出たら反対側から再登場(トロイダル)
function drawMist(ctx, W, H, t, ambience) {
  const intensity = ambience && typeof ambience.mistIntensity === 'number'
    ? Math.max(0, Math.min(1, ambience.mistIntensity))
    : 0.5;
  if (intensity <= 0.01) return;

  ctx.save();
  // 画面全体をわずかに曇らせる
  ctx.fillStyle = `rgba(90, 100, 110, ${0.02 + intensity * 0.06})`;
  ctx.fillRect(0, 0, W, H);

  // 霧の"固まり" = 複数パッチのクラスタ。各クラスタごとにランダムな方向で移動
  const CLUSTERS = Math.floor(5 + intensity * 10);   // 5〜15 個の固まり
  const PATCHES_PER = 3 + Math.floor(intensity * 3); // 1クラスタあたり 3〜6 パッチ
  const maxAlpha = 0.06 + intensity * 0.22;          // 0.06〜0.28
  const tSec = t / 1000;

  // 画面を上下左右に 200px オーバーフローさせた大きな矩形の中で wrap
  const MARGIN = 250;
  const FIELD_W = W + MARGIN * 2;
  const FIELD_H = H + MARGIN * 2;

  for (let c = 0; c < CLUSTERS; c++) {
    // クラスタ固有の種 → 初期位置・速度・方向
    const s1 = ((c * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const s2 = ((c * 2147483647 + 98765) & 0x7fffffff) / 0x7fffffff;
    const s3 = ((c * 48271 + 54321)     & 0x7fffffff) / 0x7fffffff;
    const s4 = ((c * 7919 + 11131)      & 0x7fffffff) / 0x7fffffff;

    // 速度 6〜24 px/sec、方向はランダム 2D
    const speed = 6 + s3 * 18;
    const angle = s4 * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    // 初期位置 (field 内)
    const baseX = s1 * FIELD_W;
    const baseY = s2 * FIELD_H;

    // 現在位置(時間で移動 + wrap)
    // 0..FIELD_W の範囲に収める
    const rawX = baseX + tSec * vx;
    const rawY = baseY + tSec * vy;
    const cx = ((rawX % FIELD_W) + FIELD_W) % FIELD_W - MARGIN;
    const cy = ((rawY % FIELD_H) + FIELD_H) % FIELD_H - MARGIN;

    // クラスタ内で複数のサブパッチを配置
    for (let p = 0; p < PATCHES_PER; p++) {
      const ps = ((c * 131 + p * 37) & 0x7fffffff) / 0x7fffffff;
      const pa = ps * Math.PI * 2;
      const pd = 30 + (((c + p) * 53) % 80);  // クラスタ中心からの距離 30〜110
      const x = cx + Math.cos(pa) * pd;
      const y = cy + Math.sin(pa) * pd;

      // 解像度を高める: 各パッチにも 2〜3 層のサブ円
      const R = 35 + ps * 95;  // 35〜130 px
      const layers = 2 + (p % 3);
      for (let k = 0; k < layers; k++) {
        const kRng = ((c * 31 + p * 97 + k * 7) & 0x7fffffff) / 0x7fffffff;
        const r = R * (0.55 + kRng * 0.45);
        const ox = (kRng - 0.5) * R * 0.6;
        const oy = (((kRng * 7) % 1)) * R * 0.4 - R * 0.2;
        const alpha = maxAlpha * (0.35 + kRng * 0.65);
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, `rgba(248, 248, 252, ${alpha})`);
        g.addColorStop(0.55, `rgba(245, 247, 250, ${alpha * 0.55})`);
        g.addColorStop(1, 'rgba(245, 247, 250, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
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
