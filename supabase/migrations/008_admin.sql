-- rooms.admin_passcode_hash
alter table public.rooms add column if not exists admin_passcode_hash text;

-- 既存の room は admin_passcode='admin' で初期化
update public.rooms
set admin_passcode_hash = extensions.crypt('admin', extensions.gen_salt('bf'))
where admin_passcode_hash is null;

-- ===== RPC: set_admin_passcode (初回 or 既存admin_tokenで上書き) =====
create or replace function public.set_admin_passcode(
  p_slug text,
  p_current_passcode text, -- 既存管理者passcode。初回セットアップなら空文字 '' でも可
  p_new_passcode text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room public.rooms%rowtype;
begin
  if coalesce(length(p_new_passcode),0) < 4 then
    raise exception 'new passcode too short';
  end if;
  select * into v_room from public.rooms where slug = p_slug;
  if not found then raise exception 'room not found'; end if;
  -- 現passcodeが 'admin'(デフォルト) の場合は誰でも変更可、それ以外は現passcode必須
  if v_room.admin_passcode_hash = extensions.crypt('admin', v_room.admin_passcode_hash) then
    -- デフォルト中: 誰でも初期化可能
    null;
  else
    if v_room.admin_passcode_hash <> extensions.crypt(coalesce(p_current_passcode,''), v_room.admin_passcode_hash) then
      raise exception 'current passcode mismatch';
    end if;
  end if;
  update public.rooms
    set admin_passcode_hash = extensions.crypt(p_new_passcode, extensions.gen_salt('bf'))
    where id = v_room.id;
end;
$fn$;

-- ===== helper: sign_admin_token =====
create or replace function public.sign_admin_token(p_room_id uuid)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_secret text := (select value from public._config where key = 'jwt_secret');
  v_header text;
  v_payload text;
  v_unsigned text;
  v_sig text;
begin
  if coalesce(v_secret,'') = '' then raise exception 'jwt_secret not configured'; end if;
  v_header := translate(encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'), 'base64'), E'\n\r=', '');
  v_header := translate(v_header, '+/', '-_');
  v_payload := translate(encode(convert_to(
    json_build_object(
      'kind', 'admin',
      'room_id', p_room_id,
      'exp', extract(epoch from now())::int + 14 * 24 * 3600
    )::text, 'UTF8'), 'base64'), E'\n\r=', '');
  v_payload := translate(v_payload, '+/', '-_');
  v_unsigned := v_header || '.' || v_payload;
  v_sig := translate(encode(extensions.hmac(v_unsigned, v_secret, 'sha256'), 'base64'), E'\n\r=', '');
  v_sig := translate(v_sig, '+/', '-_');
  return v_unsigned || '.' || v_sig;
end;
$fn$;

-- ===== helper: verify_admin_token → room_id =====
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
  return (v_payload->>'room_id')::uuid;
end;
$fn$;

-- ===== RPC: admin_login =====
create or replace function public.admin_login(p_slug text, p_passcode text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where slug = p_slug;
  if not found then raise exception 'room not found'; end if;
  if v_room.admin_passcode_hash is null or
     v_room.admin_passcode_hash <> extensions.crypt(p_passcode, v_room.admin_passcode_hash) then
    raise exception 'admin passcode mismatch';
  end if;
  return public.sign_admin_token(v_room.id);
end;
$fn$;

-- ===== 既存RPCを admin_token も受け付けるよう拡張 =====
drop function if exists public.upsert_node(text, uuid, uuid, text, smallint, text, smallint, text, numeric, numeric, uuid);

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
) returns public.nodes
language plpgsql security definer
set search_path = public, pg_temp
as $un$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_admin_room uuid;
  v_tree_row public.trees%rowtype;
  v_row public.nodes;
begin
  -- まず edit_token として検証、失敗したら admin_token として検証
  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_tid <> p_tree_id then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      v_admin_room := public.verify_admin_token(p_edit_token);
      select * into v_tree_row from public.trees where id = p_tree_id;
      if not found or v_tree_row.room_id <> v_admin_room then
        raise exception 'admin not authorized for this tree';
      end if;
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

create or replace function public.delete_node(p_edit_token text, p_node_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $dn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_admin_room uuid;
  v_node_tree uuid;
  v_tree_row public.trees%rowtype;
begin
  select tree_id into v_node_tree from public.nodes where id = p_node_id;
  if v_node_tree is null then raise exception 'node not found'; end if;

  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_node_tree <> v_tid then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      v_admin_room := public.verify_admin_token(p_edit_token);
      select * into v_tree_row from public.trees where id = v_node_tree;
      if v_tree_row.room_id <> v_admin_room then
        raise exception 'admin not authorized';
      end if;
    exception when others then
      raise exception 'unauthorized';
    end;
  end;

  delete from public.nodes where id = p_node_id;
  update public.trees set updated_at = now() where id = v_node_tree;
end;
$dn$;

create or replace function public.update_tree_position(
  p_edit_token text,
  p_tree_id uuid,
  p_x numeric,
  p_y numeric
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $utp$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_admin_room uuid;
  v_tree_row public.trees%rowtype;
begin
  begin
    v_tid := public.verify_edit_token(p_edit_token);
    if v_tid <> p_tree_id then raise exception 'token/tree mismatch'; end if;
  exception when others then
    begin
      v_admin_room := public.verify_admin_token(p_edit_token);
      select * into v_tree_row from public.trees where id = p_tree_id;
      if not found or v_tree_row.room_id <> v_admin_room then
        raise exception 'admin not authorized';
      end if;
    exception when others then
      raise exception 'unauthorized';
    end;
  end;
  update public.trees set x = p_x, y = p_y, updated_at = now()
   where id = p_tree_id;
end;
$utp$;
