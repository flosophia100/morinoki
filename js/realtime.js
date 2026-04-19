import { supabase } from './supabase.js';

// Broadcast方式のRealtime購読 (postgres_changes 不使用)
// DBトリガ (006_broadcast.sql) が INSERT/UPDATE/DELETE で realtime.send() を呼ぶ
export function subscribeRoom(roomId, _treeIdsRef, onChange) {
  console.log('[realtime] subscribe room:', roomId);
  if (!supabase) return () => {};

  const topic = 'room:' + roomId;
  const channel = supabase
    .channel(topic, { config: { private: false } })
    .on('broadcast', { event: 'tree_change' }, (msg) => {
      console.log('[realtime] tree_change:', msg.payload);
      onChange({ source: 'trees', payload: msg.payload });
    })
    .on('broadcast', { event: 'node_change' }, (msg) => {
      console.log('[realtime] node_change:', msg.payload);
      onChange({ source: 'nodes', payload: msg.payload });
    })
    .subscribe((status, err) => {
      console.log('[realtime] subscribe status:', status, err?.message || '');
    });

  return () => {
    try { supabase.removeChannel(channel); } catch (e) {}
  };
}

export function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
