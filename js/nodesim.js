// 最小構成のノードシム + 持続的分離(_sepX/_sepY)
//
//   表示位置 = rest + simDX
//   simDX   = raw_sway + _sepX     (raw_sway は純 sin/cos、_sepX は hard sep の累積)
//
//   _sepX は毎フレーム decay。overlap が続く間は sep が貯まり、解消すると戻る。
//   これで push 方向が反転しても単発フリッカーにならない。
//
//   ドラッグ中 (_dragging) は raw_sway 更新も sep decay もスキップ(完全凍結)

import { trunkRadiusFor } from './tree.js';

const CFG = {
  FALLBACK_R: 26,
  ITER: 2,
  BUFFER: 1.06,
  PUSH_CAP: 40,       // 1反復の最大補正
  SEP_DECAY: 0.977,   // 半減期 ≈ 30 frame
  SIM_CAP: 250,       // simDX/Y 絶対上限(安全網)
};

export function tickNodeSim(trees, t, design = null, fadeIn = 1.0) {
  const windMul    = design ? (design.nodeShimmer  * 2.0)   : 1.0;
  const nodeDrift  = design ? (design.nodeDrift    ?? 0.6)  : 0.6;
  const swayDepth  = design ? (design.nodeSwayDepth ?? 0.7) : 0.7;

  const all = [];
  trees.forEach(tree => {
    (tree.nodes || []).forEach(n => {
      if (n._x == null) return;
      if (n.simDX == null)  { n.simDX = 0;  n.simDY = 0; }
      if (n._sepX == null)  { n._sepX = 0;  n._sepY = 0; }
      if (n._rawX == null)  { n._rawX = 0;  n._rawY = 0; }
      all.push({ n, tree, depth: n._depth || 0 });
    });
  });
  if (all.length === 0) return;

  function swayAmp(depth) {
    if (depth === 0) return (8 + nodeDrift * 22) * windMul;
    const base = (25 + nodeDrift * 75) * windMul;
    const boost = 1 + Math.min(depth - 1, 2) * swayDepth * 0.45;
    return base * boost;
  }

  // 1) raw sway(純 sin/cos)+ sep decay → simDX = raw + sep
  //    ドラッグ中は raw も sep も凍結
  for (const { n, depth } of all) {
    if (n._dragging) {
      n.simDX = (n._rawX || 0) + (n._sepX || 0);
      n.simDY = (n._rawY || 0) + (n._sepY || 0);
      continue;
    }
    const seed = (n.id && n.id.charCodeAt)
      ? (n.id.charCodeAt(0) + (n.id.charCodeAt(1) || 0))
      : 0;
    const ph = seed * 0.17 + (n.text?.length || 0) * 0.11;
    const amp = swayAmp(depth) * fadeIn;
    const rx = Math.sin(t * 0.13 + ph)        * amp
             + Math.sin(t * 0.063 + ph * 1.7) * amp * 0.4;
    const ry = Math.cos(t * 0.105 + ph * 1.3) * amp
             + Math.cos(t * 0.048 + ph * 0.9) * amp * 0.35;
    n._rawX = rx; n._rawY = ry;
    n._sepX *= CFG.SEP_DECAY;
    n._sepY *= CFG.SEP_DECAY;
    n.simDX = rx + n._sepX;
    n.simDY = ry + n._sepY;
  }

  // 2) ノード同士の hard separation(push は fadeIn でスケール — 初回スナップ抑制)
  for (let iter = 0; iter < CFG.ITER; iter++) {
    for (let i = 0; i < all.length; i++) {
      const a = all[i].n;
      if (a._x == null) continue;
      const ra = a._r || CFG.FALLBACK_R;
      const arx = a._restX != null ? a._restX : (a._x - (a.simDX || 0));
      const ary = a._restY != null ? a._restY : (a._y - (a.simDY || 0));
      const ax = arx + a.simDX, ay = ary + a.simDY;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j].n;
        const rb = b._r || CFG.FALLBACK_R;
        const minD = (ra + rb) * CFG.BUFFER;
        const brx = b._restX != null ? b._restX : (b._x - (b.simDX || 0));
        const bry = b._restY != null ? b._restY : (b._y - (b.simDY || 0));
        const bx = brx + b.simDX, by = bry + b.simDY;
        const dx = bx - ax, dy = by - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = Math.min(CFG.PUSH_CAP, (minD - d) / 2) * fadeIn;
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) {
          a._sepX -= ux * push; a._sepY -= uy * push;
          a.simDX -= ux * push; a.simDY -= uy * push;
        }
        if (!b._dragging) {
          b._sepX += ux * push; b._sepY += uy * push;
          b.simDX += ux * push; b.simDY += uy * push;
        }
      }
    }
  }

  // 3) ノード vs 他樹の幹(= cross-type, push も fadeIn でスケール)
  for (let iter = 0; iter < CFG.ITER; iter++) {
    for (let i = 0; i < all.length; i++) {
      const a = all[i].n;
      const aTree = all[i].tree;
      if (a._x == null) continue;
      const ra = a._r || CFG.FALLBACK_R;
      const arx = a._restX != null ? a._restX : (a._x - (a.simDX || 0));
      const ary = a._restY != null ? a._restY : (a._y - (a.simDY || 0));
      const ax = arx + a.simDX, ay = ary + a.simDY;
      for (const tree of trees) {
        if (tree === aTree) continue; // 自樹の幹は除外
        const rb = trunkRadiusFor(tree, 1, design || undefined);
        const minD = (ra + rb) * CFG.BUFFER;
        const bx = tree._displayX ?? tree.x;
        const by = tree._displayY ?? tree.y;
        const dx = bx - ax, dy = by - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = Math.min(CFG.PUSH_CAP, minD - d) * fadeIn;
        const ux = dx / d, uy = dy / d;
        if (!a._dragging) {
          a._sepX -= ux * push; a._sepY -= uy * push;
          a.simDX -= ux * push; a.simDY -= uy * push;
        }
      }
    }
  }

  // 4) 絶対上限(暴走ガード)
  for (const { n } of all) {
    if (n.simDX >  CFG.SIM_CAP) n.simDX =  CFG.SIM_CAP;
    if (n.simDX < -CFG.SIM_CAP) n.simDX = -CFG.SIM_CAP;
    if (n.simDY >  CFG.SIM_CAP) n.simDY =  CFG.SIM_CAP;
    if (n.simDY < -CFG.SIM_CAP) n.simDY = -CFG.SIM_CAP;
    if (n._sepX >  CFG.SIM_CAP) n._sepX =  CFG.SIM_CAP;
    if (n._sepX < -CFG.SIM_CAP) n._sepX = -CFG.SIM_CAP;
    if (n._sepY >  CFG.SIM_CAP) n._sepY =  CFG.SIM_CAP;
    if (n._sepY < -CFG.SIM_CAP) n._sepY = -CFG.SIM_CAP;
  }
}

// 互換のため残す(no-op)
export function impulseFor() {}
export function ripple() {}
