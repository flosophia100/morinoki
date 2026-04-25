-- 025_page_views.sql
-- 部屋ごとのアクセス統計(日別PV) + 管理者向け取得 RPC
--
-- record_page_view(room_slug)
--   → 匿名OK。今日の (room_id, date) のカウントを +1。
--   日付は Asia/Tokyo (JST) で計算する。
--
-- admin_get_stats(admin_token, room_slug, days)
--   → 直近 N 日分の日別:
--      - page_view (record_page_view からの累積)
--      - new_tree  (trees.created_at)
--      - new_node  (nodes.created_at)
--      および合計樹数/合計枝数を返す。

create table if not exists public.page_views (
  room_id uuid not null references public.rooms(id) on delete cascade,
  d date not null,                          -- JST 基準の日
  count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, d)
);
alter table public.page_views enable row level security;
create index if not exists idx_page_views_room_d on public.page_views(room_id, d desc);

-- 匿名から呼び出される。room_slug 単位で増分のみ。
create or replace function public.record_page_view(p_room_slug text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_today date;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then return; end if; -- 静かに無視
  v_today := (now() at time zone 'Asia/Tokyo')::date;
  insert into public.page_views(room_id, d, count, updated_at)
    values (v_room_id, v_today, 1, now())
    on conflict (room_id, d) do update
      set count = public.page_views.count + 1,
          updated_at = now();
end;
$fn$;

-- 管理者向け統計取得
create or replace function public.admin_get_stats(
  p_admin_token text, p_room_slug text, p_days int default 30
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_days int;
  v_from date;
  v_to date;
  v_pv json;
  v_trees json;
  v_nodes json;
  v_total_trees bigint;
  v_total_nodes bigint;
  v_total_pv bigint;
begin
  perform public.verify_admin_token(p_admin_token);
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  v_days := greatest(1, least(coalesce(p_days, 30), 365));
  v_to := (now() at time zone 'Asia/Tokyo')::date;
  v_from := v_to - (v_days - 1);

  -- 日別PV(欠損日は 0 で埋める)
  with series as (
    select generate_series(v_from, v_to, interval '1 day')::date as d
  ),
  pv as (
    select s.d,
           coalesce(p.count, 0)::bigint as count
    from series s
    left join public.page_views p
      on p.room_id = v_room_id and p.d = s.d
    order by s.d
  )
  select json_agg(json_build_object('d', d, 'count', count)) into v_pv from pv;

  -- 日別 新規樹(trees.created_at を JST date に丸める)
  with series as (
    select generate_series(v_from, v_to, interval '1 day')::date as d
  ),
  tr as (
    select s.d,
           coalesce(count(t.id), 0)::bigint as count
    from series s
    left join public.trees t
      on t.room_id = v_room_id
     and ((t.created_at at time zone 'Asia/Tokyo')::date = s.d)
    group by s.d
    order by s.d
  )
  select json_agg(json_build_object('d', d, 'count', count)) into v_trees from tr;

  -- 日別 新規枝(nodes — その部屋の樹に属するもののみ)
  with series as (
    select generate_series(v_from, v_to, interval '1 day')::date as d
  ),
  nd as (
    select s.d,
           coalesce(count(n.id), 0)::bigint as count
    from series s
    left join public.nodes n
      on ((n.created_at at time zone 'Asia/Tokyo')::date = s.d)
     and n.tree_id in (select id from public.trees where room_id = v_room_id)
    group by s.d
    order by s.d
  )
  select json_agg(json_build_object('d', d, 'count', count)) into v_nodes from nd;

  -- 合計
  select count(*) into v_total_trees from public.trees where room_id = v_room_id;
  select count(*) into v_total_nodes from public.nodes
    where tree_id in (select id from public.trees where room_id = v_room_id);
  select coalesce(sum(count),0) into v_total_pv from public.page_views where room_id = v_room_id;

  return json_build_object(
    'days', v_days,
    'from', v_from,
    'to',   v_to,
    'page_views', v_pv,
    'new_trees',  v_trees,
    'new_nodes',  v_nodes,
    'total_trees', v_total_trees,
    'total_nodes', v_total_nodes,
    'total_page_views', v_total_pv
  );
end;
$fn$;
