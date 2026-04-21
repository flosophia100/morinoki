import { stringHash } from './utils.js';
import { tickNodeSim, ripple as nodeRipple, impulseFor as nodeImpulse } from './nodesim.js';
import { trunkRadiusFor } from './tree.js';

// 最小構成 + 持続的分離 (_sepX/_sepY)
//
//   _swayX = _rawX + _sepX
//   _rawX  は純 sin/cos(毎フレーム計算、ドラッグ中は凍結)
//   _sepX  は hard separation の累積(毎フレーム decay)
//
// ramp-in (fadeIn):初回1秒で sway 振幅を 0→1 にブレンドし、
//   t=0 時の sin(phase)≠0 による初回ジャンプを防ぐ。

const TRUNK_CFG = {
  ITER: 2,
  BUFFER: 1.10,
  PUSH_CAP: 50,
  SEP_DECAY: 0.977,   // node と揃える
  SWAY_CAP: 400,      // 暴走ガード
};

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
    // 初回 1 秒で 0→1 に(= 初回ジャンプ防止)
    const fadeIn = Math.min(1, this.t / 1.0);

    // 幹:raw sway と sep から合成
    trees.forEach(t => {
      if (t._sepX == null)  { t._sepX = 0;  t._sepY = 0; }
      if (t._rawSwayX == null) { t._rawSwayX = 0; t._rawSwayY = 0; }
      if (t._swayX == null) { t._swayX = 0; t._swayY = 0; }
      if (t._dragging) {
        // 完全凍結(raw/sep とも触らない)
        t._swayX = (t._rawSwayX || 0) + (t._sepX || 0);
        t._swayY = (t._rawSwayY || 0) + (t._sepY || 0);
        return;
      }
      const seed = typeof t.id === 'string' ? stringHash(t.id)
                 : (Number(t.seed) || stringHash(t.name || 'x'));
      const pX = (seed % 1009) * 0.01;
      const pY = ((Math.floor(seed / 7)) % 1009) * 0.012;
      const rawX = ((Math.sin(this.t * 0.09 + pX) * 110
                  + Math.sin(this.t * 0.045 + pX * 1.7) * 55) * ampMul) * fadeIn;
      const rawY = ((Math.cos(this.t * 0.075 + pY) * 90
                  + Math.cos(this.t * 0.038 + pY * 1.3) * 40) * ampMul) * fadeIn;
      t._rawSwayX = rawX; t._rawSwayY = rawY;
      t._sepX *= TRUNK_CFG.SEP_DECAY;
      t._sepY *= TRUNK_CFG.SEP_DECAY;
      t._swayX = rawX + t._sepX;
      t._swayY = rawY + t._sepY;
    });

    // 幹同士 hard separation(push も fadeIn でスケール — 初回のスナップを抑制)
    for (let iter = 0; iter < TRUNK_CFG.ITER; iter++) {
      for (let i = 0; i < trees.length; i++) {
        const A = trees[i];
        const ra = trunkRadiusFor(A, 1, design || undefined);
        const ax = A.x + (A._swayX || 0);
        const ay = A.y + (A._swayY || 0);
        for (let j = i + 1; j < trees.length; j++) {
          const B = trees[j];
          const rb = trunkRadiusFor(B, 1, design || undefined);
          const minD = (ra + rb) * TRUNK_CFG.BUFFER;
          const bx = B.x + (B._swayX || 0);
          const by = B.y + (B._swayY || 0);
          const dx = bx - ax, dy = by - ay;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD || d2 < 0.0001) continue;
          const d = Math.sqrt(d2);
          const push = Math.min(TRUNK_CFG.PUSH_CAP, (minD - d) / 2) * fadeIn;
          const ux = dx / d, uy = dy / d;
          if (!A._dragging) {
            A._sepX -= ux * push; A._sepY -= uy * push;
            A._swayX -= ux * push; A._swayY -= uy * push;
          }
          if (!B._dragging) {
            B._sepX += ux * push; B._sepY += uy * push;
            B._swayX += ux * push; B._swayY += uy * push;
          }
        }
      }
    }

    // sway の絶対上限
    trees.forEach(t => {
      const cap = TRUNK_CFG.SWAY_CAP;
      if (t._swayX >  cap) t._swayX =  cap;
      if (t._swayX < -cap) t._swayX = -cap;
      if (t._swayY >  cap) t._swayY =  cap;
      if (t._swayY < -cap) t._swayY = -cap;
      if (t._sepX  >  cap) t._sepX  =  cap;
      if (t._sepX  < -cap) t._sepX  = -cap;
      if (t._sepY  >  cap) t._sepY  =  cap;
      if (t._sepY  < -cap) t._sepY  = -cap;
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

    // ノードシム(自身の fadeIn を渡す → ノードの初回ジャンプも防止)
    tickNodeSim(trees, this.t, design, fadeIn);
  }

  bumpNode(node, strength = 5) {
    const trees = this.getTrees();
    nodeImpulse(node, strength);
    nodeRipple(node, trees, strength * 0.6);
  }
}
