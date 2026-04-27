import { supabase } from './supabase.js';

// Broadcast方式のRealtime購読 (postgres_changes 不使用)
// DBトリガ (006_broadcast.sql) が INSERT/UPDATE/DELETE で realtime.send() を呼ぶ
// onStatus(status): SUBSCRIBED | CLOSED | CHANNEL_ERROR | TIMED_OUT
export function subscribeRoom(roomId, _treeIdsRef, onChange, onStatus) {
  console.log('[realtime] subscribe room:', roomId);
  if (!supabase) return () => {};

  let channel = null;
  let disposed = false;
  let retryMs = 2000;
  let retryTimer = null;

  function connect() {
    if (disposed) return;
    const topic = 'room:' + roomId;
    channel = supabase
      .channel(topic, { config: { private: false } })
      .on('broadcast', { event: 'tree_change' }, (msg) => onChange({ source: 'trees', payload: msg.payload }))
      .on('broadcast', { event: 'node_change' }, (msg) => onChange({ source: 'nodes', payload: msg.payload }))
      .on('broadcast', { event: 'room_change' }, (msg) => onChange({ source: 'room', payload: msg.payload }))
      .subscribe((status, err) => {
        console.log('[realtime] subscribe status:', status, err?.message || '');
        onStatus && onStatus(status);
        if (status === 'SUBSCRIBED') {
          retryMs = 2000;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!disposed) scheduleReconnect();
        }
      });
  }

  function scheduleReconnect() {
    if (disposed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      try { if (channel) supabase.removeChannel(channel); } catch {}
      retryMs = Math.min(retryMs * 1.6, 20000);
      connect();
    }, retryMs);
  }

  connect();

  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    try { if (channel) supabase.removeChannel(channel); } catch {}
  };
}

export function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
