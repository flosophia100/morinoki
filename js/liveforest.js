import { stringHash } from './utils.js';
import { tickNodeSim, ripple as nodeRipple, impulseFor as nodeImpulse } from './nodesim.js';
import { fieldRadiusFor } from './forest.js';

// 軽量な「生きている森」シミュレータ
// - 風: 各樹が独自の位相でゆっくりゆらぐ
// - 斥力: 近すぎる樹同士は離す(幾何的)
// - 成長: 新しい樹は小さく現れ、徐々に大きくなる
//
// すべてクライアント側の視覚演出。DBへの保存は意図的にしない。
export class LiveForest {
  constructor(getTrees, onTick, getDesign = null) {
    this.getTrees = getTrees;
    this.onTick = onTick;
    this.getDesign = getDesign || (() => null);
    this.t = 0;
    this.running = false;
    this.rafId = null;
    this.lastSeen = new Set(); // tree ids seen last frame (for growth detection)
    this.spawnAt = new Map();  // treeId -> timestamp (ms)
    this.now = () => performance.now();
  }

  ensureInit(t) {
    if (t._driftX == null) t._driftX = 0;
    if (t._driftY == null) t._driftY = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    // 非表示タブでは requestAnimationFrame がstallするので自動的に省エネ
    // また、タブが非可視の間は明示的にスキップしてCPU節約
    const loop = () => {
      if (!this.running) return;
      if (document.visibilityState === 'visible') {
        this.tick();
        this.onTick && this.onTick();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  // データ更新後に呼ぶ(realtimeで変更があった時など)
  notifyDataChanged() {
    const trees = this.getTrees();
    const currentIds = new Set(trees.map(t => t.id));
    // 新規出現 → spawn時刻記録
    trees.forEach(t => {
      if (!this.lastSeen.has(t.id) && this.running) {
        this.spawnAt.set(t.id, this.now());
      }
    });
    this.lastSeen = currentIds;
  }

  tick() {
    const design = this.getDesign() || null;
    // design.shimmerSpeed: 0..1 → 時間ステップ 0.006..0.03
    const speedMul = design ? (0.4 + design.shimmerSpeed * 1.2) : 1.0;
    this.t += 0.016 * speedMul;
    // design.shimmerAmp: 0..1 → 振幅倍率 0.25..3.0 (0.5中立で1.6)
    const ampMul = design ? (0.25 + design.shimmerAmp * 2.75) : 1.6;
    const trees = this.getTrees();

    // 幹の漂い(roam): 低周波・大振幅で2周期重ねて複雑な軌跡に
    //   shimmerAmp=0.5: 水平 ±450px、垂直 ±360px くらいを60秒周期で回遊
    trees.forEach(t => {
      this.ensureInit(t);
      if (t._dragging) { t._windX = 0; t._windY = 0; return; }
      const seed = Number(t.seed) || stringHash(t.name || 'x');
      const pX = (seed % 1009) * 0.01;
      const pY = ((Math.floor(seed / 7)) % 1009) * 0.012;
      const windX = (Math.sin(this.t * 0.11 + pX) * 320
                   + Math.sin(this.t * 0.055 + pX * 1.7) * 140) * ampMul;
      const windY = (Math.cos(this.t * 0.09 + pY) * 250
                   + Math.cos(this.t * 0.045 + pY * 1.3) * 110) * ampMul;
      t._windX = windX;
      t._windY = windY;
    });

    // 斥力: 漂う表示位置(x+drift+wind)で判定し、近すぎたら強く押し離す
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const A = trees[i], B = trees[j];
        const ax = A.x + (A._driftX || 0) + (A._windX || 0);
        const ay = A.y + (A._driftY || 0) + (A._windY || 0);
        const bx = B.x + (B._driftX || 0) + (B._windX || 0);
        const by = B.y + (B._driftY || 0) + (B._windY || 0);
        const dx = bx - ax, dy = by - ay;
        const d2 = dx*dx + dy*dy;
        const min = 260;
        if (d2 < min*min && d2 > 1) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.24 / d;  // 強めに
          A._driftX -= dx * push;
          A._driftY -= dy * push;
          B._driftX += dx * push;
          B._driftY += dy * push;
        }
      }
    }

    // フィールド外(半径 R = fieldRadiusFor(treeCount))に出たら中心へ弱く引く
    //   drift を通じて静かに戻す
    const fieldR = fieldRadiusFor(trees.length);
    trees.forEach(t => {
      if (t._dragging) return;
      const cx = t.x + (t._driftX || 0);
      const cy = t.y + (t._driftY || 0);
      const dist = Math.hypot(cx, cy);
      if (dist > fieldR) {
        const over = dist - fieldR;
        const pull = Math.min(0.5, over * 0.002);
        t._driftX -= (cx / Math.max(1, dist)) * pull;
        t._driftY -= (cy / Math.max(1, dist)) * pull;
      }
    });

    // drift ダンピング。漂いで他ノードに押し出された余力を保持、
    //   過大になったらフィールド半径ぶんにクランプ
    const maxDrift = Math.max(700, fieldR * 1.1);
    trees.forEach(t => {
      t._driftX *= 0.995;
      t._driftY *= 0.995;
      if (t._driftX > maxDrift) t._driftX = maxDrift;
      if (t._driftX < -maxDrift) t._driftX = -maxDrift;
      if (t._driftY > maxDrift) t._driftY = maxDrift;
      if (t._driftY < -maxDrift) t._driftY = -maxDrift;
    });

    // 成長アニメ
    const now = this.now();
    trees.forEach(t => {
      const at = this.spawnAt.get(t.id);
      if (at == null) {
        t._spawnScale = 1;
      } else {
        const elapsed = now - at;
        const dur = 1400;
        if (elapsed >= dur) {
          t._spawnScale = 1;
          this.spawnAt.delete(t.id);
        } else {
          // easeOutCubic
          const p = elapsed / dur;
          t._spawnScale = 0.25 + (1 - Math.pow(1 - p, 3)) * 0.75;
        }
      }
      // 最終表示位置(描画時に使用)
      t._displayX = t.x + (t._driftX || 0) + (t._windX || 0);
      t._displayY = t.y + (t._driftY || 0) + (t._windY || 0);
      t._displayScale = t._spawnScale;
    });

    // ===== ノード粒子シム(wordmap流のcollide/charge/wind) =====
    tickNodeSim(trees, this.t, design);
  }

  // ノード編集/作成/移動などで呼ぶ: 連動した波紋 + そのノードへのインパルス
  bumpNode(node, strength = 5) {
    const trees = this.getTrees();
    nodeImpulse(node, strength);
    nodeRipple(node, trees, strength * 0.6);
  }
}
