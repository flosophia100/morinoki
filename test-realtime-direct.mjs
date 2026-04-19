// node-sideから直接Supabase Realtimeに接続してみる
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const url = 'https://wlxqavbrarthldodiqyp.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHFhdmJyYXJ0aGxkb2RpcXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzIwMTIsImV4cCI6MjA5MjEwODAxMn0.Wagb6Qu-zD3v6Rw3L_HFUevhtxT2Z-EqQCAueqqbvQg';

const c = createClient(url, anon, {
  realtime: {
    params: { apikey: anon },
    log_level: 'info'
  }
});
console.log('supabase version ok, connecting...');

// Raw WS event logging
c.realtime.logger = (kind, msg, data) => {
  console.log('[rt.'+kind+']', msg, data ? JSON.stringify(data).slice(0,200) : '');
};

const channel = c.channel('test');
channel
  .on('postgres_changes', { event: '*', schema: 'public', table: 'trees' }, (p) => console.log('event:', p))
  .subscribe((status, err) => {
    console.log('subscribe status:', status, err?.message || '');
  });

// 30秒待つ
setTimeout(() => {
  console.log('timeout reached, shutting down');
  c.removeChannel(channel);
  process.exit(0);
}, 30000);
