-- 016 管理者による幹の直接作成
-- メール認証フロー無しで幹を作れる管理者特権
-- passcode_hash, recovery_key_hash はランダム値で埋める(ユーザーログインはできない)

create or replace function public.admin_create_tree(
  p_admin_token text, p_room_slug text, p_name text
) returns public.trees
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_seed bigint;
  v_tree public.trees%rowtype;
  v_random_pass text;
  v_random_rec text;
begin
  perform public.verify_admin_token(p_admin_token);
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if exists (select 1 from public.trees where room_id = v_room_id and name = p_name) then
    raise exception 'この名前はすでに使われています';
  end if;
  v_random_pass := encode(extensions.gen_random_bytes(24), 'hex');
  v_random_rec  := encode(extensions.gen_random_bytes(24), 'hex');
  v_seed := abs(hashtext(p_name || v_random_pass))::bigint;
  insert into public.trees(room_id, name, passcode_hash, recovery_key_hash, seed)
    values (v_room_id, p_name,
            extensions.crypt(v_random_pass, extensions.gen_salt('bf')),
            extensions.crypt(v_random_rec,  extensions.gen_salt('bf')),
            v_seed)
    returning * into v_tree;
  return v_tree;
end;
$fn$;
