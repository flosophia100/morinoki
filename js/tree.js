import { seededRandom } from './utils.js';

export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { highlight = false } = opts;
  const rng = seededRandom(Number(tree.seed) || 1);
  const nodes = tree.nodes || [];
  const baseRadius = 50 * scale;
  const radius = baseRadius + nodes.length * 3 * scale;

  // 地面の影
  ctx.save();
  ctx.fillStyle = 'rgba(90, 70, 40, 0.08)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 5, radius * 1.1, radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // canopy本体(薄い苔緑の雲)
  ctx.save();
  ctx.fillStyle = 'rgba(90, 107, 62, 0.25)';
  ctx.beginPath();
  const blobs = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < blobs; i++) {
    const a = (Math.PI * 2 * i) / blobs + rng() * 0.3;
    const r = radius * (0.7 + rng() * 0.3);
    const x = cx + Math.cos(a) * r * 0.3;
    const y = cy + Math.sin(a) * r * 0.3;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  if (highlight) {
    ctx.save();
    ctx.strokeStyle = 'rgba(196, 154, 62, 0.55)';
    ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // 葉ノード(キーワード)
  nodes.forEach((n, i) => {
    const a = (Math.PI * 2 * i) / Math.max(1, nodes.length) + rng() * 0.15;
    const r = radius * 0.75 * (0.6 + rng() * 0.4);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const nr = (4 + (n.size || 3) * 2) * scale;
    ctx.fillStyle = n.color || '#5a6b3e';
    ctx.beginPath(); ctx.arc(x, y, nr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(31, 26, 21, 0.25)'; ctx.lineWidth = 0.8; ctx.stroke();
    n._x = x; n._y = y; n._r = nr;
  });

  // 名前ラベル
  ctx.save();
  ctx.fillStyle = 'rgba(244, 237, 224, 0.85)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${14 * scale}px 'Shippori Mincho', serif`;
  const lw = ctx.measureText(tree.name).width + 10;
  ctx.fillRect(cx - lw/2, cy - 10*scale, lw, 20*scale);
  ctx.fillStyle = 'rgba(58, 72, 40, 1)';
  ctx.fillText(tree.name, cx, cy);
  ctx.restore();

  return { radius };
}
