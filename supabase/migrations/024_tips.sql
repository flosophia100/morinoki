-- 024_tips.sql
-- Tips(お知らせ)システム
--   tips           : 管理者が登録するテキスト
--   tip_reads      : 各ユーザー(tree)の既読記録
--
-- ユーザー側:
--   list_unread_tips(edit_token, room_slug, limit) → 未読を古い順(制限付)
--   mark_tip_read(edit_token, tip_id)
--
-- 管理者側:
--   admin_list_tips(admin_token, room_slug) → tip + 既読数 + 全ユーザー数
--   admin_create_tip(admin_token, room_slug, title, body, enabled)
--   admin_update_tip(admin_token, tip_id, title, body, enabled)
--   admin_delete_tip(admin_token, tip_id)
--   admin_list_tip_reads(admin_token, tip_id) → (tree_id, tree_name, read_at)

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  body text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tips_room on public.tips(room_id, created_at);
alter table public.tips enable row level security;

create table if not exists public.tip_reads (
  tip_id uuid not null references public.tips(id) on delete cascade,
  tree_id uuid not null references public.trees(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (tip_id, tree_id)
);
create index if not exists idx_tip_reads_tree on public.tip_reads(tree_id);
alter table public.tip_reads enable row level security;

-- ===== User RPCs =====
create or replace function public.list_unread_tips(
  p_edit_token text, p_room_slug text, p_limit int default 10
) returns table (id uuid, title text, body text, created_at timestamptz)
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_room_id uuid;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  return query
    select t.id, t.title, t.body, t.created_at
    from public.tips t
    where t.room_id = v_room_id
      and t.enabled = true
      and not exists (
        select 1 from public.tip_reads r
        where r.tip_id = t.id and r.tree_id = v_tid
      )
    order by t.created_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50));
end;
$fn$;

create or replace function public.mark_tip_read(
  p_edit_token text, p_tip_id uuid
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tid uuid;
begin
  v_tid := public.verify_edit_token(p_edit_token);
  insert into public.tip_reads(tip_id, tree_id)
    values (p_tip_id, v_tid)
    on conflict (tip_id, tree_id) do nothing;
end;
$fn$;

-- ===== Admin RPCs =====
create or replace function public.admin_list_tips(
  p_admin_token text, p_room_slug text
) returns table (
  id uuid, title text, body text, enabled boolean,
  created_at timestamptz, updated_at timestamptz,
  read_count bigint, total_users bigint
)
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
  return query
    select t.id, t.title, t.body, t.enabled, t.created_at, t.updated_at,
           (select count(*) from public.tip_reads r where r.tip_id = t.id)::bigint as read_count,
           (select count(*) from public.trees tr where tr.room_id = t.room_id)::bigint as total_users
    from public.tips t
    where t.room_id = v_room_id
    order by t.created_at desc;
end;
$fn$;

create or replace function public.admin_create_tip(
  p_admin_token text, p_room_slug text,
  p_title text, p_body text, p_enabled boolean default true
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_id uuid;
begin
  perform public.verify_admin_token(p_admin_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if length(trim(coalesce(p_title,''))) = 0 then raise exception 'title required'; end if;
  if length(trim(coalesce(p_body,''))) = 0 then raise exception 'body required'; end if;
  insert into public.tips(room_id, title, body, enabled)
    values (v_room_id, p_title, p_body, coalesce(p_enabled, true))
    returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.admin_update_tip(
  p_admin_token text, p_tip_id uuid,
  p_title text, p_body text, p_enabled boolean
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  if length(trim(coalesce(p_title,''))) = 0 then raise exception 'title required'; end if;
  if length(trim(coalesce(p_body,''))) = 0 then raise exception 'body required'; end if;
  update public.tips
    set title = p_title, body = p_body,
        enabled = coalesce(p_enabled, true),
        updated_at = now()
    where id = p_tip_id;
end;
$fn$;

create or replace function public.admin_delete_tip(
  p_admin_token text, p_tip_id uuid
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  delete from public.tips where id = p_tip_id;
end;
$fn$;

create or replace function public.admin_list_tip_reads(
  p_admin_token text, p_tip_id uuid
) returns table (tree_id uuid, tree_name text, read_at timestamptz)
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  return query
    select r.tree_id, t.name, r.read_at
    from public.tip_reads r
    join public.trees t on t.id = r.tree_id
    where r.tip_id = p_tip_id
    order by r.read_at desc;
end;
$fn$;
