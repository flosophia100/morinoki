import { seededRandom, stringHash } from './utils.js';

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
// 中心から周囲へ曲線で放射。先細りで尖る(先端ドットなし)。
// 2層: (a) 密な近接曲線 + (b) 外周ギザギザ長曲線
export function drawRadialBurst(ctx, cx, cy, baseR, seed, col, strokeCol, opts = {}) {
  const { density = 1.0, jitter = 0.8 } = opts;
  ctx.save();
  const strokeDark = strokeCol || col;

  // 影(ベース形状の薄い影)
  ctx.save();
  ctx.fillStyle = 'rgba(40, 30, 15, 0.14)';
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 3, baseR * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- (a) 密な近接曲線(約0.35〜0.75r) ---
  const rngMid = seededRandom(Math.max(1, Math.floor(seed) + 53));
  const Nmid = Math.floor((22 + baseR * 0.45) * density);
  for (let i = 0; i < Nmid; i++) {
    const a = (Math.PI * 2 * i) / Nmid + (rngMid() - 0.5) * 0.3;
    const len = baseR * (0.45 + rngMid() * 0.3);
    const bend = (rngMid() * 2 - 1) * len * 0.18 * jitter;
    const alpha = 0.5 + rngMid() * 0.4;
    const wBase = 2.2 + rngMid() * 1.2;
    const wTip = 0.5 + rngMid() * 0.4;
    strokeTaperedRadial(ctx, cx, cy, a, len, bend, col, alpha, wBase, wTip);
  }

  // --- (b) 外周に突き出すギザギザ長曲線 ---
  const rngOut = seededRandom(Math.max(1, Math.floor(seed) + 113));
  const Nout = Math.floor((14 + baseR * 0.28) * density);
  for (let i = 0; i < Nout; i++) {
    const a = (Math.PI * 2 * i) / Nout + (rngOut() - 0.5) * 0.3;
    const spike = rngOut() < 0.38;
    const len = baseR * (spike ? (0.95 + rngOut() * 0.5) : (0.7 + rngOut() * 0.25));
    const bend = (rngOut() * 2 - 1) * len * 0.22 * jitter;
    const alpha = spike ? (0.75 + rngOut() * 0.2) : (0.55 + rngOut() * 0.35);
    const wBase = spike ? (2.6 + rngOut() * 1.4) : (1.8 + rngOut() * 1.0);
    const wTip = 0.45 + rngOut() * 0.35;
    strokeTaperedRadial(ctx, cx, cy, a, len, bend, spike ? strokeDark : col, alpha, wBase, wTip);
  }
  ctx.globalAlpha = 1;

  // 中心のアンカー(濃い小円):根元の密集感
  ctx.fillStyle = strokeDark;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(2, baseR * 0.15), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ====== 連結線(蛇行する枝) ======
// 3次ベジェで perpendicular にランダムオフセット
// 太さはテーパー(幹側太、先端細)
export function drawMeanderingBranch(ctx, x1, y1, x2, y2, w1, w2, seed, color) {
  const rng = seededRandom(Math.max(1, Math.floor(seed)));
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const perpX = -dy / dist, perpY = dx / dist;

  // 2つの制御点:1/3と2/3地点で、垂直方向に揺らぎ
  const amp = dist * 0.22;
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

export function computeAllPositions(tree, cx, cy, scale = 1.0) {
  const rng = seededRandom(Number(tree.seed) || 1);
  const hierarchy = buildHierarchy(tree.nodes || []);
  const out = [];

  function walk(parentId, px, py, centerAngle, sector, depth) {
    const children = hierarchy.get(parentId) || [];
    const n = children.length;
    children.forEach((child, i) => {
      let a;
      if (depth === 0) {
        a = (Math.PI * 2 * i) / Math.max(1, n) - Math.PI / 2;
      } else {
        a = centerAngle + (i - (n - 1) / 2) * (sector / Math.max(1, n));
      }
      a += (rng() - 0.5) * (depth === 0 ? 0.25 : 0.2);

      const baseLen = (depth === 0 ? 108 : 72) * scale;
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
      const nr = (18 + (child.size || 3) * 5.0) * scale * sizeScale;

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

export function trunkRadiusFor(tree, scale = 1.0) {
  const name = tree.name || '';
  const base = Math.max(38, Math.min(72, 34 + name.length * 7));
  return base * scale;
}

export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { isSelf = false } = opts;
  const positions = computeAllPositions(tree, cx, cy, scale);
  const trunkR = trunkRadiusFor(tree, scale);
  const seed = Number(tree.seed) || stringHash(tree.name || 'x');

  // 自分の樹の光の輪(背後)
  if (isSelf) {
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.fillStyle = `rgba(196, 154, 62, ${0.06 * i})`;
      ctx.beginPath();
      ctx.arc(cx, cy, trunkR + 14 * i, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 枝(蛇行する曲線)
  positions.forEach((p, idx) => {
    const depthBoost = p.depth === 0 ? 1.0 : 0.72;
    const wStart = Math.max(1.6, 5.2 * scale * depthBoost);
    const wEnd = Math.max(0.9, 1.4 * scale * depthBoost);
    const branchSeed = stringHash((p.node.id || '') + ':' + idx);
    drawMeanderingBranch(
      ctx, p.parentX, p.parentY, p.x, p.y,
      wStart, wEnd, branchSeed,
      p.depth === 0 ? 'rgba(107, 74, 43, 0.85)' : 'rgba(139, 106, 74, 0.75)'
    );
  });

  // 葉ノード(放射状バースト)
  positions.forEach(p => {
    const n = p.node;
    const nSeed = stringHash(n.id || n.text || 'node');
    const col = n.color || '#5a6b3e';
    const strokeCol = darken(col, 0.4);
    drawRadialBurst(ctx, p.x, p.y, p.nr, nSeed, col, strokeCol, {
      density: 1.1, jitter: 0.7, dots: true
    });

    if (n.description) {
      ctx.save();
      ctx.fillStyle = 'rgba(196, 154, 62, 0.95)';
      ctx.beginPath();
      ctx.arc(p.x + p.nr * 0.7, p.y - p.nr * 0.7, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (p.nr >= 20 * scale) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 252, 244, 0.92)';
      ctx.font = `${Math.max(11, p.nr * 0.42)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // 中央に少し背景つける(可読性のため)
      const tw = ctx.measureText(n.text).width;
      ctx.fillStyle = 'rgba(244, 237, 224, 0.55)';
      ctx.fillRect(p.x - tw/2 - 2, p.y - 7, tw + 4, 14);
      ctx.fillStyle = 'rgba(58, 72, 40, 0.95)';
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
      const bgX = isRight ? p.x + pad - 1 : p.x + pad - tw - 3;
      ctx.fillStyle = 'rgba(244, 237, 224, 0.72)';
      ctx.fillRect(bgX, p.y - 7, tw + 4, 14);
      ctx.fillStyle = 'rgba(58, 72, 40, 0.95)';
      ctx.fillText(n.text, p.x + pad, p.y);
      ctx.restore();
    }

    n._x = p.x; n._y = p.y; n._r = p.nr;
    n._parentX = p.parentX; n._parentY = p.parentY;
    n._depth = p.depth;
  });

  // ====== 幹(大きな放射状バースト + 名前) ======
  const trunkCol = isSelf ? '#b98a3e' : '#4f6236';
  const trunkStroke = isSelf ? '#8c651f' : '#2f3e22';
  drawRadialBurst(ctx, cx, cy, trunkR, seed * 7, trunkCol, trunkStroke, {
    density: 1.3, jitter: 0.6, dots: true
  });

  // 名前(中央、小さな背景つき)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = tree.name || '';
  let fs = Math.max(13 * scale, trunkR * 0.32);
  ctx.font = `${fs}px 'Shippori Mincho', serif`;
  while (ctx.measureText(name).width > trunkR * 1.3 && fs > 10 * scale) {
    fs -= 0.5;
    ctx.font = `${fs}px 'Shippori Mincho', serif`;
  }
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = isSelf ? 'rgba(255, 248, 220, 0.82)' : 'rgba(31, 26, 21, 0.6)';
  ctx.fillRect(cx - tw/2 - 6, cy - fs/2 - 3, tw + 12, fs + 6);
  ctx.fillStyle = isSelf ? '#3a2d0a' : '#f4ede0';
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
