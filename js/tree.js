import { seededRandom } from './utils.js';

// 各ノードの位置を決定(offsetがあれば優先、なければseedベース)
// 返り値を forest.js のヒットテストでも使う
export function computeNodePositions(tree, cx, cy, scale = 1.0) {
  const rng = seededRandom(Number(tree.seed) || 1);
  const nodes = tree.nodes || [];
  const n = nodes.length;
  const baseBranchLen = 70 * scale;
  return nodes.map((node, i) => {
    // seedベースのデフォルト角度・長さ
    const a0 = (Math.PI * 2 * i) / Math.max(1, n) - Math.PI / 2;
    const a = a0 + (rng() - 0.5) * 0.5;
    const sizeFactor = 0.85 + (node.size || 3) * 0.05;
    const len = baseBranchLen * sizeFactor * (0.9 + rng() * 0.3);
    let ex, ey;
    if (node.offset_x != null && node.offset_y != null) {
      ex = cx + Number(node.offset_x) * scale;
      ey = cy + Number(node.offset_y) * scale;
    } else {
      ex = cx + Math.cos(a) * len;
      ey = cy + Math.sin(a) * len;
    }
    const nr = (5 + (node.size || 3) * 2) * scale;
    return { angle: a, length: len, ex, ey, nr };
  });
}

export const TRUNK_RADIUS = 12; // 幹のヒットテスト半径(world座標, scale=1時)

// 樹の描画(上空視点・幹+枝+葉ノード)
export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { highlight = false } = opts;
  const nodes = tree.nodes || [];
  const positions = computeNodePositions(tree, cx, cy, scale);
  const baseBranchLen = 70 * scale;

  // ハイライトリング(自分の樹)
  if (highlight) {
    ctx.save();
    ctx.strokeStyle = 'rgba(196, 154, 62, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    const hlRadius = baseBranchLen * 1.35;
    ctx.arc(cx, cy, hlRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 地面の影
  ctx.save();
  ctx.fillStyle = 'rgba(90, 70, 40, 0.15)';
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy + 2, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 枝(幹→ノード)
  nodes.forEach((node, i) => {
    const p = positions[i];
    ctx.save();
    ctx.strokeStyle = 'rgba(107, 74, 43, 0.75)';
    ctx.lineWidth = Math.max(1.2, (2.2 - i * 0.05)) * scale;
    ctx.lineCap = 'round';
    // 曲線の制御点: 手動位置の場合は直線に近く、自動の場合は自然なカーブ
    const dx = p.ex - cx, dy = p.ey - cy;
    const len2 = Math.hypot(dx, dy);
    const perpX = -dy / (len2 || 1);
    const perpY = dx / (len2 || 1);
    const sway = (node.offset_x != null) ? 0 : len2 * 0.08;
    const mx = (cx + p.ex) / 2 + perpX * sway;
    const my = (cy + p.ey) / 2 + perpY * sway;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(mx, my, p.ex, p.ey);
    ctx.stroke();
    ctx.restore();
  });

  // 葉ノード
  nodes.forEach((node, i) => {
    const p = positions[i];
    // 影
    ctx.save();
    ctx.fillStyle = 'rgba(58, 72, 40, 0.12)';
    ctx.beginPath();
    ctx.arc(p.ex + 1, p.ey + 1.5, p.nr + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 本体
    ctx.fillStyle = node.color || '#5a6b3e';
    ctx.beginPath();
    ctx.arc(p.ex, p.ey, p.nr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31, 26, 21, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 説明ありの印(右上に小さなドット)
    if (node.description) {
      ctx.fillStyle = 'rgba(196, 154, 62, 0.95)';
      ctx.beginPath();
      ctx.arc(p.ex + p.nr * 0.7, p.ey - p.nr * 0.7, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // ラベル
    if (p.nr >= 10 * scale) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 252, 244, 0.95)';
      ctx.font = `${Math.max(9, p.nr * 0.85)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.text, p.ex, p.ey);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `${11 * scale}px 'Klee One', serif`;
      const isRight = Math.cos(Math.atan2(p.ey - cy, p.ex - cx)) >= 0;
      ctx.textAlign = isRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const pad = (p.nr + 4) * (isRight ? 1 : -1);
      const tw = ctx.measureText(node.text).width;
      const bgX = isRight ? p.ex + pad - 1 : p.ex + pad - tw - 3;
      ctx.fillStyle = 'rgba(244, 237, 224, 0.7)';
      ctx.fillRect(bgX, p.ey - 7, tw + 4, 14);
      ctx.fillStyle = 'rgba(58, 72, 40, 0.95)';
      ctx.fillText(node.text, p.ex + pad, p.ey);
      ctx.restore();
    }

    // ヒットテスト用
    node._x = p.ex; node._y = p.ey; node._r = p.nr;
  });

  // 幹
  ctx.save();
  ctx.fillStyle = 'rgba(107, 74, 43, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b4a2b';
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(61, 40, 23, 0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, 4 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 名前ラベル
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${14 * scale}px 'Shippori Mincho', serif`;
  const textY = cy + 14 * scale;
  const lw = ctx.measureText(tree.name).width + 12;
  ctx.fillStyle = 'rgba(244, 237, 224, 0.9)';
  ctx.fillRect(cx - lw/2, textY - 2, lw, 20 * scale);
  ctx.fillStyle = 'rgba(58, 72, 40, 1)';
  ctx.fillText(tree.name, cx, textY);
  ctx.restore();

  // 幹のヒットテスト情報も保存
  tree._trunkX = cx;
  tree._trunkY = cy;
  tree._trunkR = TRUNK_RADIUS * scale;

  return { radius: baseBranchLen * 1.35 };
}
