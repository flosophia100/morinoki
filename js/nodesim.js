// ノード粒子シミュレーション(wordmapのD3 force設定を参考にした軽量版)
// 各ノードに (simDX, simDY, vx, vy) を持たせ、
// tree.js が計算したrest位置 (_x, _y) に加算して表示する。
// - 近隣ノードとの衝突(collide) → vx/vyに反発
// - 全ノード間のmany-body(遠方は弱い)
// - ドラッグ中はスキップ
// - 新規・編集・ドラッグ終了時にimpulseを発生
//
// 参考: reference/wordmap/config.js
// FORCE = { LINK_DISTANCE:100, CHARGE:-300, COLLIDE:35, VEL_DECAY:0.4 }

const CFG = {
  COLLIDE_R: 26,
  COLLIDE_K: 0.45,
  CHARGE: -120,     // -300/3 で弱めに(wordmapは全体sim、ここはrest基準)
  SPRING_K: 0.06,   // rest へのバネ
  WIND_AMP: 3.2,
  VEL_DECAY: 0.55,
  MAX_V: 8,
};

export function tickNodeSim(trees, t) {
  // 全ノードを集める
  const all = [];
  trees.forEach(tree => {
    (tree.nodes || []).forEach(n => {
      if (n._x == null) return; // まだ描画されていないものはスキップ
      if (n.simDX == null) { n.simDX = 0; n.simDY = 0; n.vx = 0; n.vy = 0; }
      all.push({ n, tree });
    });
  });
  if (all.length === 0) return;

  // 1) 各ノードは rest ( _x, _y ) へ戻ろうとする (spring)
  for (const { n } of all) {
    if (n._dragging) continue;
    const f = CFG.SPRING_K;
    n.vx -= n.simDX * f;
    n.vy -= n.simDY * f;
  }

  // 2) 衝突 + 斥力 (nested loop, O(N^2) だが N=数百までなら軽い)
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
    }
  }

  // 3) per-node wind(個別位相)
  for (const { n } of all) {
    if (n._dragging) continue;
    const seed = (n.id && n.id.charCodeAt ? n.id.charCodeAt(0) : 0) + (n.text?.length || 0);
    const ph = seed * 0.17;
    const wx = Math.sin(t * 0.95 + ph) * CFG.WIND_AMP + Math.sin(t * 0.32 + ph * 2.1) * CFG.WIND_AMP * 0.5;
    const wy = Math.cos(t * 0.82 + ph * 1.3) * CFG.WIND_AMP + Math.cos(t * 0.27 + ph) * CFG.WIND_AMP * 0.5;
    n.vx += wx * 0.06;
    n.vy += wy * 0.06;
  }

  // 4) 積分 + ダンピング + 速度キャップ
  for (const { n } of all) {
    if (n._dragging) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= CFG.VEL_DECAY;
    n.vy *= CFG.VEL_DECAY;
    // cap
    if (n.vx > CFG.MAX_V) n.vx = CFG.MAX_V;
    if (n.vx < -CFG.MAX_V) n.vx = -CFG.MAX_V;
    if (n.vy > CFG.MAX_V) n.vy = CFG.MAX_V;
    if (n.vy < -CFG.MAX_V) n.vy = -CFG.MAX_V;
    n.simDX += n.vx;
    n.simDY += n.vy;
    // simDX/Y も範囲内に抑える
    const max = 50;
    if (n.simDX > max) n.simDX = max;
    if (n.simDX < -max) n.simDX = -max;
    if (n.simDY > max) n.simDY = max;
    if (n.simDY < -max) n.simDY = -max;
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
  // 連関: 同じtreeの他ノードも小さくインパルス(類似文字数)
  // (呼び出し側でtree渡されたら処理したいが、APIを単純に保つため今はこのノードのみ)
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
