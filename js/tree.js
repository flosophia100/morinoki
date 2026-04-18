import { seededRandom } from './utils.js';

// 樹の描画(上空視点・幹+枝+葉ノード)
// - 幹: 中央の小さな円(+名前ラベル)= 自分
// - 枝: 幹から各キーワードへ伸びる曲線
// - 葉ノード: 枝の先端にある色つきの円 = キーワード
//
// tree: { id, name, seed, x, y, nodes: [{id, text, size, color, ord}] }
// cx, cy: world座標の中心
export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { highlight = false } = opts;
  const rng = seededRandom(Number(tree.seed) || 1);
  const nodes = tree.nodes || [];
  const n = nodes.length;

  // 枝の長さは「サイズで決まる基本長 × ノード個別のゆらぎ」
  const baseBranchLen = 70 * scale;

  // ノードの位置を事前計算(他箇所でも使うので)
  const positions = nodes.map((node, i) => {
    // 角度は均等割 + 小さなゆらぎ(seed依存で樹ごとに個性)
    const a0 = (Math.PI * 2 * i) / Math.max(1, n) - Math.PI / 2;
    const a = a0 + (rng() - 0.5) * 0.5;
    // 枝長はノードのsize(1..5)で重みをつける + ゆらぎ
    const sizeFactor = 0.85 + (node.size || 3) * 0.05;
    const len = baseBranchLen * sizeFactor * (0.9 + rng() * 0.3);
    return {
      angle: a,
      length: len,
      ex: cx + Math.cos(a) * len,
      ey: cy + Math.sin(a) * len,
      nr: (5 + (node.size || 3) * 2) * scale
    };
  });

  // ハイライト(自分の樹)は枝より下(背景)
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

  // 地面の影(幹の根元)
  ctx.save();
  ctx.fillStyle = 'rgba(90, 70, 40, 0.15)';
  ctx.beginPath();
  ctx.ellipse(cx + 1.5, cy + 2, 10 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 枝: 幹→ノード へ曲線
  nodes.forEach((node, i) => {
    const p = positions[i];
    ctx.save();
    ctx.strokeStyle = 'rgba(107, 74, 43, 0.75)';
    ctx.lineWidth = Math.max(1.2, (2.2 - i * 0.05)) * scale;
    ctx.lineCap = 'round';
    // 制御点: 直線からわずかに反らせた自然なカーブ
    const sway = (rng() - 0.5) * 0.35;
    const mx = cx + Math.cos(p.angle + sway) * p.length * 0.55;
    const my = cy + Math.sin(p.angle + sway) * p.length * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(mx, my, p.ex, p.ey);
    ctx.stroke();
    ctx.restore();
  });

  // 葉ノード(キーワード)
  nodes.forEach((node, i) => {
    const p = positions[i];
    // 外側のほんのり影
    ctx.save();
    ctx.fillStyle = 'rgba(58, 72, 40, 0.12)';
    ctx.beginPath();
    ctx.arc(p.ex + 1, p.ey + 1.5, p.nr + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ノード本体
    ctx.fillStyle = node.color || '#5a6b3e';
    ctx.beginPath();
    ctx.arc(p.ex, p.ey, p.nr, 0, Math.PI * 2);
    ctx.fill();

    // 縁取り
    ctx.strokeStyle = 'rgba(31, 26, 21, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ノード中央にキーワードラベル(ノードが大きいとき)
    if (p.nr >= 10 * scale) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 252, 244, 0.95)';
      ctx.font = `${Math.max(9, p.nr * 0.85)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.text, p.ex, p.ey);
      ctx.restore();
    } else {
      // 小さいノードはノード外側にテキスト
      ctx.save();
      ctx.fillStyle = 'rgba(58, 72, 40, 0.85)';
      ctx.font = `${11 * scale}px 'Klee One', serif`;
      // 方向で揃える
      const isRight = Math.cos(p.angle) >= 0;
      ctx.textAlign = isRight ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      const pad = (p.nr + 4) * (isRight ? 1 : -1);
      // 背景
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

  // 幹(中央の小さな円)
  ctx.save();
  // 外側のぼかし
  ctx.fillStyle = 'rgba(107, 74, 43, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  // 幹本体
  ctx.fillStyle = '#6b4a2b';
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  // 年輪
  ctx.strokeStyle = 'rgba(61, 40, 23, 0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cx, cy, 4 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 名前ラベル(幹の真下)
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

  // 他からのヒットテスト用に樹の半径を返す
  return { radius: baseBranchLen * 1.35 };
}
