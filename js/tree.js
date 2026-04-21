import { seededRandom, stringHash } from './utils.js';
import { DEFAULTS as DESIGN_DEFAULTS } from './designconfig.js';

// 1本の放射曲線を先太・先細で描く(2ストロークで軽量)
// 1. 全長を細めで引く(先端)  2. 基部40%だけ太く上書き
function strokeTaperedRadial(ctx, cx, cy, a, len, bend, col, alpha, wBase, wTip) {
  const x2 = cx + Math.cos(a) * len;
  const y2 = cy + Math.sin(a) * len;
  const nx = -Math.sin(a), ny = Math.cos(a);
  const mx = cx + Math.cos(a) * len * 0.5 + nx * bend;
  const my = cy + Math.sin(a) * len * 0.5 + ny * bend;

  ctx.strokeStyle = col;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';

  // 1) 全長を細めで(先端)
  ctx.lineWidth = Math.max(0.4, wTip);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();

  // 2) 基部40%を太く上書き
  const t = 0.4;
  const tMt = 1 - t;
  const px = tMt * tMt * cx + 2 * tMt * t * mx + t * t * x2;
  const py = tMt * tMt * cy + 2 * tMt * t * my + t * t * y2;
  ctx.lineWidth = Math.max(0.6, wBase);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(cx + (mx - cx) * t, cy + (my - cy) * t, px, py);
  ctx.stroke();
}

// ====== 放射状バースト(ノード・幹共通) ======
// 葉の密集 (foliage) を主役に、放射線は控えめな脈として補助
export function drawRadialBurst(ctx, cx, cy, baseR, seed, col, strokeCol, opts = {}) {
  const design = opts.design || DESIGN_DEFAULTS;
  const foliage = typeof design.foliage === 'number' ? design.foliage : 0.75;
  const density = (opts.densityMul || 1.0) * (0.6 + design.density * 1.2);
  const jitter = 0.2 + design.bend * 1.2;
  const lenVar = design.lengthVar;
  const spikeChance = design.spikeChance;
  const spikeLen = 0.9 + design.spikeLen * 0.7;

  ctx.save();
  const strokeDark = strokeCol || col;

  // 影
  ctx.save();
  ctx.fillStyle = 'rgba(40, 30, 15, 0.14)';
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 3, baseR * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ==== (A) 葉の密集: 多数の小円を重ねる ====
  // 3層のアルファバケット(0.22/0.40/0.58)に仕分けてバッチ描画(state-change 削減)
  const rngLeaf = seededRandom(Math.max(1, Math.floor(seed) + 29));
  const Nleaf = Math.floor((55 + baseR * 1.6) * (0.3 + foliage * 1.7));
  const leaves = [[], [], []];
  for (let i = 0; i < Nleaf; i++) {
    const bucket = Math.floor(rngLeaf() * 3);
    // r の分布: 中心寄りに重みをつける(rng^0.6)
    const rr = Math.pow(rngLeaf(), 0.6) * baseR * 0.95;
    const theta = rngLeaf() * Math.PI * 2;
    const leafR = 3.2 + rngLeaf() * (baseR * 0.14);
    leaves[bucket].push({
      x: cx + Math.cos(theta) * rr,
      y: cy + Math.sin(theta) * rr,
      r: leafR
    });
  }
  ctx.fillStyle = col;
  for (let b = 0; b < 3; b++) {
    const group = leaves[b];
    if (!group.length) continue;
    ctx.globalAlpha = 0.22 + b * 0.18;
    ctx.beginPath();
    for (const l of group) {
      ctx.moveTo(l.x + l.r, l.y);
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ==== (B) 微細な陰影(暗色)を散らしてテクスチャ化 ====
  const rngShade = seededRandom(Math.max(1, Math.floor(seed) + 83));
  const Nshade = Math.floor((18 + baseR * 0.5) * (0.3 + foliage * 1.2));
  ctx.fillStyle = strokeDark;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  for (let i = 0; i < Nshade; i++) {
    const rr = Math.pow(rngShade(), 0.5) * baseR * 0.9;
    const theta = rngShade() * Math.PI * 2;
    const sx = cx + Math.cos(theta) * rr;
    const sy = cy + Math.sin(theta) * rr;
    const sr = 1.6 + rngShade() * 3;
    ctx.moveTo(sx + sr, sy);
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.globalAlpha = 1;

  // ==== (C) 控えめな放射線(葉脈感) ====
  const rngMid = seededRandom(Math.max(1, Math.floor(seed) + 53));
  const Nmid = Math.floor((10 + baseR * 0.2) * density);
  for (let i = 0; i < Nmid; i++) {
    const a = (Math.PI * 2 * i) / Nmid + (rngMid() - 0.5) * 0.35;
    const len = baseR * (0.65 + rngMid() * lenVar * 0.3);
    const bend = (rngMid() * 2 - 1) * len * 0.22 * jitter;
    const alpha = 0.25 + rngMid() * 0.25;
    const wBase = 1.2 + rngMid() * 0.8;
    const wTip = 0.35 + rngMid() * 0.25;
    strokeTaperedRadial(ctx, cx, cy, a, len, bend, strokeDark, alpha, wBase, wTip);
  }

  // ==== (D) 外周の小葉(ジャギー縁) ====
  const rngEdge = seededRandom(Math.max(1, Math.floor(seed) + 211));
  const Nedge = Math.floor((22 + baseR * 0.45) * (0.5 + foliage * 1.3));
  const edges = [];
  for (let i = 0; i < Nedge; i++) {
    const a = (Math.PI * 2 * i) / Nedge + (rngEdge() - 0.5) * 0.35;
    const spike = rngEdge() < spikeChance;
    const r_base = baseR * (spike
      ? (spikeLen + rngEdge() * lenVar * 0.2)
      : (0.90 + rngEdge() * lenVar * 0.12));
    edges.push({
      x: cx + Math.cos(a) * r_base,
      y: cy + Math.sin(a) * r_base,
      r: spike ? (4 + rngEdge() * 5) : (2.6 + rngEdge() * 3.5),
      dark: spike,
    });
  }
  // 明るい葉色
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  for (const e of edges) { if (e.dark) continue; ctx.moveTo(e.x + e.r, e.y); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); }
  ctx.fill();
  // スパイク=暗色アクセント
  ctx.fillStyle = strokeDark;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (const e of edges) { if (!e.dark) continue; ctx.moveTo(e.x + e.r, e.y); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); }
  ctx.fill();
  ctx.globalAlpha = 1;

  // 中心のソリッド色円 — 左パネルのカラードットと視覚的に一致させる
  //   これがあることで、アトモスフィア背景とのアルファ合成で暗く見える問題を解消
  ctx.fillStyle = col;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(3, baseR * 0.38), 0, Math.PI * 2);
  ctx.fill();

  // 中心アンカー(ほんの小さな陰)
  ctx.fillStyle = strokeDark;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.5, baseR * 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ====== 連結線(蛇行する枝) ======
// 3次ベジェで perpendicular にランダムオフセット
// 太さはテーパー(幹側太、先端細)
// opts.meander: 0..1 で蛇行の振幅倍率(0.0=ほぼ直線, 1.0=大きく蛇行)
export function drawMeanderingBranch(ctx, x1, y1, x2, y2, w1, w2, seed, color, opts = {}) {
  const meander = typeof opts.meander === 'number' ? opts.meander : 0.5;
  const rng = seededRandom(Math.max(1, Math.floor(seed)));
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist, perpY = dx / dist;

  // 2つの制御点:1/3と2/3地点で、垂直方向に揺らぎ
  // meander 0..1 を 0.04..0.38 の振幅比にマップ
  const amp = dist * (0.04 + meander * 0.34);
  const off1 = (rng() * 2 - 1) * amp;
  const off2 = (rng() * 2 - 1) * amp;
  // 接線方向の揺らぎも少し入れる(前後に伸縮)
  const drift1 = (rng() * 2 - 1) * dist * 0.08;
  const drift2 = (rng() * 2 - 1) * dist * 0.08;
  const c1x = x1 + dx * (0.33 + drift1 / dist) + perpX * off1;
  const c1y = y1 + dy * (0.33 + drift1 / dist) + perpY * off1;
  const c2x = x1 + dx * (0.67 + drift2 / dist) + perpX * off2;
  const c2y = y1 + dy * (0.67 + drift2 / dist) + perpY * off2;

  const N = 18;
  const pts = [], tangs = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const x = mt*mt*mt*x1 + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*x2;
    const y = mt*mt*mt*y1 + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*y2;
    const dxb = 3*mt*mt*(c1x-x1) + 6*mt*t*(c2x-c1x) + 3*t*t*(x2-c2x);
    const dyb = 3*mt*mt*(c1y-y1) + 6*mt*t*(c2y-c1y) + 3*t*t*(y2-c2y);
    pts.push([x, y]);
    tangs.push([dxb, dyb]);
  }

  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ease = 1 - (1 - t) * (1 - t); // easeOutQuad
    const w = w1 + (w2 - w1) * ease;
    const [dxT, dyT] = tangs[i];
    const len = Math.hypot(dxT, dyT) || 1;
    const nx = -dyT / len, ny = dxT / len;
    left.push([pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2]);
    right.push([pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2]);
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
}

// ====== 構造: parent_id でネストされた nodes をツリー化 ======
function buildHierarchy(nodes) {
  const byParent = new Map();
  (nodes || []).forEach(n => {
    const p = n.parent_id || null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n);
  });
  byParent.forEach(arr => arr.sort((a, b) => (a.ord || 0) - (b.ord || 0)));
  return byParent;
}

export function computeAllPositions(tree, cx, cy, scale = 1.0, design = DESIGN_DEFAULTS) {
  const rng = seededRandom(Number(tree.seed) || 1);
  const hierarchy = buildHierarchy(tree.nodes || []);
  const out = [];
  // design.nodeSize (0..1) を 0.7..1.35 倍にマップ(0.5が中立)
  const nodeSizeMul = 0.7 + design.nodeSize * 0.65;

  function walk(parentId, px, py, centerAngle, sector, depth) {
    const children = hierarchy.get(parentId) || [];
    const n = children.length;
    // 兄弟の最大表示半径 (roughly) を見積もり、円周が足りるよう baseLen を広げる
    // child 半径 ≈ (18 + size*5) * scale * (depth===0 ? 1 : 0.92) * nodeSizeMul
    const sizeScale = depth === 0 ? 1 : 0.92;
    const maxChildR = children.reduce((mx, c) => {
      const r = (18 + (c.size || 3) * 5.0) * scale * sizeScale * nodeSizeMul;
      return r > mx ? r : mx;
    }, 0);
    // 必要な半径 = 兄弟数 * 2 * r * 1.15 / (2π) ≈ n * r * 0.366
    // 扇形配置(depth≥1)は sector/(2π) の割合しか使わないので割る
    const arcFrac = depth === 0 ? 1 : (sector / (Math.PI * 2));
    const requiredLen = n > 1
      ? (n * maxChildR * 2.3) / (Math.PI * 2 * arcFrac)
      : 0;
    const defaultLen = (depth === 0 ? 108 : 72) * scale;
    const baseLen = Math.max(defaultLen, requiredLen);
    children.forEach((child, i) => {
      let a;
      if (depth === 0) {
        a = (Math.PI * 2 * i) / Math.max(1, n) - Math.PI / 2;
      } else {
        a = centerAngle + (i - (n - 1) / 2) * (sector / Math.max(1, n));
      }
      a += (rng() - 0.5) * (depth === 0 ? 0.25 : 0.2);

      const sizeFactor = 0.85 + (child.size || 3) * 0.05;
      const len = baseLen * sizeFactor * (0.9 + rng() * 0.3);

      let ex, ey;
      if (child.offset_x != null && child.offset_y != null) {
        ex = px + Number(child.offset_x) * scale;
        ey = py + Number(child.offset_y) * scale;
      } else {
        ex = px + Math.cos(a) * len;
        ey = py + Math.sin(a) * len;
      }
      child._restX = ex; child._restY = ey;
      if (child.simDX != null) ex += child.simDX;
      if (child.simDY != null) ey += child.simDY;

      // 葉ノードも十分な存在感を持つよう大きめに
      const sizeScale = depth === 0 ? 1 : 0.92;
      const nr = (18 + (child.size || 3) * 5.0) * scale * sizeScale * nodeSizeMul;

      out.push({
        node: child, x: ex, y: ey,
        parentX: px, parentY: py, parentId,
        depth, nr, angle: a
      });

      walk(child.id, ex, ey, a, Math.PI * 0.8, depth + 1);
    });
  }
  walk(null, cx, cy, -Math.PI / 2, Math.PI * 2, 0);
  return out;
}

// 幹の大きさは名前の長さに関わらず一定。design.trunkSize (0..1) で ×0.7〜×1.35
export const TRUNK_BASE_R = 54;
export function trunkRadiusFor(tree, scale = 1.0, design = DESIGN_DEFAULTS) {
  const trunkMul = 0.7 + design.trunkSize * 0.65;
  return TRUNK_BASE_R * scale * trunkMul;
}

// 幹の色を isSelf で返す(新規ノードの初期色にも使う)
//   自分の幹: 緑(#5a9b6e)
//   他人の幹: 中性セージ(#6f8a7d)
export function trunkColorFor(isSelf) {
  return isSelf ? '#5a9b6e' : '#6f8a7d';
}

// hex → rgba 文字列。外縁の発光リング生成に使う。
function hexToRgba(hex, alpha) {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 発光リング(外縁を光らせる)
//   3層の同心円をアルファ弱めで重ねる。n._r または trunkR の外側に広がる。
export function drawGlow(ctx, cx, cy, baseR, color) {
  ctx.save();
  for (let i = 3; i >= 1; i--) {
    ctx.fillStyle = hexToRgba(color, 0.1 * i);
    ctx.beginPath();
    ctx.arc(cx, cy, baseR + 5 * i, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { isSelf = false } = opts;
  const design = opts.design || DESIGN_DEFAULTS;
  const positions = computeAllPositions(tree, cx, cy, scale, design);
  const trunkR = trunkRadiusFor(tree, scale, design);
  const seed = Number(tree.seed) || stringHash(tree.name || 'x');
  // design.branchThickness (0..1) → 0.5..1.6 倍
  const branchMul = 0.5 + design.branchThickness * 1.1;

  // 自分の幹は緑の発光リング(背後)
  if (isSelf) {
    const glowCol = '#5a9b6e';
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      const r = 90 + (i - 1) * 0;  // 色は固定、アルファだけ変える
      void r;
      ctx.fillStyle = `rgba(90, 155, 110, ${0.10 * i})`;
      ctx.beginPath();
      ctx.arc(cx, cy, trunkR + 14 * i, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    void glowCol;
  }

  // 枝(蛇行する曲線)
  positions.forEach((p, idx) => {
    const depthBoost = p.depth === 0 ? 1.0 : 0.72;
    const wStart = Math.max(1.6, 5.2 * scale * depthBoost * branchMul);
    const wEnd = Math.max(0.9, 1.4 * scale * depthBoost * branchMul);
    const branchSeed = stringHash((p.node.id || '') + ':' + idx);
    drawMeanderingBranch(
      ctx, p.parentX, p.parentY, p.x, p.y,
      wStart, wEnd, branchSeed,
      p.depth === 0 ? 'rgba(122, 108, 92, 0.85)' : 'rgba(157, 137, 114, 0.72)',
      { meander: design.branchMeander }
    );
  });

  // 葉ノード(放射状バースト + 外縁の発光)
  positions.forEach(p => {
    const n = p.node;
    const nSeed = stringHash(n.id || n.text || 'node');
    const col = n.color || '#6f8a7d';
    const strokeCol = darken(col, 0.4);
    // 外縁の発光リング(自分の幹と同様に光らせる)
    drawGlow(ctx, p.x, p.y, p.nr, col);
    drawRadialBurst(ctx, p.x, p.y, p.nr, nSeed, col, strokeCol, {
      densityMul: 1.1, design
    });

    if (n.description) {
      ctx.save();
      ctx.fillStyle = 'rgba(196, 154, 62, 0.95)';
      ctx.beginPath();
      ctx.arc(p.x + p.nr * 0.7, p.y - p.nr * 0.7, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 枝ノードのラベル色は幹と揃える
    const labelBg = isSelf ? 'rgba(234, 248, 228, 0.85)' : 'rgba(31, 26, 21, 0.6)';
    const labelFg = isSelf ? '#14351f' : '#f4ede0';
    if (p.nr >= 20 * scale) {
      ctx.save();
      ctx.font = `${Math.max(11, p.nr * 0.42)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(n.text).width;
      ctx.fillStyle = labelBg;
      ctx.fillRect(p.x - tw/2 - 4, p.y - 9, tw + 8, 18);
      ctx.fillStyle = labelFg;
      ctx.fillText(n.text, p.x, p.y);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `${11 * scale}px 'Klee One', serif`;
      const isRight = Math.cos(Math.atan2(p.y - p.parentY, p.x - p.parentX)) >= 0;
      ctx.textAlign = isRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const pad = (p.nr + 6) * (isRight ? 1 : -1);
      const tw = ctx.measureText(n.text).width;
      const bgX = isRight ? p.x + pad - 2 : p.x + pad - tw - 4;
      ctx.fillStyle = labelBg;
      ctx.fillRect(bgX, p.y - 8, tw + 6, 16);
      ctx.fillStyle = labelFg;
      ctx.fillText(n.text, p.x + pad, p.y);
      ctx.restore();
    }

    n._x = p.x; n._y = p.y; n._r = p.nr;
    n._parentX = p.parentX; n._parentY = p.parentY;
    n._depth = p.depth;
  });

  // ====== 幹(大きな放射状バースト + 名前) ======
  // 自分: 緑 / 他人: 冷たいフィヨルドセージ
  const trunkCol = isSelf ? '#5a9b6e' : '#6f8a7d';
  const trunkStroke = isSelf ? '#2e5a3a' : '#435e52';
  drawRadialBurst(ctx, cx, cy, trunkR, seed * 7, trunkCol, trunkStroke, {
    densityMul: 1.3, design
  });

  // 名前(中央、小さな背景つき)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = tree.name || '';
  let fs = Math.max(16 * scale, trunkR * 0.42);
  ctx.font = `${fs}px 'Shippori Mincho', serif`;
  while (ctx.measureText(name).width > trunkR * 1.35 && fs > 12 * scale) {
    fs -= 0.5;
    ctx.font = `${fs}px 'Shippori Mincho', serif`;
  }
  const tw = ctx.measureText(name).width;
  // ラベルは自分=ダーク文字+明るい背景、他人=淡い文字+暗い背景
  ctx.fillStyle = isSelf ? 'rgba(234, 248, 228, 0.85)' : 'rgba(31, 26, 21, 0.6)';
  ctx.fillRect(cx - tw/2 - 8, cy - fs/2 - 4, tw + 16, fs + 8);
  ctx.fillStyle = isSelf ? '#14351f' : '#f4ede0';
  ctx.fillText(name, cx, cy);
  ctx.restore();

  tree._trunkX = cx;
  tree._trunkY = cy;
  tree._trunkR = trunkR;
  tree._isSelf = isSelf;

  return { trunkR, positions };
}

function darken(hex, f) {
  if (!hex || hex[0] !== '#') return hex || '#333';
  const r = parseInt(hex.slice(1, 3), 16) * (1 - f);
  const g = parseInt(hex.slice(3, 5), 16) * (1 - f);
  const b = parseInt(hex.slice(5, 7), 16) * (1 - f);
  const h = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
