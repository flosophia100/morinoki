import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.SUPABASE_CONFIG;
if (!cfg || !cfg.url || !cfg.anonKey) {
  console.warn('SUPABASE_CONFIG is not set. Edit index.html / room.html.');
}

export const supabase = cfg && cfg.url
  ? createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } })
  : null;

function rpc(name, args) {
  if (!supabase) return Promise.reject(new Error('Supabase not configured'));
  return supabase.rpc(name, args).then(({ data, error }) => {
    if (error) throw new Error(error.message || String(error));
    return data;
  });
}

export const api = {
  createRoom: (slug, name) => rpc('create_room', { p_slug: slug, p_name: name }),
  createTree: (roomSlug, name, passcode, email) =>
    rpc('create_tree', { p_room_slug: roomSlug, p_name: name, p_passcode: passcode, p_email: email || null }),
  authTree: (treeId, secret) =>
    rpc('auth_tree', { p_tree_id: treeId, p_secret: secret }),
  upsertNode: (token, treeId, node) =>
    rpc('upsert_node', {
      p_edit_token: token, p_tree_id: treeId,
      p_id: node.id || null, p_text: node.text,
      p_size: node.size, p_color: node.color, p_ord: node.ord || 0
    }),
  deleteNode: (token, nodeId) =>
    rpc('delete_node', { p_edit_token: token, p_node_id: nodeId }),
  getRoomBySlug: (slug) =>
    supabase.from('rooms').select('*').eq('slug', slug).single()
      .then(({ data, error }) => { if (error) throw error; return data; }),
  getTrees: (roomId) =>
    supabase.from('trees').select('*').eq('room_id', roomId)
      .then(({ data, error }) => { if (error) throw error; return data; }),
  getNodes: (treeIds) =>
    supabase.from('nodes').select('*').in('tree_id', treeIds)
      .then(({ data, error }) => { if (error) throw error; return data; }),
};
