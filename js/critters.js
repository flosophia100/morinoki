// 生き物(鳥 + 小動物)のジェネラティブ描画
// forest.js の render から呼ばれ、tick() は requestAnimationFrame ごとに呼ばれる
// 画面の view(pan/zoom)に関係なく、screen (CSS pixel) 座標で描画する

export class Critters {
  constructor() {
    this.birds = [];
    this.animals = [];
    this.lastSpawnBird = 0;
    this.lastSpawnAnimal = 0;
    this.t = 0;
  }

  tick(dt, W, H) {
    this.t += dt;
    // ===== 鳥 =====
    // 15〜30秒ごとに1羽
    if (this.t - this.lastSpawnBird > 15 + Math.random() * 15) {
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

    // ===== 小動物 =====
    // 25〜50秒ごとに 1匹、最大 2匹まで
    if (this.animals.length < 2 && this.t - this.lastSpawnAnimal > 25 + Math.random() * 25) {
      this.lastSpawnAnimal = this.t;
      this.spawnAnimal(W, H);
    }
    this.animals = this.animals.filter(a => a.life > 0);
    this.animals.forEach(a => {
      a.life -= dt;
      // ランダム方向変更
      if (Math.random() < 0.01) {
        a.vx = (Math.random() - 0.5) * a.speed;
        a.vy = (Math.random() - 0.5) * a.speed;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      // 画面外は跳ね返す
      if (a.x < 40 || a.x > W - 40) a.vx *= -1;
      if (a.y < 40 || a.y > H - 40) a.vy *= -1;
      a.bob = Math.sin(this.t * 6 + a.phase) * 1.5;
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
      color: ['#2a2419', '#4a3525', '#1a1a1a', '#3d2818'][Math.floor(Math.random() * 4)],
      size: 6 + Math.random() * 4,
      alive: true
    });
  }

  spawnAnimal(W, H) {
    const kind = Math.random() < 0.5 ? 'rabbit' : 'squirrel';
    this.animals.push({
      x: 60 + Math.random() * (W - 120),
      y: 60 + Math.random() * (H - 120),
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      speed: 12 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      life: 15 + Math.random() * 20,
      kind,
      color: kind === 'rabbit' ? '#bfa988' : '#8b5a2b',
      bob: 0
    });
  }

  render(ctx) {
    // 小動物(鳥より手前)
    this.animals.forEach(a => drawAnimal(ctx, a));
    // 鳥(上空)
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

function drawAnimal(ctx, a) {
  ctx.save();
  ctx.translate(a.x, a.y + a.bob);
  const col = a.color;
  if (a.kind === 'rabbit') {
    // 本体(楕円)
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 耳 2本
    ctx.beginPath(); ctx.ellipse(-3, -8, 1.5, 6, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -8, 1.5, 6, 0.2, 0, Math.PI * 2); ctx.fill();
    // 尾(白)
    ctx.fillStyle = '#f2ebd8';
    ctx.beginPath(); ctx.arc(-8, 2, 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // リス: 茶色の丸+尾のカーブ
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    // 頭
    ctx.beginPath(); ctx.arc(6, -3, 4, 0, Math.PI * 2); ctx.fill();
    // 耳
    ctx.beginPath(); ctx.ellipse(5, -6, 1.2, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, -6, 1.2, 2, 0, 0, Math.PI * 2); ctx.fill();
    // ふさふさ尾
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(-14, -6, -8, -12);
    ctx.stroke();
  }
  ctx.restore();
}

// 背景の小さな canopy を描く(森全体の雰囲気づくり)
// seedと木の数から乱数を決める → 再現性ある位置
export function drawBackgroundCanopies(ctx, W, H, nodeCount, seed = 42) {
  // ノード数に応じて数を増やす(最低 14、最大 90)
  const count = Math.min(90, 14 + Math.floor(nodeCount * 1.8));
  const rng = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 10 + rng() * 28;
    const tint = 0.05 + rng() * 0.10; // 非常に薄い
    ctx.fillStyle = `rgba(58, 80, 38, ${tint})`;
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
