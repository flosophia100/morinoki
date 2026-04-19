-- 一人一樹制約: (room_id, name) の組を unique に
-- 既存の重複を統合せず、新規に制約だけ追加(既に重複があれば失敗するが、
-- 本番データはテスト用のみなので必要なら手動で掃除してから実行する)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trees_room_name_unique'
  ) then
    -- 重複があれば最古のみ残し、それ以外を削除(安全なクリーンアップ)
    delete from public.trees t
    using public.trees older
    where t.room_id = older.room_id
      and t.name = older.name
      and t.created_at > older.created_at;
    alter table public.trees
      add constraint trees_room_name_unique unique (room_id, name);
  end if;
end $$;

-- plant_or_login:
--   名前が既存 → passcode検証してログイン(edit_token)
--   名前が未登録 → 新規作成 + 復元キー発行
-- returns { kind: 'login' | 'planted', tree_id, edit_token, recovery_key(optional) }
create or replace function public.plant_or_login(
  p_room_slug text,
  p_name text,
  p_passcode text,
  p_email text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_recovery text;
  v_seed bigint;
begin
  if coalesce(length(p_passcode), 0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name), 0) < 1 then raise exception 'name required'; end if;

  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;

  -- 既存tree lookup
  select * into v_tree from public.trees where room_id = v_room_id and name = p_name;
  if found then
    -- ログイン経路: passcode 検証
    if v_tree.passcode_hash = extensions.crypt(p_passcode, v_tree.passcode_hash)
       or v_tree.recovery_key_hash = extensions.crypt(p_passcode, v_tree.recovery_key_hash) then
      v_token := public.sign_edit_token(v_tree.id);
      return json_build_object('kind', 'login', 'tree_id', v_tree.id, 'edit_token', v_token);
    end if;
    raise exception 'name exists but passcode mismatch';
  end if;

  -- 新規植樹経路
  v_recovery := encode(extensions.gen_random_bytes(8), 'hex');
  v_seed := abs(hashtext(p_name || v_recovery))::bigint;
  insert into public.trees(room_id, name, passcode_hash, recovery_key_hash, recovery_email, seed)
    values (v_room_id, p_name,
            extensions.crypt(p_passcode, extensions.gen_salt('bf')),
            extensions.crypt(v_recovery, extensions.gen_salt('bf')),
            nullif(p_email, ''),
            v_seed)
    returning * into v_tree;

  v_token := public.sign_edit_token(v_tree.id);
  return json_build_object(
    'kind', 'planted',
    'tree_id', v_tree.id,
    'edit_token', v_token,
    'recovery_key', v_recovery
  );
end;
$fn$;
