// moritetu1st 用の森ビュー
//   - ノードは色付きの放射状バースト(selftree の葉と同等の描画)
//   - エッジは無向グラフ — 蛇行する枝で接続
//   - 空白ダブルタップ/クリックで新規ノード作成(インライン入力)
//   - ノードドラッグ:
//       空白へドロップ → 位置移動
//       他ノードへドロップ → エッジ接続/解除(toggle)
//   - シングルタップで詳細パネルを開く

import { drawRadialBurst, drawMeanderingBranch, drawGlow, drawLeafIcon } from './tree.js';
import { atmosphereAt } from './atmosphere.js';
import { Critters, drawBackgroundCanopies } from './critters.js';
import { drawWeather } from './weather.js';
import { stringHash } from './utils.js';

export function createMoriForest(canvas, state) {
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 0, H = 0;
  const critters = new Critters(() => state.ambience);
  let lastTickAt = performance.now();
  let inlineInput = null; // { el, x, y } 新規作成インライン入力中

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
  let pinch = null;
  let lastTapAt = 0, lastTapPos = null;

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

  function nodeRadius(n) {
    return 22 + (n.size || 3) * 5;
  }

  function hitTest(sx, sy, excludeId) {
    const w = screenToWorld(sx, sy);
    const nodes = state.moriNodes || [];
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (excludeId && n.id === excludeId) continue;
      const r = n._r || nodeRadius(n);
      const dx = w.x - (n._displayX ?? n.x);
      const dy = w.y - (n._displayY ?? n.y);
      if (dx*dx + dy*dy <= r*r) return n;
    }
    return null;
  }

  function onDown(e) {
    if (inlineInput) return; // 入力中はドラッグ無効
    const p = pt(e);
    const hit = hitTest(p.x, p.y);
    const world = screenToWorld(p.x, p.y);
    drag = { start: p, last: p, moved: 0, startWorld: world, mode: hit ? 'drag-node' : 'pan', hit };
    if (hit) {
      hit._dragging = true;
      drag.origX = hit.x;
      drag.origY = hit.y;
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
    if (drag.mode === 'drag-node') {
      drag.hit.x = drag.origX + worldDx;
      drag.hit.y = drag.origY + worldDy;
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
    if (d.hit) d.hit._dragging = false;

    const now = Date.now();
    const movedTap = d.moved < 6;

    if (d.mode === 'drag-node' && d.hit && !movedTap) {
      // ドロップ位置に他ノードがあれば toggle、なければ位置保存
      const dropped = hitTest(d.last.x, d.last.y, d.hit.id);
      if (dropped) {
        // 位置は元に戻す(エッジ操作のためのドロップ)
        d.hit.x = d.origX; d.hit.y = d.origY;
        if (state.onMoriToggleEdge) state.onMoriToggleEdge(d.hit, dropped);
      } else {
        if (state.onMoriNodeMoved) state.onMoriNodeMoved(d.hit);
      }
      render();
      return;
    }

    // タップ系の判定
    if (movedTap) {
      // ダブルタップ判定(同じ位置 + 350ms 以内)
      if (lastTapAt && (now - lastTapAt) < 350 && lastTapPos &&
          Math.hypot(d.last.x - lastTapPos.x, d.last.y - lastTapPos.y) < 16) {
        lastTapAt = 0; lastTapPos = null;
        if (!d.hit && state.onMoriEmptyDblTap) {
          const w = screenToWorld(d.last.x, d.last.y);
          openInlineInput(d.last.x, d.last.y, w.x, w.y);
        }
        return;
      }
      lastTapAt = now;
      lastTapPos = { x: d.last.x, y: d.last.y };
      // シングルタップ
      if (d.hit && state.onMoriNodeTap) state.onMoriNodeTap(d.hit);
      else if (state.onMoriEmptyTap) state.onMoriEmptyTap();
    }
  }

  function openInlineInput(sx, sy, wx, wy) {
    closeInlineInput();
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 40;
    input.placeholder = '名前を入れて Enter';
    input.className = 'mori-inline-input';
    input.style.left = sx + 'px';
    input.style.top = sy + 'px';
    document.body.appendChild(input);
    setTimeout(() => input.focus(), 10);
    inlineInput = { el: input, wx, wy };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text && state.onMoriCreateNode) state.onMoriCreateNode(text, wx, wy);
        closeInlineInput();
      } else if (e.key === 'Escape') {
        closeInlineInput();
      }
    });
    input.addEventListener('blur', () => {
      // 何も入力していなければ閉じる
      if (!input.value.trim()) closeInlineInput();
    });
  }
  function closeInlineInput() {
    if (inlineInput?.el) inlineInput.el.remove();
    inlineInput = null;
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
  // ダブルクリック(マウス)
  canvas.addEventListener('dblclick', (e) => {
    if (inlineInput) return;
    const p = pt(e);
    const hit = hitTest(p.x, p.y);
    if (hit) return; // ノード上は無視
    const w = screenToWorld(p.x, p.y);
    openInlineInput(p.x, p.y, w.x, w.y);
  });
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

    const nodes = state.moriNodes || [];
    const totalNodes = nodes.length;
    const roomSeed = (state.room?.slug || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 42;
    drawBackgroundCanopies(ctx, W, H, totalNodes, roomSeed, state.ambience?.canopyDensity ?? 0.5);

    ctx.save();
    ctx.translate(state.view.ox, state.view.oy);
    ctx.scale(state.view.scale, state.view.scale);

    // ノードの簡易ゆらぎ(時間で sin)
    const t = now / 1000;
    nodes.forEach((n) => {
      const seed = stringHash(n.id || n.text || 'n');
      const ph = (seed % 1009) * 0.01;
      const amp = 12;
      const sx = Math.sin(t * 0.13 + ph) * amp + Math.sin(t * 0.063 + ph * 1.7) * amp * 0.4;
      const sy = Math.cos(t * 0.105 + ph * 1.3) * amp + Math.cos(t * 0.048 + ph * 0.9) * amp * 0.35;
      n._displayX = (n._dragging ? n.x : n.x + sx);
      n._displayY = (n._dragging ? n.y : n.y + sy);
      n._r = nodeRadius(n);
    });

    // エッジ(蛇行する枝で結ぶ)
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    (state.moriEdges || []).forEach((e, idx) => {
      const a = nodeById.get(e.a), b = nodeById.get(e.b);
      if (!a || !b) return;
      const seed = stringHash((e.a || '') + ':' + (e.b || '') + ':' + idx);
      const wStart = 4, wEnd = 4;
      drawMeanderingBranch(ctx, a._displayX, a._displayY, b._displayX, b._displayY, wStart, wEnd, seed,
        'rgba(122, 108, 92, 0.7)', { meander: state.design?.branchMeander ?? 0.5 });
    });

    // ノード(放射状バースト + glow)
    nodes.forEach((n) => {
      const col = n.color || '#5a9b6e';
      const stroke = darken(col, 0.4);
      drawGlow(ctx, n._displayX, n._displayY, n._r, col);
      drawRadialBurst(ctx, n._displayX, n._displayY, n._r, stringHash(n.id || n.text || 'n'),
        col, stroke, { densityMul: 1.1, design: state.design });

      // ラベル
      const labelBg = 'rgba(31, 26, 21, 0.55)';
      const labelFg = '#f4ede0';
      ctx.save();
      ctx.font = `${Math.max(11, n._r * 0.42)}px 'Klee One', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(n.text).width;
      const rectX = n._displayX - tw/2 - 4;
      const rectY = n._displayY - 9;
      const rectW = tw + 8;
      const rectH = 18;
      ctx.fillStyle = labelBg;
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.fillStyle = labelFg;
      ctx.fillText(n.text, n._displayX, n._displayY);
      ctx.restore();

      // 説明があれば朱色の葉アイコン
      if (n.description) {
        drawLeafIcon(ctx, rectX, rectY, Math.PI / 4, 18, '#dc4124',
          stringHash(n.id || n.text || 'leaf'));
      }
    });

    ctx.restore();
    critters.render(ctx);
    drawWeather(ctx, W, H, state.weather, now, state.ambience);
  }

  return { render, resize, screenToWorld, closeInlineInput };
}

function darken(hex, f) {
  if (!hex || hex[0] !== '#') return hex || '#333';
  const r = parseInt(hex.slice(1, 3), 16) * (1 - f);
  const g = parseInt(hex.slice(3, 5), 16) * (1 - f);
  const b = parseInt(hex.slice(5, 7), 16) * (1 - f);
  const h = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
