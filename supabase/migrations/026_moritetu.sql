-- 026_moritetu.sql
-- 並列フィールドタイプ + moritetu1st 部屋
--
-- 構成:
--   rooms.field_type ('selftree' | 'moritetu1st' …)
--   room_nodes      … moritetu のノード(完全wiki)
--   room_node_edges … 無向グラフのエッジ(canonical a < b)
--   room_messages   … 部屋ヘッダーの管理者メッセージ
--   anon_sessions   … 匿名訪問者の 5分bucket(ユニーク UU 計算用)
--
-- スパム対策:
--   ノード作成: anon_id ごとに直近1秒1件 / 1分20件
--   ノード更新/移動/エッジ切替: 1秒1回
--   ノード削除: 1分5件
--   1部屋ノード上限 2000、text 40字、description 300字

------------------------------------------------------------
-- 1) rooms に field_type を追加
------------------------------------------------------------
alter table public.rooms
  add column if not exists field_type text not null default 'selftree';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_field_type_check') then
    alter table public.rooms
      add constraint rooms_field_type_check
      check (field_type in ('selftree','moritetu1st'));
  end if;
end $$;

------------------------------------------------------------
-- 2) room_nodes(moritetu1st 用ノード)
------------------------------------------------------------
create table if not exists public.room_nodes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  text text not null,
  color text not null default '#5a9b6e',
  description text,
  x numeric not null default 0,
  y numeric not null default 0,
  size int not null default 3,
  created_by_anon uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.room_nodes enable row level security;
create index if not exists idx_room_nodes_room on public.room_nodes(room_id, created_at);
create index if not exists idx_room_nodes_anon_created on public.room_nodes(created_by_anon, created_at desc);

------------------------------------------------------------
-- 3) room_node_edges(無向グラフ。a<b で重複防止)
------------------------------------------------------------
create table if not exists public.room_node_edges (
  room_id uuid not null references public.rooms(id) on delete cascade,
  a_id uuid not null references public.room_nodes(id) on delete cascade,
  b_id uuid not null references public.room_nodes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, a_id, b_id),
  check (a_id < b_id)
);
alter table public.room_node_edges enable row level security;
create index if not exists idx_room_node_edges_room on public.room_node_edges(room_id);

------------------------------------------------------------
-- 4) 部屋メッセージ
------------------------------------------------------------
create table if not exists public.room_messages (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  message text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;

------------------------------------------------------------
-- 5) anon_sessions(5分bucket での匿名訪問記録)
------------------------------------------------------------
create table if not exists public.anon_sessions (
  anon_id uuid not null,
  room_id uuid not null references public.rooms(id) on delete cascade,
  bucket_start timestamptz not null,
  primary key (anon_id, room_id, bucket_start)
);
alter table public.anon_sessions enable row level security;
create index if not exists idx_anon_sessions_room_bucket on public.anon_sessions(room_id, bucket_start desc);

------------------------------------------------------------
-- 6) helper: 5分bucket 始端
------------------------------------------------------------
create or replace function public._bucket_5min(p_ts timestamptz)
returns timestamptz language sql immutable as $$
  select date_trunc('hour', p_ts) +
         (floor(extract(minute from p_ts) / 5)::int * 5) * interval '1 minute';
$$;

------------------------------------------------------------
-- 7) helper: スパム制限
------------------------------------------------------------
create or replace function public._mori_throttle_create(p_anon uuid)
returns void language plpgsql as $fn$
declare
  v_recent_sec int;
  v_recent_min int;
begin
  if p_anon is null then return; end if;
  select count(*) into v_recent_sec from public.room_nodes
    where created_by_anon = p_anon and created_at > now() - interval '1 second';
  if v_recent_sec >= 1 then raise exception 'too fast (create)'; end if;
  select count(*) into v_recent_min from public.room_nodes
    where created_by_anon = p_anon and created_at > now() - interval '1 minute';
  if v_recent_min >= 20 then raise exception 'too many creates per minute'; end if;
end;
$fn$;

------------------------------------------------------------
-- 8) ユーザー側 RPC: 一括取得
------------------------------------------------------------
create or replace function public.mori_list(p_room_slug text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_nodes json;
  v_edges json;
  v_msg text;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_nodes from (
    select id, text, color, description, x, y, size, created_at, updated_at
    from public.room_nodes where room_id = v_room_id order by created_at
  ) t;

  select coalesce(json_agg(json_build_object('a', a_id, 'b', b_id)), '[]'::json)
    into v_edges from public.room_node_edges where room_id = v_room_id;

  select coalesce(message, '') into v_msg from public.room_messages where room_id = v_room_id;
  return json_build_object('nodes', v_nodes, 'edges', v_edges, 'message', coalesce(v_msg, ''));
end;
$fn$;

------------------------------------------------------------
-- 9) ノード作成
------------------------------------------------------------
create or replace function public.mori_create_node(
  p_room_slug text, p_anon_id uuid, p_text text,
  p_color text default '#5a9b6e',
  p_x numeric default 0, p_y numeric default 0
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_count int;
  v_id uuid;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if length(coalesce(trim(p_text), '')) = 0 then raise exception 'text required'; end if;
  if length(p_text) > 40 then raise exception 'text too long (max 40)'; end if;

  select count(*) into v_count from public.room_nodes where room_id = v_room_id;
  if v_count >= 2000 then raise exception 'node limit reached for this room'; end if;

  perform public._mori_throttle_create(p_anon_id);

  insert into public.room_nodes(room_id, text, color, x, y, created_by_anon)
    values (v_room_id, p_text, coalesce(p_color, '#5a9b6e'), coalesce(p_x, 0), coalesce(p_y, 0), p_anon_id)
    returning id into v_id;
  return v_id;
end;
$fn$;

------------------------------------------------------------
-- 10) ノード更新(text/color/description/size)
------------------------------------------------------------
create or replace function public.mori_update_node(
  p_room_slug text, p_anon_id uuid, p_node_id uuid,
  p_text text, p_color text, p_description text, p_size int
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_recent int;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if p_text is not null and length(p_text) > 40 then raise exception 'text too long (max 40)'; end if;
  if p_description is not null and length(p_description) > 300 then raise exception 'description too long (max 300)'; end if;

  -- 1秒1回のスロットル(本人 + 部屋単位)
  if p_anon_id is not null then
    select count(*) into v_recent from public.room_nodes
      where room_id = v_room_id and created_by_anon = p_anon_id
        and updated_at > now() - interval '1 second';
    if v_recent >= 1 then raise exception 'too fast (update)'; end if;
  end if;

  update public.room_nodes
    set text        = coalesce(p_text, text),
        color       = coalesce(p_color, color),
        description = coalesce(p_description, description),
        size        = coalesce(p_size, size),
        updated_at  = now()
    where id = p_node_id and room_id = v_room_id;
end;
$fn$;

------------------------------------------------------------
-- 11) ノード位置移動(高頻度OKだが1秒1回でセーフ)
------------------------------------------------------------
create or replace function public.mori_move_node(
  p_room_slug text, p_anon_id uuid, p_node_id uuid,
  p_x numeric, p_y numeric
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  update public.room_nodes
    set x = p_x, y = p_y, updated_at = now()
    where id = p_node_id and room_id = v_room_id;
end;
$fn$;

------------------------------------------------------------
-- 12) ノード削除
------------------------------------------------------------
create or replace function public.mori_delete_node(
  p_room_slug text, p_anon_id uuid, p_node_id uuid
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_recent int;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if p_anon_id is not null then
    select count(*) into v_recent from public.room_nodes
      where room_id = v_room_id and created_by_anon = p_anon_id
        and updated_at > now() - interval '1 minute';
    if v_recent >= 5 then raise exception 'too many deletes per minute'; end if;
  end if;
  delete from public.room_nodes where id = p_node_id and room_id = v_room_id;
end;
$fn$;

------------------------------------------------------------
-- 13) エッジ接続 / 解除(toggle)
------------------------------------------------------------
create or replace function public.mori_toggle_edge(
  p_room_slug text, p_anon_id uuid, p_a uuid, p_b uuid
) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_lo uuid;
  v_hi uuid;
  v_exists int;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if p_a = p_b then raise exception 'self-edge not allowed'; end if;

  if p_a < p_b then v_lo := p_a; v_hi := p_b; else v_lo := p_b; v_hi := p_a; end if;
  -- 両ノードが同部屋に属することを確認
  if (select count(*) from public.room_nodes
      where room_id = v_room_id and id in (v_lo, v_hi)) <> 2 then
    raise exception 'nodes not in this room';
  end if;

  select count(*) into v_exists from public.room_node_edges
    where room_id = v_room_id and a_id = v_lo and b_id = v_hi;
  if v_exists > 0 then
    delete from public.room_node_edges
      where room_id = v_room_id and a_id = v_lo and b_id = v_hi;
    return 'disconnected';
  else
    insert into public.room_node_edges(room_id, a_id, b_id) values (v_room_id, v_lo, v_hi);
    return 'connected';
  end if;
end;
$fn$;

------------------------------------------------------------
-- 14) record_room_visit(匿名訪問記録 — 5分bucketに UPSERT)
------------------------------------------------------------
create or replace function public.record_room_visit(
  p_room_slug text, p_anon_id uuid
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_bucket timestamptz;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then return; end if;
  if p_anon_id is null then return; end if;
  v_bucket := public._bucket_5min(now());
  insert into public.anon_sessions(anon_id, room_id, bucket_start)
    values (p_anon_id, v_room_id, v_bucket)
    on conflict do nothing;
end;
$fn$;

------------------------------------------------------------
-- 15) get_room_message
------------------------------------------------------------
create or replace function public.get_room_message(p_room_slug text)
returns text
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_msg text;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then return ''; end if;
  select message into v_msg from public.room_messages where room_id = v_room_id;
  return coalesce(v_msg, '');
end;
$fn$;

------------------------------------------------------------
-- 16) admin_set_room_message
------------------------------------------------------------
create or replace function public.admin_set_room_message(
  p_admin_token text, p_room_slug text, p_message text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
begin
  perform public.verify_admin_token(p_admin_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  insert into public.room_messages(room_id, message, updated_at)
    values (v_room_id, coalesce(p_message, ''), now())
    on conflict (room_id) do update
      set message = excluded.message, updated_at = now();
end;
$fn$;

------------------------------------------------------------
-- 17) admin_get_unique_users_hourly
--   直近 days 日 × 時間帯(0..23) のユニーク UU 数
------------------------------------------------------------
create or replace function public.admin_get_unique_users_hourly(
  p_admin_token text, p_room_slug text, p_days int default 7
) returns table (d date, h int, unique_users bigint)
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_from timestamptz;
  v_to timestamptz;
begin
  perform public.verify_admin_token(p_admin_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  v_to := now();
  v_from := v_to - (greatest(1, least(coalesce(p_days, 7), 30)) || ' days')::interval;
  return query
    select (b.bucket at time zone 'Asia/Tokyo')::date as d,
           extract(hour from b.bucket at time zone 'Asia/Tokyo')::int as h,
           count(distinct a.anon_id)::bigint as unique_users
    from public.anon_sessions a,
         lateral (select date_trunc('hour', a.bucket_start) as bucket) b
    where a.room_id = v_room_id and a.bucket_start >= v_from and a.bucket_start <= v_to
    group by 1, 2
    order by 1, 2;
end;
$fn$;

------------------------------------------------------------
-- 18) admin_list_active_users(直近 N 分のユニーク UU 一覧)
------------------------------------------------------------
create or replace function public.admin_list_active_users(
  p_admin_token text, p_room_slug text, p_within_minutes int default 30
) returns table (anon_id uuid, first_seen timestamptz, last_seen timestamptz, buckets bigint)
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_since timestamptz;
begin
  perform public.verify_admin_token(p_admin_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  v_since := now() - (greatest(1, least(coalesce(p_within_minutes, 30), 1440)) || ' minutes')::interval;
  return query
    select a.anon_id,
           min(a.bucket_start) as first_seen,
           max(a.bucket_start) as last_seen,
           count(*)::bigint as buckets
    from public.anon_sessions a
    where a.room_id = v_room_id and a.bucket_start >= v_since
    group by a.anon_id
    order by max(a.bucket_start) desc;
end;
$fn$;

------------------------------------------------------------
-- 19) admin_mori_reset_room(部屋のノード/エッジを全削除)
------------------------------------------------------------
create or replace function public.admin_mori_reset_room(
  p_admin_token text, p_room_slug text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
begin
  perform public.verify_admin_token(p_admin_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  delete from public.room_node_edges where room_id = v_room_id;
  delete from public.room_nodes where room_id = v_room_id;
end;
$fn$;

------------------------------------------------------------
-- 20) Realtime Broadcast: room_nodes / room_node_edges / room_messages
--   既存の broadcast 仕組み(006_broadcast.sql)に合わせて trigger を追加
------------------------------------------------------------
create or replace function public._broadcast_room_change()
returns trigger
language plpgsql security definer as $fn$
declare
  v_room_id uuid;
  v_payload jsonb;
begin
  v_room_id := coalesce((new.room_id), (old.room_id));
  if v_room_id is null then return new; end if;
  v_payload := jsonb_build_object(
    'table', tg_table_name,
    'op', tg_op,
    'room_id', v_room_id,
    'at', now()
  );
  perform realtime.send(v_payload, 'room_change', 'room:' || v_room_id::text, true);
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists trg_room_nodes_broadcast on public.room_nodes;
create trigger trg_room_nodes_broadcast
  after insert or update or delete on public.room_nodes
  for each row execute function public._broadcast_room_change();

drop trigger if exists trg_room_node_edges_broadcast on public.room_node_edges;
create trigger trg_room_node_edges_broadcast
  after insert or delete on public.room_node_edges
  for each row execute function public._broadcast_room_change();

drop trigger if exists trg_room_messages_broadcast on public.room_messages;
create trigger trg_room_messages_broadcast
  after insert or update or delete on public.room_messages
  for each row execute function public._broadcast_room_change();

------------------------------------------------------------
-- 21) create_room を field_type 受け取りに拡張(後方互換: 省略時 'selftree')
------------------------------------------------------------
drop function if exists public.create_room(text, text, text);
create or replace function public.create_room(
  p_admin_token text, p_slug text, p_name text, p_field_type text default 'selftree'
) returns public.rooms language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_row public.rooms;
  v_type text;
begin
  perform public.verify_admin_token(p_admin_token);
  if p_slug is null or length(p_slug) < 3 then raise exception 'slug too short'; end if;
  v_type := coalesce(p_field_type, 'selftree');
  if v_type not in ('selftree','moritetu1st') then raise exception 'invalid field_type'; end if;
  insert into public.rooms(slug, name, field_type) values (p_slug, p_name, v_type) returning * into v_row;
  return v_row;
end;
$fn$;
