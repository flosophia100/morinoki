import { stringHash } from './utils.js';

// 軽量な「生きている森」シミュレータ
// - 風: 各樹が独自の位相でゆっくりゆらぐ
// - 引力: 似たキーワードを多く持つ樹同士が表示位置で静かに寄る(DB位置は変えない)
// - 成長: 新しい樹は小さく現れ、徐々に大きくなる
//
// すべてクライアント側の視覚演出。DBへの保存は意図的にしない。
export class LiveForest {
  constructor(getTrees, onTick) {
    this.getTrees = getTrees;
    this.onTick = onTick;
    this.t = 0;
    this.running = false;
    this.rafId = null;
    this.similarPairs = [];
    this.lastSeen = new Set(); // tree ids seen last frame (for growth detection)
    this.spawnAt = new Map();  // treeId -> timestamp (ms)
    this.now = () => performance.now();
    this.lastRebuild = 0;
  }

  rebuildSimilarityPairs() {
    const trees = this.getTrees();
    const pairs = [];
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const s = treeSim(trees[i], trees[j]);
        if (s > 0.08) pairs.push({ a: trees[i], b: trees[j], strength: Math.min(0.6, s) });
      }
    }
    this.similarPairs = pairs;
    this.lastRebuild = this.now();
  }

  ensureInit(t) {
    if (t._driftX == null) t._driftX = 0;
    if (t._driftY == null) t._driftY = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.rebuildSimilarityPairs();
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
    this.rebuildSimilarityPairs();
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
    this.t += 0.016;
    const trees = this.getTrees();

    // 風: 位相ずれでゆらぎ(ドラッグ中の樹はスキップ)
    trees.forEach(t => {
      this.ensureInit(t);
      if (t._dragging) { t._windX = 0; t._windY = 0; return; }
      const seed = Number(t.seed) || stringHash(t.name || 'x');
      const pX = (seed % 1009) * 0.01;
      const pY = ((Math.floor(seed / 7)) % 1009) * 0.012;
      const windX = Math.sin(this.t * 0.55 + pX) * 2.4 + Math.sin(this.t * 0.23 + pX * 1.7) * 1.0;
      const windY = Math.cos(this.t * 0.47 + pY) * 2.0 + Math.cos(this.t * 0.19 + pY * 1.3) * 0.9;
      t._windX = windX;
      t._windY = windY;
    });

    // 引力: 似た樹ほどターゲット距離が近くなる(ドラッグ中の樹はスキップ)
    this.similarPairs.forEach(p => {
      if (p.a._dragging || p.b._dragging) return;
      const ax = p.a.x + (p.a._driftX || 0);
      const ay = p.a.y + (p.a._driftY || 0);
      const bx = p.b.x + (p.b._driftX || 0);
      const by = p.b.y + (p.b._driftY || 0);
      const dx = bx - ax, dy = by - ay;
      const dist = Math.hypot(dx, dy) || 1;
      // 類似度が高いほど近くなる(200〜400px 範囲)
      const targetDist = 400 - p.strength * 200;
      const diff = dist - targetDist;
      if (Math.abs(diff) < 20) return;
      const pull = Math.max(-3, Math.min(3, (diff / dist) * 0.02 * p.strength));
      const mx = dx * pull / dist, my = dy * pull / dist;
      p.a._driftX += mx * 2;
      p.a._driftY += my * 2;
      p.b._driftX -= mx * 2;
      p.b._driftY -= my * 2;
    });

    // 斥力(近すぎる樹を押し戻す) — 絡まり防止
    for (let i = 0; i < trees.length; i++) {
      for (let j = i + 1; j < trees.length; j++) {
        const A = trees[i], B = trees[j];
        const ax = A.x + (A._driftX || 0);
        const ay = A.y + (A._driftY || 0);
        const bx = B.x + (B._driftX || 0);
        const by = B.y + (B._driftY || 0);
        const dx = bx - ax, dy = by - ay;
        const d2 = dx*dx + dy*dy;
        const min = 180;
        if (d2 < min*min && d2 > 1) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.05 / d;
          A._driftX -= dx * push;
          A._driftY -= dy * push;
          B._driftX += dx * push;
          B._driftY += dy * push;
        }
      }
    }

    // driftにdampingを効かせて暴れを抑える
    trees.forEach(t => {
      t._driftX *= 0.995;
      t._driftY *= 0.995;
      const maxDrift = 260;
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
  }
}

function treeSim(a, b) {
  const ka = new Set((a.nodes || []).map(n => normalize(n.text)).filter(Boolean));
  const kb = new Set((b.nodes || []).map(n => normalize(n.text)).filter(Boolean));
  if (!ka.size || !kb.size) return 0;
  let overlap = 0;
  for (const x of ka) {
    if (kb.has(x)) { overlap += 1; continue; }
    for (const y of kb) {
      if (x.length >= 2 && y.length >= 2 && (x.includes(y) || y.includes(x))) {
        overlap += 0.5; break;
      }
      // 日本語: 共通文字の割合
      const shared = charOverlap(x, y);
      if (shared >= 0.5 && Math.min(x.length, y.length) >= 2) { overlap += 0.3; break; }
    }
  }
  return overlap / Math.max(ka.size, kb.size);
}
function charOverlap(a, b) {
  const sa = new Set(a), sb = new Set(b);
  let n = 0; sa.forEach(c => { if (sb.has(c)) n++; });
  return n / Math.max(sa.size, sb.size);
}
function normalize(s) {
  return (s || '').toLowerCase().trim();
}
