import { supabase } from './supabase.js';

// ルーム内の trees/nodes 変更を購読し、onChange で通知
// onChange は debounce して呼ぶ想定
export function subscribeRoom(roomId, treeIdsRef, onChange) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`morinoki-room-${roomId}`)
    // trees: room_id で絞り込み
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trees', filter: `room_id=eq.${roomId}` },
      (payload) => { onChange({ source: 'trees', payload }); }
    )
    // nodes: room_id カラムがないのでクライアント側で tree_id をチェック
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'nodes' },
      (payload) => {
        const row = payload.new || payload.old || {};
        if (treeIdsRef.has(row.tree_id)) {
          onChange({ source: 'nodes', payload });
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('[realtime] subscribed:', roomId);
      else if (status === 'CHANNEL_ERROR') console.warn('[realtime] channel error');
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
