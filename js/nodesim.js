// ノード粒子シミュレーション(wordmapのD3 force設定を参考にした軽量版)
// 各ノードに (simDX, simDY, vx, vy) を持たせ、
// tree.js が計算したrest位置 (_x, _y) に加算して表示する。
// - 近隣ノードとの衝突(collide) → vx/vyに反発
// - 全ノード間のmany-body(遠方は弱い)
// - 深さに応じた wind amp / spring 緩和(葉先ほど大振り)
// - 文言類似による弱い引力(textAffinity)
// - ドラッグ中はスキップ
// - 新規・編集・ドラッグ終了時にimpulseを発生
//
// 参考: reference/wordmap/config.js
// FORCE = { LINK_DISTANCE:100, CHARGE:-300, COLLIDE:35, VEL_DECAY:0.4 }

import { ensureBigrams, jaccardSim } from './textsim.js';

const CFG = {
  COLLIDE_R: 26,
  COLLIDE_K: 0.45,
  CHARGE: -120,       // -300/3 で弱めに(wordmapは全体sim、ここはrest基準)
  SPRING_K_BASE: 0.06, // rest へのバネ(depth=0)
  WIND_AMP: 3.2,
  VEL_DECAY: 0.55,
  MAX_V_BASE: 8,
  SIM_CAP_BASE: 50,
  // textAffinity
  AFFINITY_R: 350,    // この距離内のみ文言類似引力を評価
  AFFINITY_THRESHOLD: 0.25,
};

export function tickNodeSim(trees, t, design = null) {
  // design.nodeShimmer: 0..1 → 風のamp倍率 0..2(0.5中立で1.0)
  const windMul = design ? (design.nodeShimmer * 2.0) : 1.0;
  // ノードの伸縮 pulse(sizeScale 計算用)
  const pulseAmp   = design ? (design.nodePulseAmp   ?? 0.4) : 0.4;   // 0..1 → 0..0.35振幅
  const pulseSpeed = design ? (design.nodePulseSpeed ?? 0.4) : 0.4;   // 0..1 → 0.15..1.3周期
  // 葉の漂い(バネ緩み + キャップ拡大)
  const nodeDrift = design ? (design.nodeDrift ?? 0.5) : 0.5;        // 0..1
  // 深さ依存の揺れ倍率(葉先ほど増幅)
  const swayDepth = design ? (design.nodeSwayDepth ?? 0.6) : 0.6;     // 0..1
  // 文言類似による引力
  const textAffinity = design ? (design.textAffinity ?? 0.4) : 0.4;   // 0..1

  // 全ノードを集める
  const all = [];
  trees.forEach(tree => {
    (tree.nodes || []).forEach(n => {
      if (n._x == null) return; // まだ描画されていないものはスキップ
      if (n.simDX == null) { n.simDX = 0; n.simDY = 0; n.vx = 0; n.vy = 0; }
      all.push({ n, tree, depth: n._depth || 0 });
    });
  });
  if (all.length === 0) return;

  // depth-aware パラメータヘルパ
  //   depth=0 (幹直下): バネ強め、キャップ小さめ
  //   depth>=1 (葉先)   : nodeDrift と swayDepth に応じてバネ緩和、キャップ拡大
  function depthSpring(depth) {
    if (depth === 0) return CFG.SPRING_K_BASE;
    const loosen = nodeDrift * 0.6 + Math.min(depth, 3) * swayDepth * 0.08;
    return Math.max(0.015, CFG.SPRING_K_BASE * (1 - Math.min(0.75, loosen)));
  }
  function depthMaxV(depth) {
    if (depth === 0) return CFG.MAX_V_BASE;
    const boost = 1 + nodeDrift * 0.6 + Math.min(depth, 3) * swayDepth * 0.12;
    return CFG.MAX_V_BASE * boost;
  }
  function depthSimCap(depth) {
    if (depth === 0) return CFG.SIM_CAP_BASE;
    const boost = 1 + nodeDrift * 1.2 + Math.min(depth, 3) * swayDepth * 0.25;
    return CFG.SIM_CAP_BASE * boost;
  }
  function depthWindAmp(depth) {
    if (depth === 0) return CFG.WIND_AMP;
    const boost = 1 + nodeDrift * 1.0 + Math.min(depth, 3) * swayDepth * 0.35;
    return CFG.WIND_AMP * boost;
  }

  // 1) 各ノードは rest ( _x, _y ) へ戻ろうとする (spring)
  for (const { n, depth } of all) {
    if (n._dragging) continue;
    const f = depthSpring(depth);
    n.vx -= n.simDX * f;
    n.vy -= n.simDY * f;
  }

  // 2) 衝突 + 斥力 + 文言引力 (nested loop, O(N^2) だが N=数百までなら軽い)
  //    文言類似は textAffinity > 0 の時のみ評価。bigram はノードにキャッシュ。
  const applyAffinity = textAffinity > 0.01;
  for (let i = 0; i < all.length; i++) {
    const a = all[i].n;
    const ax = (a._x || 0) + a.simDX, ay = (a._y || 0) + a.simDY;
    if (applyAffinity) ensureBigrams(a, 'text');
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j].n;
      const bx = (b._x || 0) + b.simDX, by = (b._y || 0) + b.simDY;
      const dx = bx - ax, dy = by - ay;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1 || d2 > 40000) continue;
      const d = Math.sqrt(d2);
      // 衝突半径内は強く反発
      if (d < CFG.COLLIDE_R) {
        const overlap = (CFG.COLLIDE_R - d) * CFG.COLLIDE_K;
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) { a.vx -= ux * overlap; a.vy -= uy * overlap; }
        if (!b._dragging) { b.vx += ux * overlap; b.vy += uy * overlap; }
      } else {
        // 弱い many-body repulsion
        const f = CFG.CHARGE / d2;
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) { a.vx -= ux * f * 0.5; a.vy -= uy * f * 0.5; }
        if (!b._dragging) { b.vx += ux * f * 0.5; b.vy += uy * f * 0.5; }
      }
      // 文言類似引力(近距離のみ)
      if (applyAffinity && d < CFG.AFFINITY_R) {
        ensureBigrams(b, 'text');
        const sim = jaccardSim(a._bigrams, b._bigrams);
        if (sim > CFG.AFFINITY_THRESHOLD) {
          // sim を [threshold, 1] → [0, 1] にマップして強度計算
          const s = (sim - CFG.AFFINITY_THRESHOLD) / (1 - CFG.AFFINITY_THRESHOLD);
          // ターゲット距離: sim が高いほど近づく(COLLIDE 少し外側〜AFFINITY_R/2)
          const targetD = 60 + (1 - s) * 160;
          const diff = d - targetD;
          if (Math.abs(diff) > 4) {
            const pull = (diff / d) * 0.008 * s * textAffinity;
            if (!a._dragging) { a.vx += dx * pull; a.vy += dy * pull; }
            if (!b._dragging) { b.vx -= dx * pull; b.vy -= dy * pull; }
          }
        }
      }
    }
  }

  // 3) per-node wind(個別位相) + sizePulse
  const pulseFreq = 0.15 + pulseSpeed * 1.15;
  const pulseAmpl = pulseAmp * 0.35; // 0..0.35
  for (const { n, depth } of all) {
    const seed = (n.id && n.id.charCodeAt ? n.id.charCodeAt(0) : 0) + (n.text?.length || 0);
    const ph = seed * 0.17;
    // 位置風(深さ依存)
    if (!n._dragging) {
      const amp = depthWindAmp(depth);
      const wx = (Math.sin(t * 0.95 + ph) * amp + Math.sin(t * 0.32 + ph * 2.1) * amp * 0.5) * windMul;
      const wy = (Math.cos(t * 0.82 + ph * 1.3) * amp + Math.cos(t * 0.27 + ph) * amp * 0.5) * windMul;
      n.vx += wx * 0.06;
      n.vy += wy * 0.06;
    }
    // 伸縮 pulse: 独立位相で呼吸のように大小
    const pPh = ph * 1.7 + ((n.text?.charCodeAt(0) || 0) * 0.31);
    n._sizeScale = 1 + Math.sin(t * pulseFreq + pPh) * pulseAmpl;
  }

  // 4) 積分 + ダンピング + 速度キャップ(深さ依存)
  for (const { n, depth } of all) {
    if (n._dragging) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= CFG.VEL_DECAY;
    n.vy *= CFG.VEL_DECAY;
    const maxV = depthMaxV(depth);
    if (n.vx > maxV) n.vx = maxV;
    if (n.vx < -maxV) n.vx = -maxV;
    if (n.vy > maxV) n.vy = maxV;
    if (n.vy < -maxV) n.vy = -maxV;
    n.simDX += n.vx;
    n.simDY += n.vy;
    // simDX/Y も範囲内に抑える(深さ依存で広い)
    const cap = depthSimCap(depth);
    if (n.simDX > cap) n.simDX = cap;
    if (n.simDX < -cap) n.simDX = -cap;
    if (n.simDY > cap) n.simDY = cap;
    if (n.simDY < -cap) n.simDY = -cap;
  }
}

// ノード作成/編集時のインパルス: 入力テキストのハッシュから方向を決める
export function impulseFor(node, magnitude = 4) {
  if (!node) return;
  const seed = (node.text || '').split('').reduce((a,c) => a + c.charCodeAt(0), 0);
  const angle = (seed % 360) * Math.PI / 180;
  node.simDX = node.simDX || 0;
  node.simDY = node.simDY || 0;
  node.vx = (node.vx || 0) + Math.cos(angle) * magnitude;
  node.vy = (node.vy || 0) + Math.sin(angle) * magnitude;
}

// 他のノード群に連動の波紋を送る: 指定ノードから距離に応じて外向きインパルス
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
      if (d > 200) return; // 範囲外スキップ
      const mag = strength * (1 - d / 200);
      n.vx = (n.vx || 0) + dx / d * mag;
      n.vy = (n.vy || 0) + dy / d * mag;
    });
  });
}
