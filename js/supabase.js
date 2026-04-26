import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.SUPABASE_CONFIG;
if (!cfg || !cfg.url || !cfg.anonKey) {
  console.warn('SUPABASE_CONFIG is not set. Edit index.html / room.html.');
}

export const supabase = cfg && cfg.url
  ? createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false },
      // Realtime: accessToken callback を明示。未設定だと anon接続で TIMED_OUT する
      accessToken: async () => cfg.anonKey,
      realtime: { params: { apikey: cfg.anonKey, eventsPerSecond: 10 } }
    })
  : null;

// 明示的にsetAuthしてaccessTokenValueを即時セット(subscribe時にTIMED_OUT回避)
export const realtimeReady = supabase
  ? supabase.realtime.setAuth(cfg.anonKey).catch((e) => console.warn('setAuth failed:', e))
  : Promise.resolve();

function rpc(name, args) {
  if (!supabase) return Promise.reject(new Error('Supabase not configured'));
  return supabase.rpc(name, args).then(({ data, error }) => {
    if (error) throw new Error(error.message || String(error));
    return data;
  });
}

export const api = {
  // 森作成はグローバル管理者のみ(admin_token必須)
  createRoom: (adminToken, slug, name, fieldType = 'selftree') =>
    rpc('create_room', { p_admin_token: adminToken, p_slug: slug, p_name: name, p_field_type: fieldType }),
  deleteRoom: (adminToken, slug) =>
    rpc('delete_room', { p_admin_token: adminToken, p_slug: slug }),
  listRooms: (adminToken) =>
    rpc('list_rooms', { p_admin_token: adminToken }),
  adminCreateTree: (adminToken, roomSlug, name) =>
    rpc('admin_create_tree', { p_admin_token: adminToken, p_room_slug: roomSlug, p_name: name }),
  setAdminCredentials: (currentToken, newLoginId, newPasscode) =>
    rpc('set_admin_credentials', {
      p_current_token: currentToken,
      p_new_login_id: newLoginId,
      p_new_passcode: newPasscode,
    }),
  createTree: (roomSlug, name, passcode, email) =>
    rpc('create_tree', { p_room_slug: roomSlug, p_name: name, p_passcode: passcode, p_email: email || null }),
  authTree: (treeId, secret) =>
    rpc('auth_tree', { p_tree_id: treeId, p_secret: secret }),
  plantOrLogin: (roomSlug, name, passcode, email) =>
    rpc('plant_or_login', { p_room_slug: roomSlug, p_name: name, p_passcode: passcode, p_email: email || null }),
  loginTree: (roomSlug, name, passcode) =>
    rpc('login_tree', { p_room_slug: roomSlug, p_name: name, p_passcode: passcode }),
  plantTree: (roomSlug, name, passcode, email) =>
    rpc('plant_tree', { p_room_slug: roomSlug, p_name: name, p_passcode: passcode, p_email: email || null }),
  requestTreeRegistration: (roomSlug, name, passcode, email, baseUrl) =>
    rpc('request_tree_registration', {
      p_room_slug: roomSlug, p_name: name, p_passcode: passcode,
      p_email: email, p_base_url: baseUrl || null,
    }),
  verifyRegistration: (token) =>
    rpc('verify_registration', { p_token: token }),
  requestPasscodeReset: (roomSlug, name, baseUrl) =>
    rpc('request_passcode_reset', { p_room_slug: roomSlug, p_name: name, p_base_url: baseUrl || null }),
  verifyPasscodeReset: (token, newPasscode) =>
    rpc('verify_passcode_reset', { p_token: token, p_new_passcode: newPasscode }),
  requestPasscodeChange: (editToken, newPasscode, baseUrl) =>
    rpc('request_passcode_change', { p_edit_token: editToken, p_new_passcode: newPasscode, p_base_url: baseUrl || null }),
  requestEmailChange: (editToken, newEmail, baseUrl) =>
    rpc('request_email_change', { p_edit_token: editToken, p_new_email: newEmail, p_base_url: baseUrl || null }),
  requestTreeSelfDeletion: (editToken, baseUrl) =>
    rpc('request_tree_self_deletion', { p_edit_token: editToken, p_base_url: baseUrl || null }),
  verifyCredentialChange: (token) =>
    rpc('verify_credential_change', { p_token: token }),
  // Tips: ユーザー側
  listUnreadTips: (editToken, roomSlug, limit = 10) =>
    rpc('list_unread_tips', { p_edit_token: editToken, p_room_slug: roomSlug, p_limit: limit }),
  markTipRead: (editToken, tipId) =>
    rpc('mark_tip_read', { p_edit_token: editToken, p_tip_id: tipId }),
  // Tips: 管理者
  adminListTips: (adminToken, roomSlug) =>
    rpc('admin_list_tips', { p_admin_token: adminToken, p_room_slug: roomSlug }),
  adminCreateTip: (adminToken, roomSlug, title, body, enabled = true) =>
    rpc('admin_create_tip', { p_admin_token: adminToken, p_room_slug: roomSlug, p_title: title, p_body: body, p_enabled: enabled }),
  adminUpdateTip: (adminToken, tipId, title, body, enabled) =>
    rpc('admin_update_tip', { p_admin_token: adminToken, p_tip_id: tipId, p_title: title, p_body: body, p_enabled: enabled }),
  adminDeleteTip: (adminToken, tipId) =>
    rpc('admin_delete_tip', { p_admin_token: adminToken, p_tip_id: tipId }),
  adminListTipReads: (adminToken, tipId) =>
    rpc('admin_list_tip_reads', { p_admin_token: adminToken, p_tip_id: tipId }),
  // 統計
  recordPageView: (roomSlug) =>
    rpc('record_page_view', { p_room_slug: roomSlug }),
  adminGetStats: (adminToken, roomSlug, days = 30) =>
    rpc('admin_get_stats', { p_admin_token: adminToken, p_room_slug: roomSlug, p_days: days }),
  // moritetu1st 公開 RPC
  moriList: (roomSlug) => rpc('mori_list', { p_room_slug: roomSlug }),
  moriCreateNode: (roomSlug, anonId, text, color, x, y) =>
    rpc('mori_create_node', { p_room_slug: roomSlug, p_anon_id: anonId, p_text: text, p_color: color || null, p_x: x, p_y: y }),
  moriUpdateNode: (roomSlug, anonId, nodeId, { text, color, description, size }) =>
    rpc('mori_update_node', {
      p_room_slug: roomSlug, p_anon_id: anonId, p_node_id: nodeId,
      p_text: text ?? null, p_color: color ?? null,
      p_description: description ?? null, p_size: size ?? null
    }),
  moriMoveNode: (roomSlug, anonId, nodeId, x, y) =>
    rpc('mori_move_node', { p_room_slug: roomSlug, p_anon_id: anonId, p_node_id: nodeId, p_x: x, p_y: y }),
  moriDeleteNode: (roomSlug, anonId, nodeId) =>
    rpc('mori_delete_node', { p_room_slug: roomSlug, p_anon_id: anonId, p_node_id: nodeId }),
  moriToggleEdge: (roomSlug, anonId, aId, bId) =>
    rpc('mori_toggle_edge', { p_room_slug: roomSlug, p_anon_id: anonId, p_a: aId, p_b: bId }),
  recordRoomVisit: (roomSlug, anonId) =>
    rpc('record_room_visit', { p_room_slug: roomSlug, p_anon_id: anonId }),
  getRoomMessage: (roomSlug) => rpc('get_room_message', { p_room_slug: roomSlug }),
  adminSetRoomMessage: (adminToken, roomSlug, message) =>
    rpc('admin_set_room_message', { p_admin_token: adminToken, p_room_slug: roomSlug, p_message: message }),
  adminGetUniqueUsersHourly: (adminToken, roomSlug, days = 7) =>
    rpc('admin_get_unique_users_hourly', { p_admin_token: adminToken, p_room_slug: roomSlug, p_days: days }),
  adminListActiveUsers: (adminToken, roomSlug, withinMinutes = 30) =>
    rpc('admin_list_active_users', { p_admin_token: adminToken, p_room_slug: roomSlug, p_within_minutes: withinMinutes }),
  adminMoriResetRoom: (adminToken, roomSlug) =>
    rpc('admin_mori_reset_room', { p_admin_token: adminToken, p_room_slug: roomSlug }),
  adminListUsers: (adminToken, roomSlug) =>
    rpc('admin_list_users', { p_admin_token: adminToken, p_room_slug: roomSlug }),
  adminDeleteUser: (adminToken, treeId) =>
    rpc('admin_delete_user', { p_admin_token: adminToken, p_tree_id: treeId }),
  adminResetUserPasscode: (adminToken, treeId) =>
    rpc('admin_reset_user_passcode', { p_admin_token: adminToken, p_tree_id: treeId }),
  adminSetUserEmail: (adminToken, treeId, newEmail) =>
    rpc('admin_set_user_email', { p_admin_token: adminToken, p_tree_id: treeId, p_new_email: newEmail }),
  setRoomAmbience: (adminToken, slug, ambience) =>
    rpc('set_room_ambience', { p_admin_token: adminToken, p_slug: slug, p_ambience: ambience }),
  adminLogin: (loginId, passcode) =>
    rpc('admin_login', { p_login_id: loginId, p_passcode: passcode }),
  setRoomDesign: (adminToken, slug, design) =>
    rpc('set_room_design', { p_admin_token: adminToken, p_slug: slug, p_design: design }),
  upsertNode: (token, treeId, node) => {
    const args = {
      p_edit_token: token, p_tree_id: treeId,
      p_id: node.id || null, p_text: node.text,
      p_size: node.size, p_color: node.color, p_ord: node.ord || 0,
      p_description: node.description === undefined ? null : node.description,
      p_offset_x: node.offset_x === undefined ? null : node.offset_x,
      p_offset_y: node.offset_y === undefined ? null : node.offset_y,
    };
    // migration 003 適用後のみ parent_id を送信。未適用でもトップレベルは動作
    if (node.parent_id) args.p_parent_id = node.parent_id;
    return rpc('upsert_node', args);
  },
  clearNodeField: (token, nodeId, field) =>
    rpc('clear_node_field', { p_edit_token: token, p_node_id: nodeId, p_field: field }),
  reparentNode: (token, nodeId, newParentId) =>
    rpc('reparent_node', { p_edit_token: token, p_node_id: nodeId, p_new_parent_id: newParentId || null }),
  deleteNode: (token, nodeId) =>
    rpc('delete_node', { p_edit_token: token, p_node_id: nodeId }),
  updateTreePosition: (token, treeId, x, y) =>
    rpc('update_tree_position', { p_edit_token: token, p_tree_id: treeId, p_x: x, p_y: y }),
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
