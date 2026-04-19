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
