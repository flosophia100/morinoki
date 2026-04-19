import { supabase } from './supabase.js';

// ルーム内の trees/nodes 変更を購読し、onChange で通知
// onChange は debounce して呼ぶ想定
export function subscribeRoom(roomId, treeIdsRef, onChange) {
  console.log('[realtime] subscribeRoom called, roomId=', roomId);
  if (!supabase) { console.warn('[realtime] supabase null'); return () => {}; }

  const channel = supabase
    .channel(`morinoki-room-${roomId}`, { config: { broadcast: { self: true } } })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trees' },
      (payload) => {
        console.log('[realtime] tree INSERT:', payload.new?.name);
        if (payload.new?.room_id === roomId) onChange({ source: 'trees', payload });
      })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trees' },
      (payload) => {
        console.log('[realtime] tree UPDATE:', payload.new?.name);
        if (payload.new?.room_id === roomId) onChange({ source: 'trees', payload });
      })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'trees' },
      (payload) => {
        console.log('[realtime] tree DELETE:', payload.old?.id);
        if (payload.old?.room_id === roomId) onChange({ source: 'trees', payload });
      })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nodes' },
      (payload) => {
        console.log('[realtime] node INSERT:', payload.new?.text, 'tree=', payload.new?.tree_id);
        if (treeIdsRef.has(payload.new?.tree_id)) onChange({ source: 'nodes', payload });
      })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nodes' },
      (payload) => {
        console.log('[realtime] node UPDATE:', payload.new?.text, 'tree=', payload.new?.tree_id);
        if (treeIdsRef.has(payload.new?.tree_id)) onChange({ source: 'nodes', payload });
      })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'nodes' },
      (payload) => {
        console.log('[realtime] node DELETE:', payload.old?.id);
        if (treeIdsRef.has(payload.old?.tree_id)) onChange({ source: 'nodes', payload });
      })
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
