// ノード粒子シミュレーション
// 各ノードに (simDX, simDY, vx, vy) を持たせ、
// tree.js が計算した rest 位置 (_x, _y) に加算して表示する。
//
// 設計の主柱:
//   1. 独立した低周波スウェイ (swayTargetX/Y): 幹の動きとは別位相で
//      葉ノードがふわふわと定まった軌跡を描く。spring はこの動く
//      ターゲットに向かって戻ろうとするので、幹と同期せず相対的に動く。
//   2. 衝突 + 弱い many-body 斥力: 近すぎる葉同士を少し離す。
//   3. 風(wind): 細かい高周波の揺れ。スウェイに重ねて複雑さを出す。
//   4. 伸縮 pulse: 見た目の呼吸(描画で参照)。
//
// 深さ 0(幹直下)は控えめ、depth≥1 は振幅・バネ緩和を大きく。

const CFG = {
  COLLIDE_R: 26,
  COLLIDE_K: 0.45,
  CHARGE: -120,
  SPRING_K_BASE: 0.05, // rest(=sway target)へ引き戻す強さ(depth=0)
  WIND_AMP: 3.2,       // 高周波 wind
  VEL_DECAY: 0.55,
  MAX_V_BASE: 10,
  SIM_CAP_BASE: 80,    // simDX/Y の上限(depth=0)
};

export function tickNodeSim(trees, t, design = null) {
  const windMul    = design ? (design.nodeShimmer * 2.0)       : 1.0;
  const pulseAmp   = design ? (design.nodePulseAmp   ?? 0.4)   : 0.4;
  const pulseSpeed = design ? (design.nodePulseSpeed ?? 0.4)   : 0.4;
  const nodeDrift  = design ? (design.nodeDrift     ?? 0.6)    : 0.6;
  const swayDepth  = design ? (design.nodeSwayDepth ?? 0.7)    : 0.7;

  const all = [];
  trees.forEach(tree => {
    (tree.nodes || []).forEach(n => {
      if (n._x == null) return;
      if (n.simDX == null) { n.simDX = 0; n.simDY = 0; n.vx = 0; n.vy = 0; }
      all.push({ n, tree, depth: n._depth || 0 });
    });
  });
  if (all.length === 0) return;

  // depth ごとのパラメータ
  //   depth=0: 幹直下、硬め
  //   depth>=1: nodeDrift / swayDepth で大きく緩く
  function springK(depth) {
    if (depth === 0) return CFG.SPRING_K_BASE;
    const loosen = nodeDrift * 0.55 + Math.min(depth, 3) * swayDepth * 0.08;
    return Math.max(0.012, CFG.SPRING_K_BASE * (1 - Math.min(0.8, loosen)));
  }
  function maxV(depth) {
    if (depth === 0) return CFG.MAX_V_BASE;
    const boost = 1 + nodeDrift * 0.8 + Math.min(depth, 3) * swayDepth * 0.20;
    return CFG.MAX_V_BASE * boost;
  }
  function simCap(depth) {
    if (depth === 0) return CFG.SIM_CAP_BASE;
    const boost = 1 + nodeDrift * 1.8 + Math.min(depth, 3) * swayDepth * 0.50;
    return CFG.SIM_CAP_BASE * boost;
  }
  // 低周波スウェイの振幅(px)
  //   depth=0 は控えめ、depth≥1 で大きく
  function swayAmp(depth) {
    if (depth === 0) return 20 + nodeDrift * 30; // 幹直下は 20〜50px
    const base = 60 + nodeDrift * 160;           // 60〜220 px
    const depthBoost = 1 + Math.min(depth - 1, 2) * swayDepth * 0.5;
    return base * depthBoost;
  }
  // 高周波 wind の振幅(spring を押す微振動)
  function windAmp(depth) {
    if (depth === 0) return CFG.WIND_AMP;
    const boost = 1 + nodeDrift * 0.6 + Math.min(depth, 3) * swayDepth * 0.3;
    return CFG.WIND_AMP * boost;
  }

  // 1) スウェイ target → spring で引き寄せ
  //    各ノードは id/text から位相を作り、独立した低周波軌跡を描く
  for (const { n, depth } of all) {
    const seed = (n.id && n.id.charCodeAt ? n.id.charCodeAt(0) : 0)
               + (n.text?.length || 0)
               + (n.text?.charCodeAt(1) || 0);
    const ph = seed * 0.17;
    const amp = swayAmp(depth) * windMul;
    // 2周期重ねて複雑な軌跡に(幹と同じ手法で位相を大きくずらす)
    const tgtX = Math.sin(t * 0.13 + ph * 2.3) * amp
               + Math.sin(t * 0.063 + ph * 1.1) * amp * 0.45;
    const tgtY = Math.cos(t * 0.105 + ph * 1.8) * amp
               + Math.cos(t * 0.048 + ph * 0.9) * amp * 0.4;
    n._swayTargetX = tgtX;
    n._swayTargetY = tgtY;

    if (n._dragging) continue;
    // spring: simDX を tgtX に向けて引く
    const k = springK(depth);
    n.vx -= (n.simDX - tgtX) * k;
    n.vy -= (n.simDY - tgtY) * k;
  }

  // 2) 衝突 + 弱い many-body 斥力
  for (let i = 0; i < all.length; i++) {
    const a = all[i].n;
    const ax = (a._x || 0) + a.simDX, ay = (a._y || 0) + a.simDY;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j].n;
      const bx = (b._x || 0) + b.simDX, by = (b._y || 0) + b.simDY;
      const dx = bx - ax, dy = by - ay;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1 || d2 > 40000) continue;
      const d = Math.sqrt(d2);
      if (d < CFG.COLLIDE_R) {
        const overlap = (CFG.COLLIDE_R - d) * CFG.COLLIDE_K;
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) { a.vx -= ux * overlap; a.vy -= uy * overlap; }
        if (!b._dragging) { b.vx += ux * overlap; b.vy += uy * overlap; }
      } else {
        const f = CFG.CHARGE / d2;
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) { a.vx -= ux * f * 0.5; a.vy -= uy * f * 0.5; }
        if (!b._dragging) { b.vx += ux * f * 0.5; b.vy += uy * f * 0.5; }
      }
    }
  }

  // 3) 高周波 wind + sizePulse
  const pulseFreq = 0.15 + pulseSpeed * 1.15;
  const pulseAmpl = pulseAmp * 0.35;
  for (const { n, depth } of all) {
    const seed = (n.id && n.id.charCodeAt ? n.id.charCodeAt(0) : 0)
               + (n.text?.length || 0);
    const ph = seed * 0.17;
    if (!n._dragging) {
      const amp = windAmp(depth);
      const wx = (Math.sin(t * 0.95 + ph) * amp + Math.sin(t * 0.32 + ph * 2.1) * amp * 0.5) * windMul;
      const wy = (Math.cos(t * 0.82 + ph * 1.3) * amp + Math.cos(t * 0.27 + ph) * amp * 0.5) * windMul;
      n.vx += wx * 0.06;
      n.vy += wy * 0.06;
    }
    const pPh = ph * 1.7 + ((n.text?.charCodeAt(0) || 0) * 0.31);
    n._sizeScale = 1 + Math.sin(t * pulseFreq + pPh) * pulseAmpl;
  }

  // 4) 積分 + ダンピング + キャップ(深さ依存)
  for (const { n, depth } of all) {
    if (n._dragging) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= CFG.VEL_DECAY;
    n.vy *= CFG.VEL_DECAY;
    const mv = maxV(depth);
    if (n.vx >  mv) n.vx =  mv;
    if (n.vx < -mv) n.vx = -mv;
    if (n.vy >  mv) n.vy =  mv;
    if (n.vy < -mv) n.vy = -mv;
    n.simDX += n.vx;
    n.simDY += n.vy;
    const cap = simCap(depth);
    if (n.simDX >  cap) n.simDX =  cap;
    if (n.simDX < -cap) n.simDX = -cap;
    if (n.simDY >  cap) n.simDY =  cap;
    if (n.simDY < -cap) n.simDY = -cap;
  }
}

// ノード作成/編集時のインパルス: テキストのハッシュから方向を決める
export function impulseFor(node, magnitude = 4) {
  if (!node) return;
  const seed = (node.text || '').split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  const angle = (seed % 360) * Math.PI / 180;
  node.simDX = node.simDX || 0;
  node.simDY = node.simDY || 0;
  node.vx = (node.vx || 0) + Math.cos(angle) * magnitude;
  node.vy = (node.vy || 0) + Math.sin(angle) * magnitude;
}

// 他ノードへ波紋を送る: 距離に応じて外向きインパルス
export function ripple(fromNode, trees, strength = 3) {
  if (!fromNode || fromNode._x == null) return;
  const fx = (fromNode._x || 0) + (fromNode.simDX || 0);
  const fy = (fromNode._y || 0) + (fromNode.simDY || 0);
  trees.forEach(t => {
    (t.nodes || []).forEach(n => {
      if (n === fromNode || n._x == null) return;
      const nx = (n._x || 0) + (n.simDX || 0);
      const ny = (n._y || 0) + (n.simDY || 0);
      const dx = nx - fx, dy = ny - fy;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 200) return;
      const mag = strength * (1 - d / 200);
      n.vx = (n.vx || 0) + dx / d * mag;
      n.vy = (n.vy || 0) + dy / d * mag;
    });
  });
}
