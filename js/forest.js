import { drawTree, trunkRadiusFor } from './tree.js';
import { seededRandom } from './utils.js';

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

  function pt(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }
  function screenToWorld(x, y) {
    return { x: (x - state.view.ox) / state.view.scale, y: (y - state.view.oy) / state.view.scale };
  }

  // ヒットテスト: ノード(最前面・深さ優先) > 幹
  function hitTest(sx, sy) {
    const w = screenToWorld(sx, sy);
    const trees = state.trees || [];
    // ノード(deeperが優先、自分の樹だけ編集対象として返す — 他人はreadonly)
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      const nodes = t.nodes || [];
      // 深い順
      const sorted = nodes.slice().sort((a, b) => (b._depth || 0) - (a._depth || 0));
      for (const n of sorted) {
        if (n._x == null) continue;
        const dx = w.x - n._x, dy = w.y - n._y;
        const r = n._r || 10;
        if (dx*dx + dy*dy <= r*r) {
          return { type: 'node', tree: t, node: n };
        }
      }
    }
    // 幹
    for (let i = trees.length - 1; i >= 0; i--) {
      const t = trees[i];
      const dx = w.x - t.x, dy = w.y - t.y;
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

    if (hit && state.session && hit.tree.id === state.selfTreeId) {
      if (hit.type === 'trunk') {
        drag.mode = 'drag-tree';
        drag.origX = hit.tree.x;
        drag.origY = hit.tree.y;
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

  async function onUp() {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.moved > 6) {
      if (d.mode === 'drag-tree' && state.onTreeMoved) state.onTreeMoved(d.hit.tree);
      else if (d.mode === 'drag-node' && state.onNodeMoved) state.onNodeMoved(d.hit.tree, d.hit.node);
    } else {
      if (d.hit) {
        if (d.hit.type === 'trunk' && state.onTrunkTap) state.onTrunkTap(d.hit.tree);
        else if (d.hit.type === 'node' && state.onNodeTap) state.onNodeTap(d.hit.tree, d.hit.node);
      } else {
        if (state.onEmptyTap) state.onEmptyTap();
      }
    }
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
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function render() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f2ead4'); bg.addColorStop(1, '#e2d4b5');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(state.view.ox, state.view.oy);
    ctx.scale(state.view.scale, state.view.scale);
    (state.trees || []).forEach(t => {
      drawTree(ctx, t, t.x, t.y, 1.0, { isSelf: t.id === state.selfTreeId });
    });
    ctx.restore();
  }

  return { render, resize, screenToWorld };
}
