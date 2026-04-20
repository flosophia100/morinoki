// デザイン調整可能なパラメータ
// 管理者がスライダーで変更し、全クライアントに反映される
// どれも 0..1 に正規化された値(UIで扱いやすく)

export const DEFAULTS = {
  lengthVar: 0.15,    // 放射線の長さ変動(0=均一, 1=大きくバラつく) — こんもり
  density: 0.55,      // 放射線の密度(0=スカスカ, 1=濃密)
  bend: 0.5,          // 曲線の曲がり具合(0=直線, 1=大きく湾曲)
  spikeChance: 0.1,   // 外周スパイクの頻度(0=全部短い, 1=全部長く突き出す)
  spikeLen: 0.3,      // スパイクの長さ倍率(0=短い, 1=長い)
  nodeSize: 0.5,      // 葉ノードサイズ(0=小, 1=大)
  trunkSize: 0.5,     // 幹サイズ(0=小, 1=大)
  branchThickness: 0.5, // 枝の太さ(0=細い, 1=太い)
  branchMeander: 0.5, // 枝の蛇行度(0=直線, 1=大きく曲がる)
  shimmerAmp: 0.5,    // ゆらぎ振幅(0=静止, 1=大きく揺れる)
  shimmerSpeed: 0.5,  // ゆらぎ速さ(0=ゆっくり, 1=早い)
  nodeShimmer: 0.5,   // ノード個別のゆらぎ量(0=静止, 1=強い)
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

// スライダー用のメタ情報(ラベル・範囲)
export const META = [
  { key: 'trunkSize',       label: '幹の大きさ' },
  { key: 'nodeSize',        label: '枝ノードの大きさ' },
  { key: 'density',         label: '放射線の密度' },
  { key: 'lengthVar',       label: '放射線の長さ変動' },
  { key: 'bend',            label: '放射線の曲がり' },
  { key: 'spikeChance',     label: '外周スパイク頻度' },
  { key: 'spikeLen',        label: '外周スパイクの長さ' },
  { key: 'branchThickness', label: '枝の太さ' },
  { key: 'branchMeander',   label: '枝の蛇行度' },
  { key: 'shimmerAmp',      label: '樹のゆらぎ(振幅)' },
  { key: 'shimmerSpeed',    label: '樹のゆらぎ(速さ)' },
  { key: 'nodeShimmer',     label: 'ノードのゆらぎ' },
];
