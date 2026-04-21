-- 019 管理者のユーザー管理RPC
-- admin_list_users, admin_delete_user, admin_reset_user_passcode, admin_set_user_email

create or replace function public.admin_list_users(
  p_admin_token text, p_room_slug text
) returns table(
  tree_id uuid, name text, email text, created_at timestamptz, node_count int
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
    select t.id, t.name, t.recovery_email, t.created_at,
           (select count(*)::int from public.nodes n where n.tree_id = t.id)
    from public.trees t
    where t.room_id = v_room_id
    order by t.created_at asc;
end;
$fn$;

create or replace function public.admin_delete_user(
  p_admin_token text, p_tree_id uuid
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  delete from public.trees where id = p_tree_id;  -- CASCADE で nodes も削除
end;
$fn$;

-- admin_reset_user_passcode: ランダム合言葉を発行してメール送信
create or replace function public.admin_reset_user_passcode(
  p_admin_token text, p_tree_id uuid
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tree public.trees%rowtype;
  v_new_pass text;
  v_subject text;
  v_body text;
begin
  perform public.verify_admin_token(p_admin_token);
  select * into v_tree from public.trees where id = p_tree_id;
  if not found then raise exception 'tree not found'; end if;

  v_new_pass := encode(extensions.gen_random_bytes(6), 'hex');  -- 12文字
  update public.trees
    set passcode_hash = extensions.crypt(v_new_pass, extensions.gen_salt('bf')),
        updated_at = now()
    where id = p_tree_id;

  if v_tree.recovery_email is not null and length(v_tree.recovery_email) > 0 then
    v_subject := 'morinokki / 管理者により合言葉がリセットされました';
    v_body := v_tree.name || E'さんの合言葉を管理者がリセットしました。\n\n' ||
              E'新しい合言葉: ' || v_new_pass || E'\n\n' ||
              E'ログインしたら、すぐにサイドパネルから自分の合言葉に変更してください。\n-- morinokki';
    perform public.send_email_via_resend(v_tree.recovery_email, v_subject, v_body);
    insert into public.mail_outbox(to_email, subject, body, sent_at)
      values (v_tree.recovery_email, v_subject, v_body, now());
    return json_build_object('sent', true, 'new_passcode', v_new_pass);
  else
    -- メール未登録: 管理者画面に表示するため新合言葉を返す
    return json_build_object('sent', false, 'new_passcode', v_new_pass);
  end if;
end;
$fn$;

-- admin_set_user_email: 直接変更(管理者特権、認証メール無し)
create or replace function public.admin_set_user_email(
  p_admin_token text, p_tree_id uuid, p_new_email text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  update public.trees
    set recovery_email = nullif(p_new_email, ''),
        updated_at = now()
    where id = p_tree_id;
end;
$fn$;
