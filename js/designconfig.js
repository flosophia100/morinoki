// デザイン調整可能なパラメータ
// 管理者がスライダーで変更し、全クライアントに反映される
// どれも 0..1 に正規化された値(UIで扱いやすく)

export const DEFAULTS = {
  foliage: 0.75,      // 葉の密集度(0=疎らな点描, 1=びっしり覆う)
  lengthVar: 0.12,    // 放射線の長さ変動(0=均一, 1=大きくバラつく)
  density: 0.35,      // 放射線の密度(0=ほぼ無し, 1=多数。葉が主役なので控えめ)
  bend: 0.5,          // 曲線の曲がり具合(0=直線, 1=大きく湾曲)
  spikeChance: 0.06,  // 外周スパイクの頻度(葉の縁に尖りを出す割合)
  spikeLen: 0.2,      // スパイクの長さ倍率(0=短い, 1=長い)
  nodeSize: 0.5,      // 葉ノードサイズ(0=小, 1=大)
  trunkSize: 0.5,     // 幹サイズ(0=小, 1=大)
  branchThickness: 0.5, // 枝の太さ(0=細い, 1=太い)
  branchMeander: 0.5, // 枝の蛇行度(0=直線, 1=大きく曲がる)
  shimmerAmp: 0.5,      // 幹の漂い・振れ幅(0=ほぼ静止, 1=フィールドを広く漂う)
  shimmerSpeed: 0.5,    // 幹の漂い・速さ(0=ゆっくり, 1=速い)
  nodeShimmer: 0.4,     // ノード個別のゆらぎ(位置)
  nodeDrift: 0.6,       // 葉ノードの漂い(0=rest固定, 1=大きく漂う)
  nodeSwayDepth: 0.7,   // 深い階層ほど揺れる倍率(0=均一, 1=葉先ほど大振り)
};

// サーバから取得した design を DEFAULTS とマージ
export function mergeDesign(raw) {
  const out = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const k of Object.keys(DEFAULTS)) {
      const v = Number(raw[k]);
      if (Number.isFinite(v) && v >= 0 && v <= 1) out[k] = v;
    }
  }
  return out;
}

// ---- ambience(背景・ギミック) ----
export const AMBIENCE_DEFAULTS = {
  palette: 'nordic',         // 'nordic' | 'sakura' | 'sunset' | 'pastel' | 'mono' | 'aurora'
  timeCurve: 'auto',         // 'auto' | 'dawn' | 'morning' | 'noon' | 'afternoon' | 'sunset' | 'dusk' | 'night'
  season: 'auto',            // 'auto' | 'spring' | 'summer' | 'autumn' | 'winter'
  birdFreq: 0.5,             // 0..1 (出現頻度倍率)
  canopyDensity: 0.5,        // 0..1 (背景森影の密度)
  mistIntensity: 0.5,        // 0..1 (曇り天気時の雲/霧の濃さ)
  weatherOverride: 'auto',   // 'auto' | 'sunny' | 'cloudy' | 'rainy'
                             //   'auto' は Open-Meteo の美濃市現在天気を使う
  rainSpeed: 0.25,           // 0..1 (雨粒の落下速度、0=ゆっくり)
  rainSize: 0.25,            // 0..1 (雨粒の大きさ/太さ、0=細く小さい)
  rainDensity: 0.5,          // 0..1 (雨粒の量)
};

export const WEATHER_OVERRIDE_OPTIONS = [
  { value: 'auto',   label: '自動(岐阜県美濃市の現在天気)' },
  { value: 'sunny',  label: '☀ 晴れに固定' },
  { value: 'cloudy', label: '☁ 曇りに固定' },
  { value: 'rainy',  label: '🌧 雨に固定' },
];

export function mergeAmbience(raw) {
  const out = { ...AMBIENCE_DEFAULTS };
  if (raw && typeof raw === 'object') {
    if (typeof raw.palette === 'string') out.palette = raw.palette;
    if (typeof raw.timeCurve === 'string') out.timeCurve = raw.timeCurve;
    if (typeof raw.season === 'string') out.season = raw.season;
    const bf = Number(raw.birdFreq); if (Number.isFinite(bf) && bf >= 0 && bf <= 1) out.birdFreq = bf;
    const cd = Number(raw.canopyDensity); if (Number.isFinite(cd) && cd >= 0 && cd <= 1) out.canopyDensity = cd;
    const mi = Number(raw.mistIntensity); if (Number.isFinite(mi) && mi >= 0 && mi <= 1) out.mistIntensity = mi;
    if (typeof raw.weatherOverride === 'string' &&
        ['auto','sunny','cloudy','rainy'].includes(raw.weatherOverride)) {
      out.weatherOverride = raw.weatherOverride;
    }
    const rs  = Number(raw.rainSpeed);   if (Number.isFinite(rs)  && rs  >= 0 && rs  <= 1) out.rainSpeed   = rs;
    const rsz = Number(raw.rainSize);    if (Number.isFinite(rsz) && rsz >= 0 && rsz <= 1) out.rainSize    = rsz;
    const rd  = Number(raw.rainDensity); if (Number.isFinite(rd)  && rd  >= 0 && rd  <= 1) out.rainDensity = rd;
  }
  return out;
}

export const PALETTE_OPTIONS = [
  { value: 'nordic',  label: '北欧(標準)' },
  { value: 'sakura',  label: '桜' },
  { value: 'sunset',  label: '夕焼け' },
  { value: 'pastel',  label: 'パステル' },
  { value: 'mono',    label: '墨(モノクロ)' },
  { value: 'aurora',  label: 'オーロラ' },
];

export const TIME_CURVE_OPTIONS = [
  { value: 'auto',      label: '自動(現在時刻)' },
  { value: 'dawn',      label: '夜明け固定' },
  { value: 'morning',   label: '朝固定' },
  { value: 'noon',      label: '昼固定' },
  { value: 'afternoon', label: '夕方固定' },
  { value: 'sunset',    label: '夕焼け固定' },
  { value: 'dusk',      label: '薄暮固定' },
  { value: 'night',     label: '夜固定' },
];
export const SEASON_OPTIONS = [
  { value: 'auto',   label: '自動(現在の月)' },
  { value: 'spring', label: '春固定' },
  { value: 'summer', label: '夏固定' },
  { value: 'autumn', label: '秋固定' },
  { value: 'winter', label: '冬固定' },
];

// スライダー用のメタ情報(ラベル・範囲)
export const META = [
  { key: 'trunkSize',       label: '幹の大きさ' },
  { key: 'nodeSize',        label: '枝ノードの大きさ' },
  { key: 'foliage',         label: '葉の密集度' },
  { key: 'density',         label: '放射線の密度' },
  { key: 'lengthVar',       label: '放射線の長さ変動' },
  { key: 'bend',            label: '放射線の曲がり' },
  { key: 'spikeChance',     label: '外周スパイク頻度' },
  { key: 'spikeLen',        label: '外周スパイクの長さ' },
  { key: 'branchThickness', label: '枝の太さ' },
  { key: 'branchMeander',   label: '枝の蛇行度' },
  { key: 'shimmerAmp',      label: '幹の漂い(距離)' },
  { key: 'shimmerSpeed',    label: '幹の漂い(速さ)' },
  { key: 'nodeShimmer',     label: 'ノードのゆらぎ(位置)' },
  { key: 'nodeDrift',       label: '葉ノードの漂い(範囲)' },
  { key: 'nodeSwayDepth',   label: '葉先ほど揺れる' },
];
