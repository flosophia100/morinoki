// 最小構成のノードシム
//   - 各ノードに sway を**直接代入** (simDX/Y)。spring/charge/wind/velocity なし
//   - ドラッグ中 (_dragging) は simDX/Y を凍結
//   - hard separation: 実描画半径 n._r ベースで重なりを直接解消(2反復)

const CFG = {
  FALLBACK_R: 26,   // n._r が未設定時
  ITER: 2,          // hard separation 反復数
  BUFFER: 1.06,     // 最小距離 = (ra + rb) * 1.06
};

export function tickNodeSim(trees, t, design = null) {
  const windMul    = design ? (design.nodeShimmer  * 2.0)   : 1.0;
  const nodeDrift  = design ? (design.nodeDrift    ?? 0.6)   : 0.6;
  const swayDepth  = design ? (design.nodeSwayDepth ?? 0.7)  : 0.7;

  const all = [];
  trees.forEach(tree => {
    (tree.nodes || []).forEach(n => {
      if (n._x == null) return;
      if (n.simDX == null) { n.simDX = 0; n.simDY = 0; }
      all.push({ n, tree, depth: n._depth || 0 });
    });
  });
  if (all.length === 0) return;

  // 深さ別振幅:depth=0 控えめ、depth≥1 で大きく
  function swayAmp(depth) {
    if (depth === 0) return (8 + nodeDrift * 22) * windMul;
    const base = (25 + nodeDrift * 75) * windMul;           // 25〜100 px 中立
    const boost = 1 + Math.min(depth - 1, 2) * swayDepth * 0.45;
    return base * boost;
  }

  // 1) sway を直接代入(dragging は凍結)
  for (const { n, depth } of all) {
    if (n._dragging) continue;
    const seed = (n.id && n.id.charCodeAt)
      ? (n.id.charCodeAt(0) + (n.id.charCodeAt(1) || 0))
      : 0;
    const ph = seed * 0.17 + (n.text?.length || 0) * 0.11;
    const amp = swayAmp(depth);
    const sx = Math.sin(t * 0.13 + ph)         * amp
             + Math.sin(t * 0.063 + ph * 1.7)  * amp * 0.4;
    const sy = Math.cos(t * 0.105 + ph * 1.3)  * amp
             + Math.cos(t * 0.048 + ph * 0.9)  * amp * 0.35;
    n.simDX = sx;
    n.simDY = sy;
  }

  // (サイズ脈動は廃止 — ノードの大きさは design.nodeSize のみで決まる)

  // 2) hard separation(実半径ベース、2反復)
  //    位置は _restX + simDX を使う。n._x には前フレームの simDX が既に
  //    畳み込まれているので使ってはいけない(二重加算でワープする)
  const PUSH_CAP = 40; // 1反復あたりの最大補正量
  for (let iter = 0; iter < CFG.ITER; iter++) {
    for (let i = 0; i < all.length; i++) {
      const a = all[i].n;
      const ra = a._r || CFG.FALLBACK_R;
      const arx = a._restX != null ? a._restX : (a._x || 0) - (a.simDX || 0);
      const ary = a._restY != null ? a._restY : (a._y || 0) - (a.simDY || 0);
      const ax = arx + a.simDX, ay = ary + a.simDY;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j].n;
        const rb = b._r || CFG.FALLBACK_R;
        const minD = (ra + rb) * CFG.BUFFER;
        const brx = b._restX != null ? b._restX : (b._x || 0) - (b.simDX || 0);
        const bry = b._restY != null ? b._restY : (b._y || 0) - (b.simDY || 0);
        const bx = brx + b.simDX, by = bry + b.simDY;
        const dx = bx - ax, dy = by - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = Math.min(PUSH_CAP, (minD - d) / 2);
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) { a.simDX -= ux * push; a.simDY -= uy * push; }
        if (!b._dragging) { b.simDX += ux * push; b.simDY += uy * push; }
      }
    }
  }
}

// 作成/編集時の小さな「ふわっ」アニメ用(互換のため残す、軽い効果のみ)
export function impulseFor(node /*, magnitude = 4 */) {
  if (!node) return;
  // 最小構成では位置は sway で決まるので、ここでは何もしない
}

// 他ノードへの波紋(互換のため残す、no-op)
export function ripple(/* fromNode, trees, strength = 3 */) {
  // 最小構成では no-op
}
