import { supabase } from './supabase.js';

// ルーム内の trees/nodes 変更を購読し、onChange で通知
// onChange は debounce して呼ぶ想定
export function subscribeRoom(roomId, treeIdsRef, onChange) {
  console.log('[realtime] subscribeRoom called, roomId=', roomId);
  if (!supabase) { console.warn('[realtime] supabase null'); return () => {}; }

  const channel = supabase
    .channel(`morinoki-room-${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trees', filter: `room_id=eq.${roomId}` },
      (payload) => {
        console.log('[realtime] tree event:', payload.eventType, payload.new?.name || payload.old?.name);
        onChange({ source: 'trees', payload });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'nodes' },
      (payload) => {
        const row = payload.new || payload.old || {};
        console.log('[realtime] node event:', payload.eventType, 'tree_id=', row.tree_id, 'text=', row.text);
        if (treeIdsRef.has(row.tree_id)) {
          onChange({ source: 'nodes', payload });
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[realtime] subscribe status:', status, err?.message || '');
    });

  return () => {
    try { supabase.removeChannel(channel); } catch (e) {}
  };
}

// 単純な debounce
export function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
