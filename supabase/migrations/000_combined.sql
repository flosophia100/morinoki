-- ===== Extensions =====
create extension if not exists pgcrypto;

-- ===== Tables =====
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text,
  created_at timestamptz default now()
);

create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  passcode_hash text not null,
  recovery_key_hash text not null,
  recovery_email text,
  seed bigint not null,
  x numeric default 0,
  y numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  text text not null,
  size smallint default 3 check (size between 1 and 5),
  color text default '#5a6b3e',
  ord smallint default 0,
  created_at timestamptz default now()
);

create index if not exists idx_trees_room on public.trees(room_id);
create index if not exists idx_nodes_tree on public.nodes(tree_id);

-- ===== RLS =====
alter table public.rooms enable row level security;
alter table public.trees enable row level security;
alter table public.nodes enable row level security;

drop policy if exists "public read rooms" on public.rooms;
drop policy if exists "public read trees" on public.trees;
drop policy if exists "public read nodes" on public.nodes;
create policy "public read rooms" on public.rooms for select using (true);
create policy "public read trees" on public.trees for select using (true);
create policy "public read nodes" on public.nodes for select using (true);

-- ===== _config テーブル(シークレット格納用、RLSで全遮断) =====
create table if not exists public._config (
  key text primary key,
  value text not null
);
alter table public._config enable row level security;
-- policyを作らない → 通常クライアントからは完全にアクセス不可。security definer関数だけが読める
-- jwt_secret は別途 `insert into public._config(key,value) values('jwt_secret','...')` で設定する

-- ===== helper: sign_edit_token =====
create or replace function public.sign_edit_token(p_tree_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $sign$
#variable_conflict use_variable
declare
  v_secret text;
  v_header text;
  v_payload text;
  v_unsigned text;
  v_sig text;
begin
  v_secret := (select value from public._config where key = 'jwt_secret');
  if coalesce(v_secret,'') = '' then
    raise exception 'jwt_secret not configured';
  end if;
  v_header := translate(encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'), 'base64'), E'\n\r=', '');
  v_header := translate(v_header, '+/', '-_');
  v_payload := translate(encode(convert_to(
    json_build_object(
      'tree_id', p_tree_id,
      'exp', extract(epoch from now())::int + 7 * 24 * 3600
    )::text, 'UTF8'), 'base64'), E'\n\r=', '');
  v_payload := translate(v_payload, '+/', '-_');
  v_unsigned := v_header || '.' || v_payload;
  v_sig := translate(encode(extensions.hmac(v_unsigned, v_secret, 'sha256'), 'base64'), E'\n\r=', '');
  v_sig := translate(v_sig, '+/', '-_');
  return v_unsigned || '.' || v_sig;
end;
$sign$;

-- ===== helper: verify_edit_token =====
create or replace function public.verify_edit_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $verify$
#variable_conflict use_variable
declare
  v_parts text[];
  v_secret text;
  v_unsigned text;
  v_expected text;
  v_payload jsonb;
  v_pad text;
begin
  v_secret := (select value from public._config where key = 'jwt_secret');
  if coalesce(v_secret,'') = '' then
    raise exception 'jwt_secret not configured';
  end if;
  v_parts := string_to_array(p_token, '.');
  if array_length(v_parts, 1) <> 3 then
    raise exception 'bad token';
  end if;
  v_unsigned := v_parts[1] || '.' || v_parts[2];
  v_expected := translate(encode(extensions.hmac(v_unsigned, v_secret, 'sha256'), 'base64'), E'\n\r=', '');
  v_expected := translate(v_expected, '+/', '-_');
  if v_expected <> v_parts[3] then
    raise exception 'bad signature';
  end if;
  v_pad := translate(v_parts[2], '-_', '+/');
  v_pad := rpad(v_pad, ((length(v_pad)+3)/4)*4, '=');
  v_payload := convert_from(decode(v_pad, 'base64'), 'UTF8')::jsonb;
  if (v_payload->>'exp')::int < extract(epoch from now())::int then
    raise exception 'token expired';
  end if;
  return (v_payload->>'tree_id')::uuid;
end;
$verify$;

-- ===== RPC: create_room =====
create or replace function public.create_room(p_slug text, p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $cr$
#variable_conflict use_variable
declare
  v_row public.rooms;
begin
  if p_slug is null or length(p_slug) < 3 then
    raise exception 'slug too short';
  end if;
  insert into public.rooms(slug, name)
    values (p_slug, p_name)
    returning * into v_row;
  return v_row;
end;
$cr$;

-- ===== RPC: create_tree =====
create or replace function public.create_tree(
  p_room_slug text,
  p_name text,
  p_passcode text,
  p_email text
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $ct$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_recovery text;
  v_seed bigint;
  v_tree_id uuid;
begin
  if coalesce(length(p_passcode), 0) < 4 then
    raise exception 'passcode too short';
  end if;

  v_room_id := (select r.id from public.rooms r where r.slug = p_room_slug limit 1);
  if v_room_id is null then
    raise exception 'room not found';
  end if;

  v_recovery := encode(extensions.gen_random_bytes(8), 'hex');
  v_seed := abs(hashtext(p_name || v_recovery))::bigint;

  insert into public.trees(room_id, name, passcode_hash, recovery_key_hash, recovery_email, seed)
    values (
      v_room_id,
      p_name,
      extensions.crypt(p_passcode, extensions.gen_salt('bf')),
      extensions.crypt(v_recovery, extensions.gen_salt('bf')),
      nullif(p_email, ''),
      v_seed
    )
    returning id into v_tree_id;

  return json_build_object('tree_id', v_tree_id, 'recovery_key', v_recovery);
end;
$ct$;

-- ===== RPC: auth_tree =====
create or replace function public.auth_tree(p_tree_id uuid, p_secret text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $at$
#variable_conflict use_variable
declare
  v_row public.trees%rowtype;
begin
  select * into v_row from public.trees where id = p_tree_id;
  if not found then
    raise exception 'tree not found';
  end if;
  if v_row.passcode_hash = extensions.crypt(p_secret, v_row.passcode_hash)
     or v_row.recovery_key_hash = extensions.crypt(p_secret, v_row.recovery_key_hash) then
    return public.sign_edit_token(p_tree_id);
  end if;
  raise exception 'unauthorized';
end;
$at$;

-- ===== RPC: upsert_node =====
create or replace function public.upsert_node(
  p_edit_token text,
  p_tree_id uuid,
  p_id uuid,
  p_text text,
  p_size smallint,
  p_color text,
  p_ord smallint
)
returns public.nodes
language plpgsql
security definer
set search_path = public, pg_temp
as $un$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_row public.nodes;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  if v_tid <> p_tree_id then
    raise exception 'token/tree mismatch';
  end if;

  if p_id is null then
    insert into public.nodes(tree_id, text, size, color, ord)
      values (p_tree_id, p_text, coalesce(p_size, 3),
              coalesce(p_color, '#5a6b3e'), coalesce(p_ord, 0))
      returning * into v_row;
  else
    update public.nodes n
       set text = p_text,
           size = coalesce(p_size, n.size),
           color = coalesce(p_color, n.color),
           ord = coalesce(p_ord, n.ord)
     where n.id = p_id and n.tree_id = p_tree_id
     returning n.* into v_row;
    if not found then
      raise exception 'node not found';
    end if;
  end if;

  update public.trees set updated_at = now() where id = p_tree_id;
  return v_row;
end;
$un$;

-- ===== RPC: delete_node =====
create or replace function public.delete_node(p_edit_token text, p_node_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $dn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_node_tree uuid;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  v_node_tree := (select tree_id from public.nodes where id = p_node_id);
  if v_node_tree is null then
    raise exception 'node not found';
  end if;
  if v_node_tree <> v_tid then
    raise exception 'token/tree mismatch';
  end if;
  delete from public.nodes where id = p_node_id;
  update public.trees set updated_at = now() where id = v_tid;
end;
$dn$;
-- ===== 追加カラム =====
alter table public.nodes add column if not exists description text;
alter table public.nodes add column if not exists offset_x numeric;
alter table public.nodes add column if not exists offset_y numeric;

-- ===== upsert_node をdescription/offset対応へ差し替え =====
drop function if exists public.upsert_node(text, uuid, uuid, text, smallint, text, smallint);

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
  p_offset_y numeric default null
)
returns public.nodes
language plpgsql
security definer
set search_path = public, pg_temp
as $un$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_row public.nodes;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  if v_tid <> p_tree_id then
    raise exception 'token/tree mismatch';
  end if;

  if p_id is null then
    insert into public.nodes(tree_id, text, size, color, ord, description, offset_x, offset_y)
      values (p_tree_id, p_text, coalesce(p_size, 3),
              coalesce(p_color, '#5a6b3e'), coalesce(p_ord, 0),
              p_description, p_offset_x, p_offset_y)
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
    if not found then
      raise exception 'node not found';
    end if;
  end if;

  update public.trees set updated_at = now() where id = p_tree_id;
  return v_row;
end;
$un$;

-- ===== 明示的にdescriptionやoffsetをNULLに戻すためのRPC =====
create or replace function public.clear_node_field(
  p_edit_token text,
  p_node_id uuid,
  p_field text
) returns public.nodes
language plpgsql
security definer
set search_path = public, pg_temp
as $cnf$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_row public.nodes;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  if p_field not in ('description', 'offset') then
    raise exception 'bad field';
  end if;

  if p_field = 'description' then
    update public.nodes set description = null
     where id = p_node_id and tree_id = v_tid
     returning * into v_row;
  else
    update public.nodes set offset_x = null, offset_y = null
     where id = p_node_id and tree_id = v_tid
     returning * into v_row;
  end if;

  if not found then raise exception 'node not found'; end if;
  return v_row;
end;
$cnf$;

-- ===== 樹の位置更新RPC(ドラッグで移動) =====
create or replace function public.update_tree_position(
  p_edit_token text,
  p_tree_id uuid,
  p_x numeric,
  p_y numeric
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $utp$
#variable_conflict use_variable
declare
  v_tid uuid;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  if v_tid <> p_tree_id then
    raise exception 'token/tree mismatch';
  end if;
  update public.trees set x = p_x, y = p_y, updated_at = now()
   where id = p_tree_id;
end;
$utp$;
-- ===== nodes.parent_id (孫ノード対応) =====
alter table public.nodes add column if not exists parent_id uuid;

-- 外部キー: 親ノード削除で子孫も連鎖削除
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'nodes_parent_fk'
      and conrelid = 'public.nodes'::regclass
  ) then
    alter table public.nodes
      add constraint nodes_parent_fk
      foreign key (parent_id) references public.nodes(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_nodes_parent on public.nodes(parent_id);

-- ===== upsert_node: p_parent_id 追加 =====
drop function if exists public.upsert_node(text, uuid, uuid, text, smallint, text, smallint, text, numeric, numeric);

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
)
returns public.nodes
language plpgsql
security definer
set search_path = public, pg_temp
as $un$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_row public.nodes;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  if v_tid <> p_tree_id then
    raise exception 'token/tree mismatch';
  end if;

  -- 親ノードが同一樹に属することを検証
  if p_parent_id is not null then
    if not exists (select 1 from public.nodes where id = p_parent_id and tree_id = p_tree_id) then
      raise exception 'parent not in same tree';
    end if;
  end if;

  if p_id is null then
    insert into public.nodes(tree_id, text, size, color, ord, description, offset_x, offset_y, parent_id)
      values (p_tree_id, p_text, coalesce(p_size, 3),
              coalesce(p_color, '#5a6b3e'), coalesce(p_ord, 0),
              p_description, p_offset_x, p_offset_y, p_parent_id)
      returning * into v_row;
  else
    -- parent_id は更新不可(構造の安定性のため)
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
    if not found then
      raise exception 'node not found';
    end if;
  end if;

  update public.trees set updated_at = now() where id = p_tree_id;
  return v_row;
end;
$un$;
-- ===== Realtime publication に trees / nodes を追加 =====
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trees'
  ) then
    alter publication supabase_realtime add table public.trees;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nodes'
  ) then
    alter publication supabase_realtime add table public.nodes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
end $$;
-- Realtime: UPDATEイベントで旧値を含むよう REPLICA IDENTITY FULL に
alter table public.trees replica identity full;
alter table public.nodes replica identity full;
alter table public.rooms replica identity full;

-- anon/authenticated に明示的な SELECT 権限(RLSがあるので実質安全)
grant select on public.rooms to anon, authenticated;
grant select on public.trees to anon, authenticated;
grant select on public.nodes to anon, authenticated;
-- postgres_changes が slot 問題で動作しないため、Broadcast API に切り替え
-- 各テーブルの INSERT/UPDATE/DELETE で realtime.send() を呼ぶトリガーを仕掛ける

-- trees 用トリガ
create or replace function public.notify_tree_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime, pg_temp
as $fn$
declare
  v_room uuid;
begin
  v_room := coalesce(new.room_id, old.room_id);
  if v_room is null then return coalesce(new, old); end if;
  perform realtime.send(
    jsonb_build_object(
      'op', tg_op,
      'tree_id', coalesce(new.id, old.id)::text,
      'tree_name', coalesce(new.name, old.name)
    ),
    'tree_change',
    'room:' || v_room::text,
    false -- private=false: 誰でも購読OK
  );
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists trg_notify_tree on public.trees;
create trigger trg_notify_tree
  after insert or update or delete on public.trees
  for each row execute function public.notify_tree_change();

-- nodes 用トリガ (tree_id 経由で room_id を取得)
create or replace function public.notify_node_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime, pg_temp
as $fn$
declare
  v_room uuid;
  v_tid uuid;
begin
  v_tid := coalesce(new.tree_id, old.tree_id);
  select room_id into v_room from public.trees where id = v_tid;
  if v_room is null then return coalesce(new, old); end if;
  perform realtime.send(
    jsonb_build_object(
      'op', tg_op,
      'tree_id', v_tid::text,
      'node_id', coalesce(new.id, old.id)::text,
      'node_text', coalesce(new.text, old.text)
    ),
    'node_change',
    'room:' || v_room::text,
    false
  );
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists trg_notify_node on public.nodes;
create trigger trg_notify_node
  after insert or update or delete on public.nodes
  for each row execute function public.notify_node_change();

-- realtime.messages テーブルのpolicyはデフォルトで anon が broadcast 受信可のはず
-- もし private=false の broadcast を anon が受けられなければ以下を追加
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='realtime' and tablename='messages' and policyname='allow_public_broadcast_read'
  ) then
    create policy "allow_public_broadcast_read" on realtime.messages
      for select using (true);
  end if;
end $$;
