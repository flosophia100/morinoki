import { seededRandom } from './utils.js';

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

// ====== 位置計算(幹 → 子 → 孫… 再帰、offsetあればそれを優先) ======
export function computeAllPositions(tree, cx, cy, scale = 1.0) {
  const rng = seededRandom(Number(tree.seed) || 1);
  const hierarchy = buildHierarchy(tree.nodes || []);
  const out = []; // { node, x, y, parentX, parentY, parentId, depth, nr, angle }

  function walk(parentId, px, py, centerAngle, sector, depth) {
    const children = hierarchy.get(parentId) || [];
    const n = children.length;
    children.forEach((child, i) => {
      // デフォルト角度
      let a;
      if (depth === 0) {
        a = (Math.PI * 2 * i) / Math.max(1, n) - Math.PI / 2;
      } else {
        a = centerAngle + (i - (n - 1) / 2) * (sector / Math.max(1, n));
      }
      a += (rng() - 0.5) * (depth === 0 ? 0.25 : 0.2);

      const baseLen = (depth === 0 ? 82 : 56) * scale;
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

      const sizeScale = depth === 0 ? 1 : 0.78;
      const nr = (5 + (child.size || 3) * 2) * scale * sizeScale;

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

// ====== 幹のサイズ(中央円 + テキスト内包) ======
export function trunkRadiusFor(tree, scale = 1.0) {
  const name = tree.name || '';
  // 文字数が多いほど大きく(ただし上限あり)
  const base = Math.max(26, Math.min(48, 22 + name.length * 5));
  return base * scale;
}

// ====== 描画 ======
export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { isSelf = false } = opts;
  const positions = computeAllPositions(tree, cx, cy, scale);
  const trunkR = trunkRadiusFor(tree, scale);

  // 自分の樹の強調背景(光の輪)
  if (isSelf) {
    for (let i = 3; i >= 1; i--) {
      ctx.save();
      ctx.fillStyle = `rgba(196, 154, 62, ${0.04 * i})`;
      ctx.beginPath();
      ctx.arc(cx, cy, trunkR + 8 * i, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 地面の影
  ctx.save();
  ctx.fillStyle = 'rgba(90, 70, 40, 0.18)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 3, trunkR * 1.05, trunkR * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 枝(親→子 の曲線)を先にまとめて
  positions.forEach(p => {
    ctx.save();
    const baseColor = p.depth === 0 ? 'rgba(107, 74, 43, 0.78)' : 'rgba(139, 106, 74, 0.68)';
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = Math.max(1.0, (p.depth === 0 ? 2.0 : 1.2)) * scale;
    ctx.lineCap = 'round';
    const dx = p.x - p.parentX, dy = p.y - p.parentY;
    const dist = Math.hypot(dx, dy) || 1;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    // offsetが明示設定の場合はまっすぐ、seed配置はほんのりしならせる
    const sway = (p.node.offset_x != null) ? 0 : dist * 0.09;
    const mx = (p.parentX + p.x) / 2 + perpX * sway;
    const my = (p.parentY + p.y) / 2 + perpY * sway;
    ctx.beginPath();
    ctx.moveTo(p.parentX, p.parentY);
    ctx.quadraticCurveTo(mx, my, p.x, p.y);
    ctx.stroke();
    ctx.restore();
  });

  // 葉ノード
  positions.forEach(p => {
    const n = p.node;
    // 影
    ctx.save();
    ctx.fillStyle = 'rgba(58, 72, 40, 0.14)';
    ctx.beginPath();
    ctx.arc(p.x + 1, p.y + 1.5, p.nr + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 本体
    ctx.fillStyle = n.color || '#5a6b3e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.nr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31, 26, 21, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 説明マーク
    if (n.description) {
      ctx.fillStyle = 'rgba(196, 154, 62, 0.95)';
      ctx.beginPath();
      ctx.arc(p.x + p.nr * 0.65, p.y - p.nr * 0.65, 2.3 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // ラベル
    if (p.nr >= 10 * scale) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 252, 244, 0.95)';
      ctx.font = `${Math.max(9, p.nr * 0.8)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.text, p.x, p.y);
      ctx.restore();
    } else {
      // ノード外側にラベル
      ctx.save();
      ctx.font = `${10.5 * scale}px 'Klee One', serif`;
      const isRight = Math.cos(Math.atan2(p.y - p.parentY, p.x - p.parentX)) >= 0;
      ctx.textAlign = isRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const pad = (p.nr + 4) * (isRight ? 1 : -1);
      const tw = ctx.measureText(n.text).width;
      const bgX = isRight ? p.x + pad - 1 : p.x + pad - tw - 3;
      ctx.fillStyle = 'rgba(244, 237, 224, 0.7)';
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

  // ====== 幹(大きな円 + 中央にテキスト) ======
  // 外側のぼかし
  ctx.save();
  ctx.fillStyle = isSelf ? 'rgba(196, 154, 62, 0.35)' : 'rgba(107, 74, 43, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, trunkR + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 幹本体 — 自分の樹はgoldアクセント、他は樹皮色
  ctx.save();
  const trunkFill = isSelf ? '#b98a3e' : '#6b4a2b';
  const trunkStroke = isSelf ? '#8c651f' : '#3d2817';
  ctx.fillStyle = trunkFill;
  ctx.beginPath();
  ctx.arc(cx, cy, trunkR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = trunkStroke;
  ctx.lineWidth = isSelf ? 2.5 * scale : 1.8 * scale;
  ctx.stroke();
  // 年輪 2本
  ctx.strokeStyle = isSelf ? 'rgba(61, 40, 23, 0.35)' : 'rgba(61, 40, 23, 0.28)';
  ctx.lineWidth = 0.7 * scale;
  ctx.beginPath();
  ctx.arc(cx, cy, trunkR * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, trunkR * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 名前(幹の中央) — 文字を自動フィット
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const name = tree.name || '';
  // フォントサイズ: 文字数で調整
  let fs = Math.max(11 * scale, trunkR * 0.42);
  ctx.font = `${fs}px 'Shippori Mincho', serif`;
  // 幹の直径 * 0.85 以内に収まるようダイナミックに
  while (ctx.measureText(name).width > trunkR * 1.7 && fs > 9 * scale) {
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
