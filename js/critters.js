// 生き物(鳥 + 小動物)のジェネラティブ描画
// forest.js の render から呼ばれ、tick() は requestAnimationFrame ごとに呼ばれる
// 画面の view(pan/zoom)に関係なく、screen (CSS pixel) 座標で描画する

export class Critters {
  constructor(getAmbience = null) {
    this.birds = [];
    this.lastSpawnBird = 0;
    this.t = 0;
    this.getAmbience = getAmbience || (() => null);
  }

  tick(dt, W, H) {
    this.t += dt;
    const amb = this.getAmbience() || {};
    // birdFreq 0..1 → 0.0で止まる、0.5で既定、1.0で2倍頻度
    const freq = typeof amb.birdFreq === 'number' ? amb.birdFreq : 0.5;
    if (freq <= 0.01) return; // 鳥を出さない設定
    // 既定の間隔 12〜25秒 を freq の逆比で伸縮
    const scale = 1 / (0.2 + freq * 1.8); // 0.5→1.0倍、0→非常に長い(上のearly-returnで止まるが)、1→0.5倍
    const interval = (12 + Math.random() * 13) * scale;
    if (this.t - this.lastSpawnBird > interval) {
      this.lastSpawnBird = this.t;
      this.spawnBird(W, H);
    }
    this.birds = this.birds.filter(b => b.alive);
    this.birds.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(this.t * 2 + b.phase) * 0.3;
      b.wing = Math.sin(this.t * 12 + b.phase) * 0.7;
      if (b.x < -80 || b.x > W + 80 || b.y < -60 || b.y > H + 60) b.alive = false;
    });
  }

  spawnBird(W, H) {
    const fromLeft = Math.random() < 0.5;
    const speed = 40 + Math.random() * 60;
    this.birds.push({
      x: fromLeft ? -40 : W + 40,
      y: 40 + Math.random() * Math.max(120, H * 0.5),
      vx: fromLeft ? speed : -speed,
      vy: (Math.random() - 0.5) * 15,
      phase: Math.random() * Math.PI * 2,
      wing: 0,
      color: ['#1e2a33', '#3f5a4e', '#52616e', '#2d3a44'][Math.floor(Math.random() * 4)],
      size: 6 + Math.random() * 4,
      alive: true
    });
  }

  render(ctx) {
    this.birds.forEach(b => drawBird(ctx, b));
  }
}

function drawBird(ctx, b) {
  // 上空から見た「<」の鳥シルエット。羽ばたきで wing が開閉
  const dir = b.vx > 0 ? 1 : -1;
  const w = b.size, h = b.size * 0.8;
  const lift = b.wing * h * 0.6;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = b.color;
  ctx.beginPath();
  // 体
  ctx.ellipse(0, 0, w * 0.35, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // 左翼
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-dir * w * 0.8, -h - lift, -dir * w * 1.6, 0);
  ctx.quadraticCurveTo(-dir * w * 0.9, -h * 0.3 - lift * 0.5, 0, 0);
  ctx.closePath();
  ctx.fill();
  // 右翼
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(dir * w * 0.8, -h - lift, dir * w * 1.6, 0);
  ctx.quadraticCurveTo(dir * w * 0.9, -h * 0.3 - lift * 0.5, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 背景の小さな canopy を描く(森全体の雰囲気づくり)
// seedと木の数から乱数を決める → 再現性ある位置
export function drawBackgroundCanopies(ctx, W, H, nodeCount, seed = 42, canopyDensity = 0.5) {
  // canopyDensity 0..1 → 倍率 0..2(0.5が中立)
  const mul = Math.max(0, Math.min(2, canopyDensity * 2));
  const count = Math.min(90, Math.floor((14 + Math.floor(nodeCount * 1.8)) * mul));
  if (count <= 0) { return; }
  const rng = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 10 + rng() * 28;
    const tint = 0.05 + rng() * 0.10; // 非常に薄い
    ctx.fillStyle = `rgba(111, 138, 125, ${tint})`;
    ctx.beginPath();
    const N = 10 + Math.floor(rng() * 6);
    const jit = [];
    for (let k = 0; k < N; k++) jit.push(0.8 + rng() * 0.5);
    for (let k = 0; k <= N; k++) {
      const a = (Math.PI * 2 * k) / N;
      const rr = r * jit[k % N];
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
