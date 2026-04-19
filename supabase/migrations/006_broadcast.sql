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
