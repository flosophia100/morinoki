-- 015 グローバル管理者の導入
-- - admins テーブルを新設(login_id + passcode_hash)
-- - sign_admin_token / verify_admin_token を admin_id ベースに差し替え
-- - admin_login を login_id + passcode に
-- - create_room を admin_token 必須に変更
-- - delete_room / list_rooms を追加
-- - upsert_node / delete_node / update_tree_position / reparent_node / set_room_design を
--   「グローバル管理者なら無条件にOK」に更新(room_id一致チェック廃止)
-- - set_admin_passcode(森ごと) を廃止
-- - rooms.admin_passcode_hash は残すが以降は不使用(後の migration でdrop)

-- ---- admins ----
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  login_id text unique not null,
  passcode_hash text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.admins enable row level security;

-- ---- sign_admin_token: payload に admin_id(旧版は p_room_id だったので drop が必要) ----
drop function if exists public.sign_admin_token(uuid);
create or replace function public.sign_admin_token(p_admin_id uuid)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_secret text := (select value from public._config where key = 'jwt_secret');
  v_header text; v_payload text; v_unsigned text; v_sig text;
begin
  if coalesce(v_secret,'') = '' then raise exception 'jwt_secret not configured'; end if;
  v_header := translate(encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'), 'base64'), E'\n\r=', '');
  v_header := translate(v_header, '+/', '-_');
  v_payload := translate(encode(convert_to(
    json_build_object(
      'kind', 'admin',
      'admin_id', p_admin_id,
      'exp', extract(epoch from now())::int + 14 * 24 * 3600
    )::text, 'UTF8'), 'base64'), E'\n\r=', '');
  v_payload := translate(v_payload, '+/', '-_');
  v_unsigned := v_header || '.' || v_payload;
  v_sig := translate(encode(extensions.hmac(v_unsigned, v_secret, 'sha256'), 'base64'), E'\n\r=', '');
  v_sig := translate(v_sig, '+/', '-_');
  return v_unsigned || '.' || v_sig;
end;
$fn$;

-- ---- verify_admin_token: admin_id を返す ----
create or replace function public.verify_admin_token(p_token text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_parts text[]; v_secret text; v_unsigned text; v_expected text; v_payload jsonb; v_pad text;
begin
  v_secret := (select value from public._config where key = 'jwt_secret');
  if coalesce(v_secret,'') = '' then raise exception 'jwt_secret not configured'; end if;
  v_parts := string_to_array(p_token, '.');
  if array_length(v_parts, 1) <> 3 then raise exception 'bad token'; end if;
  v_unsigned := v_parts[1] || '.' || v_parts[2];
  v_expected := translate(encode(extensions.hmac(v_unsigned, v_secret, 'sha256'), 'base64'), E'\n\r=', '');
  v_expected := translate(v_expected, '+/', '-_');
  if v_expected <> v_parts[3] then raise exception 'bad signature'; end if;
  v_pad := translate(v_parts[2], '-_', '+/');
  v_pad := rpad(v_pad, ((length(v_pad)+3)/4)*4, '=');
  v_payload := convert_from(decode(v_pad, 'base64'), 'UTF8')::jsonb;
  if (v_payload->>'kind') <> 'admin' then raise exception 'not admin token'; end if;
  if (v_payload->>'exp')::int < extract(epoch from now())::int then raise exception 'token expired'; end if;
  -- 旧形式 (room_id) は admin_id が存在しないのでここでエラー
  if v_payload->>'admin_id' is null then raise exception 'legacy admin token, please re-login'; end if;
  return (v_payload->>'admin_id')::uuid;
end;
$fn$;

-- ---- admin_login: login_id + passcode ----
drop function if exists public.admin_login(text, text);
create or replace function public.admin_login(p_login_id text, p_passcode text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_admin public.admins%rowtype;
begin
  if coalesce(length(p_login_id),0) < 1 or coalesce(length(p_passcode),0) < 4 then
    raise exception 'admin login failed';
  end if;
  select * into v_admin from public.admins where login_id = p_login_id;
  if not found then raise exception 'admin login failed'; end if;
  if v_admin.passcode_hash <> extensions.crypt(p_passcode, v_admin.passcode_hash) then
    raise exception 'admin login failed';
  end if;
  return public.sign_admin_token(v_admin.id);
end;
$fn$;

-- ---- set_admin_credentials: 管理者自身の ID と合言葉を更新 ----
create or replace function public.set_admin_credentials(
  p_current_token text, p_new_login_id text, p_new_passcode text
) returns void language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_admin_id uuid;
begin
  v_admin_id := public.verify_admin_token(p_current_token);
  if coalesce(length(p_new_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_new_login_id),0) < 3 then raise exception 'login_id too short'; end if;
  update public.admins
    set login_id = p_new_login_id,
        passcode_hash = extensions.crypt(p_new_passcode, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_admin_id;
end;
$fn$;

-- ---- 旧 set_admin_passcode(森ごと) を廃止 ----
drop function if exists public.set_admin_passcode(text, text, text);

-- ---- create_room: admin_token 必須に差し替え ----
drop function if exists public.create_room(text, text);
create or replace function public.create_room(
  p_admin_token text, p_slug text, p_name text
) returns public.rooms language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_row public.rooms;
begin
  perform public.verify_admin_token(p_admin_token);
  if p_slug is null or length(p_slug) < 3 then raise exception 'slug too short'; end if;
  insert into public.rooms(slug, name) values (p_slug, p_name) returning * into v_row;
  return v_row;
end;
$fn$;

-- ---- delete_room ----
create or replace function public.delete_room(p_admin_token text, p_slug text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  delete from public.rooms where slug = p_slug;  -- trees/nodes は CASCADE
end;
$fn$;

-- ---- list_rooms: 一覧+ツリー/ノード数 ----
create or replace function public.list_rooms(p_admin_token text)
returns table(
  id uuid, slug text, name text, created_at timestamptz,
  tree_count int, node_count int
) language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  return query
  select r.id, r.slug, r.name, r.created_at,
         (select count(*)::int from public.trees t where t.room_id = r.id) as tree_count,
         (select count(*)::int from public.nodes n
            where n.tree_id in (select t.id from public.trees t where t.room_id = r.id)) as node_count
  from public.rooms r
  order by r.created_at desc;
end;
$fn$;

-- =====================================================================
-- 既存RPCの admin_token 扱いを「グローバル管理者は全件OK」に更新
-- =====================================================================

-- upsert_node
create or replace function public.upsert_node(
  p_edit_token text,
  p_tree_id uuid,
  p_id uuid,
  p_text text,
  p_size smallint,
  p_color text,
  p_ord smallint,
  p_description text default null,
  p_offset_x numeric default null,
  p_offset_y numeric default null,
  p_parent_id uuid default null
) returns public.nodes language plpgsql security definer
set search_path = public, pg_temp
as $un$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_row public.nodes;
begin
  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_tid <> p_tree_id then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      perform public.verify_admin_token(p_edit_token);
      -- グローバル管理者は全件OK
    exception when others then
      raise exception 'unauthorized';
    end;
  end;

  if p_parent_id is not null then
    if not exists (select 1 from public.nodes where id = p_parent_id and tree_id = p_tree_id) then
      raise exception 'parent not in same tree';
    end if;
  end if;

  if p_id is null then
    insert into public.nodes(tree_id, text, size, color, ord, description, offset_x, offset_y, parent_id)
      values (p_tree_id, p_text, coalesce(p_size,3),
              coalesce(p_color,'#5a6b3e'), coalesce(p_ord,0),
              p_description, p_offset_x, p_offset_y, p_parent_id)
      returning * into v_row;
  else
    update public.nodes n
       set text = p_text,
           size = coalesce(p_size, n.size),
           color = coalesce(p_color, n.color),
           ord = coalesce(p_ord, n.ord),
           description = coalesce(p_description, n.description),
           offset_x = coalesce(p_offset_x, n.offset_x),
           offset_y = coalesce(p_offset_y, n.offset_y)
     where n.id = p_id and n.tree_id = p_tree_id
     returning n.* into v_row;
    if not found then raise exception 'node not found'; end if;
  end if;
  update public.trees set updated_at = now() where id = p_tree_id;
  return v_row;
end;
$un$;

-- delete_node
create or replace function public.delete_node(p_edit_token text, p_node_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $dn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_node_tree uuid;
begin
  select tree_id into v_node_tree from public.nodes where id = p_node_id;
  if v_node_tree is null then raise exception 'node not found'; end if;
  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_node_tree <> v_tid then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      perform public.verify_admin_token(p_edit_token);
    exception when others then
      raise exception 'unauthorized';
    end;
  end;
  delete from public.nodes where id = p_node_id;
  update public.trees set updated_at = now() where id = v_node_tree;
end;
$dn$;

-- update_tree_position
create or replace function public.update_tree_position(
  p_edit_token text, p_tree_id uuid, p_x numeric, p_y numeric
) returns void language plpgsql security definer
set search_path = public, pg_temp
as $utp$
#variable_conflict use_variable
declare
  v_tid uuid;
begin
  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_tid <> p_tree_id then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      perform public.verify_admin_token(p_edit_token);
    exception when others then
      raise exception 'unauthorized';
    end;
  end;
  update public.trees set x = p_x, y = p_y, updated_at = now() where id = p_tree_id;
end;
$utp$;

-- reparent_node
create or replace function public.reparent_node(
  p_edit_token text, p_node_id uuid, p_new_parent_id uuid
) returns public.nodes language plpgsql security definer
set search_path = public, pg_temp
as $rn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_node public.nodes%rowtype;
  v_cur uuid;
begin
  select * into v_node from public.nodes where id = p_node_id;
  if not found then raise exception 'node not found'; end if;
  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_tid <> v_node.tree_id then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      perform public.verify_admin_token(p_edit_token);
    exception when others then
      raise exception 'unauthorized';
    end;
  end;

  if p_new_parent_id is not null then
    if not exists (select 1 from public.nodes where id = p_new_parent_id and tree_id = v_node.tree_id) then
      raise exception 'parent not in same tree';
    end if;
    if p_new_parent_id = p_node_id then raise exception 'cannot parent to self'; end if;
    v_cur := (select parent_id from public.nodes where id = p_new_parent_id);
    while v_cur is not null loop
      if v_cur = p_node_id then raise exception 'circular parent'; end if;
      select parent_id into v_cur from public.nodes where id = v_cur;
    end loop;
  end if;

  update public.nodes
    set parent_id = p_new_parent_id, offset_x = null, offset_y = null
    where id = p_node_id
    returning * into v_node;
  update public.trees set updated_at = now() where id = v_node.tree_id;
  return v_node;
end;
$rn$;

-- set_room_design: slug引数を追加(admin tokenから room_id を取れなくなったため)
drop function if exists public.set_room_design(text, jsonb);
create or replace function public.set_room_design(
  p_admin_token text, p_slug text, p_design jsonb
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $srd$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  update public.rooms set design = p_design where slug = p_slug;
  return p_design;
end;
$srd$;
