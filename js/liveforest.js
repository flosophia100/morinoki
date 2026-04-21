import { stringHash } from './utils.js';
import { tickNodeSim, ripple as nodeRipple, impulseFor as nodeImpulse } from './nodesim.js';
import { bigrams, jaccardSim, normalize } from './textsim.js';

// 軽量な「生きている森」シミュレータ
// - 風: 各樹が独自の位相でゆっくりゆらぐ
// - 引力: 似たキーワードを多く持つ樹同士が表示位置で静かに寄る(DB位置は変えない)
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

    // 引力: 似た樹ほどターゲット距離が近くなる(ドラッグ中の樹はスキップ)
    // 強度を約3倍に上げて視認しやすく
    this.similarPairs.forEach(p => {
      if (p.a._dragging || p.b._dragging) return;
      const ax = p.a.x + (p.a._driftX || 0);
      const ay = p.a.y + (p.a._driftY || 0);
      const bx = p.b.x + (p.b._driftX || 0);
      const by = p.b.y + (p.b._driftY || 0);
      const dx = bx - ax, dy = by - ay;
      const dist = Math.hypot(dx, dy) || 1;
      const targetDist = 420 - p.strength * 260;
      const diff = dist - targetDist;
      if (Math.abs(diff) < 10) return;
      const pull = Math.max(-6, Math.min(6, (diff / dist) * 0.06 * p.strength));
      const mx = dx * pull / dist, my = dy * pull / dist;
      p.a._driftX += mx * 4;
      p.a._driftY += my * 4;
      p.b._driftX -= mx * 4;
      p.b._driftY -= my * 4;
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

    // drift ダンピング。漂いで他ノードに押し出された余力を保持、
    //   過大になったら緩やかにクランプ
    trees.forEach(t => {
      t._driftX *= 0.995;
      t._driftY *= 0.995;
      const maxDrift = 700;
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

// 樹の類似度: 各ノード text の bigram 集合をマージし、二樹間で Jaccard。
// さらに「完全一致するノードが何割あるか」を小さく加算して語の重なりを効かせる。
function treeSim(a, b) {
  const na = normalize(a.name || '');
  const nb = normalize(b.name || '');
  // 名前が短すぎる場合はノードのみで判定、そうでなければ name も素材に加える
  const aTexts = (a.nodes || []).map(n => n.text).filter(Boolean);
  const bTexts = (b.nodes || []).map(n => n.text).filter(Boolean);
  if (na) aTexts.push(a.name);
  if (nb) bTexts.push(b.name);
  if (aTexts.length === 0 || bTexts.length === 0) return 0;

  // 1) 全bigrams の Jaccard
  const A = new Set(), B = new Set();
  aTexts.forEach(s => bigrams(s).forEach(g => A.add(g)));
  bTexts.forEach(s => bigrams(s).forEach(g => B.add(g)));
  const base = jaccardSim(A, B);

  // 2) 完全一致ノード割合(ブースト)
  const aNorm = new Set(aTexts.map(s => normalize(s)).filter(Boolean));
  const bNorm = new Set(bTexts.map(s => normalize(s)).filter(Boolean));
  let exact = 0;
  aNorm.forEach(x => { if (bNorm.has(x)) exact++; });
  const boost = exact / Math.max(aNorm.size, bNorm.size);

  // 合成: base が主、exact で少しブースト(上限 1.0)
  return Math.min(1, base + boost * 0.4);
}
