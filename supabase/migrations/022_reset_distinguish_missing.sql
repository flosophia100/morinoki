-- 022_reset_distinguish_missing.sql
-- request_passcode_reset が "その名前は登録されていません" を
-- クライアントで識別できるよう、返り値に reason を含める。
--   {sent: true}                     … メール送信成功
--   {sent: false, reason: 'name_not_found'} … 名前が未登録
--   {sent: false, reason: 'no_email'}       … 名前はあるがメール未登録

create or replace function public.request_passcode_reset(
  p_room_slug text,
  p_name text,
  p_base_url text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_recovery text;
  v_subject text;
  v_body text;
  v_req_id bigint;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  select * into v_tree from public.trees
    where room_id = v_room_id and name = p_name;
  if not found then
    return json_build_object('sent', false, 'reason', 'name_not_found');
  end if;
  if v_tree.recovery_email is null or length(v_tree.recovery_email) = 0 then
    return json_build_object('sent', false, 'reason', 'no_email');
  end if;

  v_recovery := encode(extensions.gen_random_bytes(8), 'hex');
  update public.trees
    set recovery_key_hash = extensions.crypt(v_recovery, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_tree.id;

  v_subject := 'morinokki / 合言葉の再設定';
  v_body := p_name || E'さんの合言葉を再設定できる一時キーです。\n\n' ||
            E'一時キー: ' || v_recovery || E'\n\n' ||
            E'ログイン画面で、名前+この一時キーでログインしてください。\n' ||
            E'ログイン後、サイドパネルから新しい合言葉を設定できます。' ||
            case when p_base_url is not null
                 then E'\n\nmorinokki: ' || rtrim(p_base_url, '/') || '/r/' || p_room_slug
                 else '' end ||
            E'\n-- morinokki';

  v_req_id := public.send_email_via_resend(v_tree.recovery_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (v_tree.recovery_email, v_subject, v_body,
            case when v_req_id > 0 then now() else null end);
  return json_build_object('sent', true);
end;
$fn$;
