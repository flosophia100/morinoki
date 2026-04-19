import { seededRandom, stringHash } from './utils.js';

// ====== 共通: ギザギザ樹冠ブロブを塗る ======
// 上空視点の canopy 表現:
//   - N 頂点の外周 (16〜24) に seed ベースの半径ノイズを乗せる
//   - quadraticCurveTo でスムーズに繋ぎつつ、ギザギザ感を残す
// cx, cy: 中心
// baseR: ベース半径
// seed: 乱数シード (樹/ノードごとに固定 → 形が安定再現)
// col: 塗り色 / strokeCol: 縁取り色
export function drawCanopyBlob(ctx, cx, cy, baseR, seed, col, strokeCol, strokeW = 1.2) {
  const rng = seededRandom(Math.max(1, Math.floor(seed)));
  const N = 18 + Math.floor(rng() * 6); // 18..23
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (Math.PI * 2 * i) / N;
    // 中層ノイズ + 高周波ゆらぎ
    const r = baseR * (0.78 + rng() * 0.36) * (0.95 + Math.sin(a * (3 + rng() * 3)) * 0.08);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  // 影(下にずれた同形のダーク)
  ctx.save();
  ctx.fillStyle = 'rgba(60, 50, 30, 0.15)';
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], nx = pts[(i + 1) % N];
    const mx = (p.x + nx.x) / 2 + 2, my = (p.y + nx.y) / 2 + 3;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p.x + 2, p.y + 3, mx, my);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 本体
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], nx = pts[(i + 1) % N];
    const mx = (p.x + nx.x) / 2, my = (p.y + nx.y) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p.x, p.y, mx, my);
  }
  ctx.closePath();
  ctx.fill();
  if (strokeCol && strokeW > 0) {
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = strokeW;
    ctx.stroke();
  }

  return { pts, N };
}

// ====== テーパード枝(polygon塗りで幅変化) ======
export function drawTaperedBranch(ctx, x1, y1, cx, cy, x2, y2, w1, w2, color) {
  const N = 14;
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2;
    // 接線の法線
    const dxT = 2 * (1 - t) * (cx - x1) + 2 * t * (x2 - cx);
    const dyT = 2 * (1 - t) * (cy - y1) + 2 * t * (y2 - cy);
    const len = Math.hypot(dxT, dyT) || 1;
    const nx = -dyT / len, ny = dxT / len;
    // なめらかに先細り(ease)
    const tt = 1 - (1 - t) * (1 - t); // easeOutQuad
    const w = w1 + (w2 - w1) * tt;
    left.push([x + nx * w / 2, y + ny * w / 2]);
    right.push([x - nx * w / 2, y - ny * w / 2]);
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

// ====== 位置計算(幹 → 子 → 孫… 再帰、offsetあれば優先、simDX/DYがあれば加算) ======
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

      const baseLen = (depth === 0 ? 96 : 64) * scale;
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

      const sizeScale = depth === 0 ? 1 : 0.78;
      const nr = (10 + (child.size || 3) * 3.4) * scale * sizeScale;

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

// ====== 幹のサイズ ======
export function trunkRadiusFor(tree, scale = 1.0) {
  const name = tree.name || '';
  const base = Math.max(34, Math.min(62, 30 + name.length * 6));
  return base * scale;
}

// ====== 樹の描画 ======
export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { isSelf = false } = opts;
  const positions = computeAllPositions(tree, cx, cy, scale);
  const trunkR = trunkRadiusFor(tree, scale);
  const seed = Number(tree.seed) || stringHash(tree.name || 'x');

  // 自分の樹の光の輪(背後)
  if (isSelf) {
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.fillStyle = `rgba(196, 154, 62, ${0.05 * i})`;
      ctx.beginPath();
      ctx.arc(cx, cy, trunkR + 12 * i, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 枝(幹 or 親ノード から 子へ、テーパー)
  positions.forEach(p => {
    const depthBoost = p.depth === 0 ? 1.0 : 0.7;
    const wStart = Math.max(1.6, 4.8 * scale * depthBoost);
    const wEnd = Math.max(0.9, 1.6 * scale * depthBoost);
    const dx = p.x - p.parentX, dy = p.y - p.parentY;
    const dist = Math.hypot(dx, dy) || 1;
    const perpX = -dy / dist, perpY = dx / dist;
    const sway = (p.node.offset_x != null) ? 0 : dist * 0.1;
    const mx = (p.parentX + p.x) / 2 + perpX * sway;
    const my = (p.parentY + p.y) / 2 + perpY * sway;
    drawTaperedBranch(ctx, p.parentX, p.parentY, mx, my, p.x, p.y,
      wStart, wEnd,
      p.depth === 0 ? 'rgba(107, 74, 43, 0.85)' : 'rgba(139, 106, 74, 0.75)');
  });

  // 葉ノード(ミニ樹冠)
  positions.forEach(p => {
    const n = p.node;
    const nSeed = stringHash(n.id || n.text || 'node');
    const col = n.color || '#5a6b3e';
    const strokeCol = darken(col, 0.35);
    drawCanopyBlob(ctx, p.x, p.y, p.nr, nSeed, col, strokeCol, 0.9);

    // 説明マーク(右上に小さなドット)
    if (n.description) {
      ctx.save();
      ctx.fillStyle = 'rgba(196, 154, 62, 0.95)';
      ctx.beginPath();
      ctx.arc(p.x + p.nr * 0.65, p.y - p.nr * 0.65, 2.8 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ラベル: ノードが大きいなら中央、小さいなら外側
    if (p.nr >= 14 * scale) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 252, 244, 0.95)';
      ctx.font = `${Math.max(10, p.nr * 0.55)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.text, p.x, p.y);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `${11 * scale}px 'Klee One', serif`;
      const isRight = Math.cos(Math.atan2(p.y - p.parentY, p.x - p.parentX)) >= 0;
      ctx.textAlign = isRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const pad = (p.nr + 5) * (isRight ? 1 : -1);
      const tw = ctx.measureText(n.text).width;
      const bgX = isRight ? p.x + pad - 1 : p.x + pad - tw - 3;
      ctx.fillStyle = 'rgba(244, 237, 224, 0.72)';
      ctx.fillRect(bgX, p.y - 7, tw + 4, 14);
      ctx.fillStyle = 'rgba(58, 72, 40, 0.95)';
      ctx.fillText(n.text, p.x + pad, p.y);
      ctx.restore();
    }

    // ヒットテスト用
    n._x = p.x; n._y = p.y; n._r = p.nr;
    n._parentX = p.parentX; n._parentY = p.parentY;
    n._depth = p.depth;
  });

  // ====== 幹(大きな樹冠ブロブ + 名前) ======
  // 幹は自分の樹なら金色ベース、他は苔緑ベース
  const trunkCol = isSelf ? '#b98a3e' : '#4f6236';
  const trunkStroke = isSelf ? '#8c651f' : '#2f3e22';
  drawCanopyBlob(ctx, cx, cy, trunkR, seed * 7, trunkCol, trunkStroke, isSelf ? 2.2 * scale : 1.6 * scale);

  // 名前(中央)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = tree.name || '';
  let fs = Math.max(12 * scale, trunkR * 0.36);
  ctx.font = `${fs}px 'Shippori Mincho', serif`;
  while (ctx.measureText(name).width > trunkR * 1.5 && fs > 10 * scale) {
    fs -= 0.5;
    ctx.font = `${fs}px 'Shippori Mincho', serif`;
  }
  ctx.fillStyle = isSelf ? '#2a1d08' : '#f4ede0';
  ctx.fillText(name, cx, cy);
  ctx.restore();

  // ヒットテスト用
  tree._trunkX = cx;
  tree._trunkY = cy;
  tree._trunkR = trunkR;
  tree._isSelf = isSelf;

  return { trunkR, positions };
}

// ------ 色ユーティリティ ------
function darken(hex, f) {
  if (!hex || hex[0] !== '#') return hex || '#333';
  const r = parseInt(hex.slice(1, 3), 16) * (1 - f);
  const g = parseInt(hex.slice(3, 5), 16) * (1 - f);
  const b = parseInt(hex.slice(5, 7), 16) * (1 - f);
  const h = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
