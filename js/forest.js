import { drawTree } from './tree.js';
import { seededRandom } from './utils.js';

export function layoutRandom(trees) {
  trees.forEach((t) => {
    const x = Number(t.x), y = Number(t.y);
    if (!isFinite(x) || !isFinite(y) || (x === 0 && y === 0)) {
      const rng = seededRandom(Number(t.seed) || 1);
      t.x = (rng() - 0.5) * 1000;
      t.y = (rng() - 0.5) * 1000;
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
  function onDown(e){ const p = pt(e); drag = { start: p, last: p, moved: 0 }; }
  function onMove(e){
    if (!drag) return;
    const p = pt(e);
    const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
    state.view.ox += dx; state.view.oy += dy;
    drag.last = p; drag.moved += Math.abs(dx) + Math.abs(dy);
    render();
  }
  function onWheel(e){
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
  function onClick(e) {
    const wasDrag = drag && drag.moved > 6;
    const p = pt(e);
    drag = null;
    if (wasDrag) return;
    const world = screenToWorld(p.x, p.y);
    const hit = (state.trees || []).slice().reverse().find(t => {
      const dx = world.x - t.x, dy = world.y - t.y;
      const r = 60 + (t.nodes?.length || 0) * 3;
      return dx*dx + dy*dy < r*r;
    });
    if (hit && state.onTreeTap) state.onTreeTap(hit);
    else if (state.onEmptyTap) state.onEmptyTap(world);
  }
  function screenToWorld(x, y) {
    return { x: (x - state.view.ox) / state.view.scale, y: (y - state.view.oy) / state.view.scale };
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', () => {});
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { onClick(e); });
  canvas.addEventListener('click', onClick);
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
      drawTree(ctx, t, t.x, t.y, 1.0, { highlight: t.id === state.selfTreeId });
    });
    ctx.restore();
  }

  return { render, resize, screenToWorld };
}
