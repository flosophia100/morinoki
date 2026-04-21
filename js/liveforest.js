import { stringHash } from './utils.js';
import { tickNodeSim, ripple as nodeRipple, impulseFor as nodeImpulse } from './nodesim.js';

// 最小構成の「生きている森」シミュレータ
//   - 幹は低周波の sway を **直接代入** (_swayX/Y)。drift / 累積力なし
//   - ドラッグ中は sway を更新せず「凍結」 → マウスに完全追従
//   - 樹同士の斥力・中心引力も廃止(初期レイアウトで十分な間隔を確保)
//
// DB には保存しない、純粋な見た目の揺らぎ。
export class LiveForest {
  constructor(getTrees, onTick, getDesign = null) {
    this.getTrees = getTrees;
    this.onTick = onTick;
    this.getDesign = getDesign || (() => null);
    this.t = 0;
    this.running = false;
    this.rafId = null;
    this.lastSeen = new Set();
    this.spawnAt = new Map();
    this.now = () => performance.now();
  }

  start() {
    if (this.running) return;
    this.running = true;
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

  notifyDataChanged() {
    const trees = this.getTrees();
    const currentIds = new Set(trees.map(t => t.id));
    trees.forEach(t => {
      if (!this.lastSeen.has(t.id) && this.running) {
        this.spawnAt.set(t.id, this.now());
      }
    });
    this.lastSeen = currentIds;
  }

  tick() {
    const design = this.getDesign() || null;
    const speedMul = design ? (0.4 + design.shimmerSpeed * 1.2) : 1.0;
    this.t += 0.016 * speedMul;
    const ampMul = design ? (0.25 + design.shimmerAmp * 2.75) : 1.6;
    const trees = this.getTrees();

    // 幹の sway を直接代入。ドラッグ中は更新スキップ(凍結)
    trees.forEach(t => {
      if (t._swayX == null) t._swayX = 0;
      if (t._swayY == null) t._swayY = 0;
      if (!t._dragging) {
        const seed = typeof t.id === 'string' ? stringHash(t.id)
                   : (Number(t.seed) || stringHash(t.name || 'x'));
        const pX = (seed % 1009) * 0.01;
        const pY = ((Math.floor(seed / 7)) % 1009) * 0.012;
        const sx = (Math.sin(this.t * 0.09 + pX) * 110
                  + Math.sin(this.t * 0.045 + pX * 1.7) * 55) * ampMul;
        const sy = (Math.cos(this.t * 0.075 + pY) * 90
                  + Math.cos(this.t * 0.038 + pY * 1.3) * 40) * ampMul;
        t._swayX = sx;
        t._swayY = sy;
      }
    });

    // 成長アニメ + 表示位置の合成
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
          const p = elapsed / dur;
          t._spawnScale = 0.25 + (1 - Math.pow(1 - p, 3)) * 0.75;
        }
      }
      t._displayX = t.x + (t._swayX || 0);
      t._displayY = t.y + (t._swayY || 0);
      t._displayScale = t._spawnScale;
    });

    tickNodeSim(trees, this.t, design);
  }

  // ノード編集/作成時に呼ぶ(波紋+小さなインパルス)
  bumpNode(node, strength = 5) {
    const trees = this.getTrees();
    nodeImpulse(node, strength);
    nodeRipple(node, trees, strength * 0.6);
  }
}
