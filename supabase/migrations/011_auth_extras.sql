-- 011 認証の整理
-- - login_tree: 既存名前+合言葉でログインのみ。名前が無ければエラー
-- - plant_tree: 新規植樹のみ。名前が既存ならエラー(重複不可)
-- - update_tree_credentials: edit_token で合言葉/メールを変更
-- - request_passcode_reset: メール登録済なら再設定トークンを記録(実送信はEdgeFunctionで別途)
-- 既存の plant_or_login は互換のため残す(非推奨)

-- ---- login_tree ----
create or replace function public.login_tree(
  p_room_slug text,
  p_name text,
  p_passcode text
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
begin
  if coalesce(length(p_passcode), 0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name), 0) < 1 then raise exception 'name required'; end if;

  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;

  select * into v_tree from public.trees where room_id = v_room_id and name = p_name;
  if not found then
    raise exception 'その名前の樹は見つかりません';
  end if;
  if v_tree.passcode_hash = extensions.crypt(p_passcode, v_tree.passcode_hash)
     or v_tree.recovery_key_hash = extensions.crypt(p_passcode, v_tree.recovery_key_hash) then
    v_token := public.sign_edit_token(v_tree.id);
    return json_build_object('kind', 'login', 'tree_id', v_tree.id, 'edit_token', v_token);
  end if;
  raise exception '合言葉が違います';
end;
$fn$;

-- ---- plant_tree ----
create or replace function public.plant_tree(
  p_room_slug text,
  p_name text,
  p_passcode text,
  p_email text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_recovery text;
  v_seed bigint;
begin
  if coalesce(length(p_passcode), 0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name), 0) < 1 then raise exception 'name required'; end if;

  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;

  -- 既存名チェック
  if exists (select 1 from public.trees where room_id = v_room_id and name = p_name) then
    raise exception 'この名前はすでに使われています';
  end if;

  v_recovery := encode(extensions.gen_random_bytes(8), 'hex');
  v_seed := abs(hashtext(p_name || v_recovery))::bigint;
  insert into public.trees(room_id, name, passcode_hash, recovery_key_hash, recovery_email, seed)
    values (v_room_id, p_name,
            extensions.crypt(p_passcode, extensions.gen_salt('bf')),
            extensions.crypt(v_recovery, extensions.gen_salt('bf')),
            nullif(p_email, ''),
            v_seed)
    returning * into v_tree;

  v_token := public.sign_edit_token(v_tree.id);
  return json_build_object(
    'kind', 'planted',
    'tree_id', v_tree.id,
    'edit_token', v_token,
    'recovery_key', v_recovery
  );
end;
$fn$;

-- ---- update_tree_credentials ----
-- p_new_passcode が null/空 → 合言葉は変更しない
-- p_new_email が null → メールは変更しない。空文字 '' → メール解除
create or replace function public.update_tree_credentials(
  p_edit_token text,
  p_new_passcode text,
  p_new_email text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tid uuid;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  if p_new_passcode is not null and length(p_new_passcode) > 0 then
    if length(p_new_passcode) < 4 then raise exception 'passcode too short'; end if;
    update public.trees
      set passcode_hash = extensions.crypt(p_new_passcode, extensions.gen_salt('bf')),
          updated_at = now()
      where id = v_tid;
  end if;
  if p_new_email is not null then
    update public.trees
      set recovery_email = nullif(p_new_email, ''),
          updated_at = now()
      where id = v_tid;
  end if;
end;
$fn$;

-- ---- reparent_node ----
-- ノードの親を付け替える(D&Dでの並び替え用)。循環防止。
-- p_new_parent_id が null なら「親なし(トップレベル)」に戻す。
create or replace function public.reparent_node(
  p_edit_token text,
  p_node_id uuid,
  p_new_parent_id uuid
) returns public.nodes
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_admin_room uuid;
  v_tree_row public.trees%rowtype;
  v_node public.nodes%rowtype;
  v_new_parent public.nodes%rowtype;
  v_cur uuid;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if not found then raise exception 'node not found'; end if;

  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_tid <> v_node.tree_id then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      v_admin_room := public.verify_admin_token(p_edit_token);
      select * into v_tree_row from public.trees where id = v_node.tree_id;
      if v_tree_row.room_id <> v_admin_room then raise exception 'admin not authorized'; end if;
    exception when others then
      raise exception 'unauthorized';
    end;
  end;

  if p_new_parent_id is not null then
    select * into v_new_parent from public.nodes
      where id = p_new_parent_id and tree_id = v_node.tree_id;
    if not found then raise exception 'parent not in same tree'; end if;
    -- 自己親禁止
    if p_new_parent_id = p_node_id then raise exception 'cannot parent to self'; end if;
    -- 循環チェック: 新しい親の祖先に自分が含まれていないこと
    v_cur := v_new_parent.parent_id;
    while v_cur is not null loop
      if v_cur = p_node_id then raise exception 'circular parent'; end if;
      select parent_id into v_cur from public.nodes where id = v_cur;
    end loop;
  end if;

  update public.nodes
    set parent_id = p_new_parent_id,
        offset_x = null, offset_y = null   -- 位置リセット(新しい親基準の配置に任せる)
    where id = p_node_id
    returning * into v_node;
  update public.trees set updated_at = now() where id = v_node.tree_id;
  return v_node;
end;
$fn$;

-- ---- passcode reset queue ----
-- EdgeFunctionが読み取って実メール送信を行う想定
create table if not exists public.passcode_reset_queue (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  email text not null,
  reset_token text not null,     -- メール本文に入れる一時トークン(新しい復元キー)
  created_at timestamptz default now(),
  sent_at timestamptz
);
alter table public.passcode_reset_queue enable row level security;
-- RLS: クライアントからは一切見えない。security definer 関数のみアクセス

-- ---- request_passcode_reset ----
-- メール登録済ならキューに追加。新しい復元キーを発行しtreeに保存。
-- 返却: { sent: true } or { sent: false }
create or replace function public.request_passcode_reset(
  p_room_slug text,
  p_name text
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_recovery text;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  select * into v_tree from public.trees where room_id = v_room_id and name = p_name;
  if not found then
    -- 情報漏洩しないよう沈黙
    return json_build_object('sent', false);
  end if;
  if v_tree.recovery_email is null or length(v_tree.recovery_email) = 0 then
    return json_build_object('sent', false);
  end if;
  v_recovery := encode(extensions.gen_random_bytes(8), 'hex');
  update public.trees
    set recovery_key_hash = extensions.crypt(v_recovery, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_tree.id;
  insert into public.passcode_reset_queue(tree_id, email, reset_token)
    values (v_tree.id, v_tree.recovery_email, v_recovery);
  return json_build_object('sent', true);
end;
$fn$;
