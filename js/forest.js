import { drawTree, trunkRadiusFor } from './tree.js';
import { seededRandom } from './utils.js';
import { atmosphereAt } from './atmosphere.js';
import { Critters, drawBackgroundCanopies } from './critters.js';

export function layoutRandom(trees) {
  trees.forEach((t) => {
    const x = Number(t.x), y = Number(t.y);
    if (!isFinite(x) || !isFinite(y) || (x === 0 && y === 0)) {
      const rng = seededRandom(Number(t.seed) || 1);
      t.x = (rng() - 0.5) * 1200;
      t.y = (rng() - 0.5) * 1200;
    } else {
      t.x = x; t.y = y;
    }
  });
}

export function createForest(canvas, state) {
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const critters = new Critters(() => state.ambience);
  let lastTickAt = performance.now();

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    W = rect.width; H = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.view) state.view = { ox: W/2, oy: H/2, scale: 1 };
  }
  resize();
  window.addEventListener('resize', () => { resize(); render(); });

  let drag = null;
  let pinch = null; // { d0, scale0, ox0, oy0, cx, cy }

  function pt(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }
  function twoTouchCenter(e) {
    const r = canvas.getBoundingClientRect();
    const a = e.touches[0], b = e.touches[1];
    return {
      cx: (a.clientX + b.clientX) / 2 - r.left,
      cy: (a.clientY + b.clientY) / 2 - r.top,
      d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    };
  }
  function screenToWorld(x, y) {
    return { x: (x - state.view.ox) / state.view.scale, y: (y - state.view.oy) / state.view.scale };
  }

  // ヒットテスト: ノード(最前面・深さ優先) > 幹
  // 位置は描画位置(display)で判定 — ゆらぎ/drift中でもタップが合う
  // excludeNodeId を指定すると、その自ノードは対象外(D&Dで自分自身に重ねる防止)
  function hitTest(sx, sy, excludeNodeId) {
    const w = screenToWorld(sx, sy);
    const trees = state.trees || [];
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      const nodes = t.nodes || [];
      const sorted = nodes.slice().sort((a, b) => (b._depth || 0) - (a._depth || 0));
      for (const n of sorted) {
        if (n._x == null) continue;
        if (excludeNodeId && n.id === excludeNodeId) continue;
        const dx = w.x - n._x, dy = w.y - n._y;
        const r = n._r || 10;
        if (dx*dx + dy*dy <= r*r) {
          return { type: 'node', tree: t, node: n };
        }
      }
    }
    // 幹 — display位置で判定
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      const tx = t._displayX ?? t.x;
      const ty = t._displayY ?? t.y;
      const dx = w.x - tx, dy = w.y - ty;
      const r = (t._trunkR || 28);
      if (dx*dx + dy*dy <= r*r) {
        return { type: 'trunk', tree: t };
      }
    }
    return null;
  }

  function onDown(e) {
    const p = pt(e);
    const hit = hitTest(p.x, p.y);
    const world = screenToWorld(p.x, p.y);
    drag = { start: p, last: p, moved: 0, startWorld: world, mode: 'pan', hit };

    // admin モードなら 全樹・全ノード編集許可、通常は自分の樹のみ
    const canEdit = hit && (state.adminToken || (state.session && hit.tree.id === state.selfTreeId));
    if (canEdit) {
      if (hit.type === 'trunk') {
        drag.mode = 'drag-tree';
        drag.origX = hit.tree.x;
        drag.origY = hit.tree.y;
        hit.tree._dragging = true;
        // driftを消してdragで位置を直接固定
        hit.tree._driftX = 0;
        hit.tree._driftY = 0;
        hit.tree._windX = 0;
        hit.tree._windY = 0;
      } else if (hit.type === 'node') {
        drag.mode = 'drag-node';
        drag.origOffX = hit.node.offset_x != null
          ? Number(hit.node.offset_x)
          : (hit.node._x - (hit.node._parentX || hit.tree.x));
        drag.origOffY = hit.node.offset_y != null
          ? Number(hit.node.offset_y)
          : (hit.node._y - (hit.node._parentY || hit.tree.y));
      }
    }
  }

  function onMove(e) {
    if (!drag) return;
    const p = pt(e);
    const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
    drag.last = p;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const world = screenToWorld(p.x, p.y);
    const worldDx = world.x - drag.startWorld.x;
    const worldDy = world.y - drag.startWorld.y;

    if (drag.mode === 'drag-tree') {
      drag.hit.tree.x = drag.origX + worldDx;
      drag.hit.tree.y = drag.origY + worldDy;
      render();
    } else if (drag.mode === 'drag-node') {
      drag.hit.node.offset_x = drag.origOffX + worldDx;
      drag.hit.node.offset_y = drag.origOffY + worldDy;
      render();
    } else {
      state.view.ox += dx;
      state.view.oy += dy;
      render();
    }
  }

  async function onUp(e) {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.mode === 'drag-tree' && d.hit?.tree) {
      d.hit.tree._dragging = false;
    }
    if (d.moved > 6) {
      if (d.mode === 'drag-tree' && state.onTreeMoved) state.onTreeMoved(d.hit.tree);
      else if (d.mode === 'drag-node') {
        // ドロップ位置が他の「自ノード」上なら reparent、そうでなければ位置移動
        let dropped = null;
        try { dropped = d.last ? hitTest(d.last.x, d.last.y, d.hit.node.id) : null; } catch {}
        const sameTree = dropped && dropped.type === 'node' && dropped.tree.id === d.hit.tree.id;
        // 自分自身の子孫にはつけられない(循環防止)
        const forbidden = sameTree && isDescendant(d.hit.tree, d.hit.node.id, dropped.node.id);
        if (sameTree && !forbidden && state.onNodeReparented) {
          state.onNodeReparented(d.hit.tree, d.hit.node, dropped.node);
        } else if (state.onNodeMoved) {
          state.onNodeMoved(d.hit.tree, d.hit.node);
        }
      }
    } else {
      if (d.hit) {
        if (d.hit.type === 'trunk' && state.onTrunkTap) state.onTrunkTap(d.hit.tree);
        else if (d.hit.type === 'node' && state.onNodeTap) state.onNodeTap(d.hit.tree, d.hit.node);
      } else {
        if (state.onEmptyTap) state.onEmptyTap();
      }
    }
  }

  // node が ancestor の子孫か(循環防止用)
  function isDescendant(tree, ancestorId, nodeId) {
    const nodes = tree.nodes || [];
    let cur = nodes.find(n => n.id === nodeId);
    const seen = new Set();
    while (cur && cur.parent_id && !seen.has(cur.id)) {
      if (cur.parent_id === ancestorId) return true;
      seen.add(cur.id);
      cur = nodes.find(n => n.id === cur.parent_id);
    }
    return false;
  }

  function onWheel(e) {
    e.preventDefault();
    const p = pt(e);
    zoomAt(p.x, p.y, e.deltaY > 0 ? 0.9 : 1.1);
    render();
  }
  function zoomAt(px, py, factor) {
    const s = Math.max(0.3, Math.min(3, state.view.scale * factor));
    state.view.ox = px - (px - state.view.ox) * (s / state.view.scale);
    state.view.oy = py - (py - state.view.oy) * (s / state.view.scale);
    state.view.scale = s;
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const { cx, cy, d } = twoTouchCenter(e);
      pinch = { d0: d, scale0: state.view.scale, ox0: state.view.ox, oy0: state.view.oy, cx, cy };
      drag = null;
      e.preventDefault();
      return;
    }
    onDown(e);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2 && pinch) {
      const { cx, cy, d } = twoTouchCenter(e);
      const factor = d / pinch.d0;
      const s = Math.max(0.25, Math.min(3.5, pinch.scale0 * factor));
      // pinch center を中心にズーム
      const ratio = s / pinch.scale0;
      state.view.ox = cx - (cx - pinch.ox0) * ratio;
      state.view.oy = cy - (cy - pinch.oy0) * ratio;
      state.view.scale = s;
      render();
      return;
    }
    onMove(e);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    if (pinch && e.touches.length < 2) { pinch = null; return; }
    onUp(e);
  });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function render() {
    // critters tick(前回のrenderからの経過時間で)
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTickAt) / 1000);
    lastTickAt = now;
    critters.tick(dt, W, H);

    ctx.clearRect(0, 0, W, H);
    const atmo = state.atmo || atmosphereAt(new Date(), state.ambience);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, atmo.top); bg.addColorStop(1, atmo.bot);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (atmo.ambient) {
      ctx.save(); ctx.fillStyle = atmo.ambient; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (atmo.seasonMist) {
      ctx.save(); ctx.fillStyle = atmo.seasonMist; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    // 背景の小さな canopy 群(ノード総数で密度が増える)
    const totalNodes = (state.trees || []).reduce((s, t) => s + (t.nodes?.length || 0), 0);
    const roomSeed = (state.room?.slug || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 42;
    drawBackgroundCanopies(ctx, W, H, totalNodes, roomSeed, state.ambience?.canopyDensity ?? 0.5);

    // 樹(world coords)
    ctx.save();
    ctx.translate(state.view.ox, state.view.oy);
    ctx.scale(state.view.scale, state.view.scale);
    const cursor = state.timeCursor;
    // ビューポートの world 座標範囲(culling用)
    const invS = 1 / state.view.scale;
    const worldLeft = -state.view.ox * invS;
    const worldTop = -state.view.oy * invS;
    const worldRight = worldLeft + W * invS;
    const worldBot = worldTop + H * invS;
    const MARGIN = 250; // 樹の半径+余裕
    (state.trees || []).forEach(t => {
      if (cursor) {
        const ct = Date.parse(t.created_at || 0);
        if (ct > cursor) return;
      }
      const dx = t._displayX ?? t.x;
      const dy = t._displayY ?? t.y;
      // 視界外はスキップ(パフォーマンス)
      if (dx < worldLeft - MARGIN || dx > worldRight + MARGIN ||
          dy < worldTop - MARGIN || dy > worldBot + MARGIN) return;
      const ds = t._displayScale ?? 1.0;
      const filteredTree = cursor ? { ...t, nodes: (t.nodes || []).filter(n => Date.parse(n.created_at || 0) <= cursor) } : t;
      drawTree(ctx, filteredTree, dx, dy, ds, { isSelf: t.id === state.selfTreeId, design: state.design });
    });
    ctx.restore();

    // critters は screen 座標で最前面に
    critters.render(ctx);
  }

  return { render, resize, screenToWorld };
}
