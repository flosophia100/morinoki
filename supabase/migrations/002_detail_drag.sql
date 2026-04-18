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
