-- 014 メール件名/本文の morinokki ブランド反映
-- request_tree_registration / request_passcode_reset の subject を更新

create or replace function public.request_tree_registration(
  p_room_slug text,
  p_name text,
  p_passcode text,
  p_email text,
  p_base_url text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_token text;
  v_subject text;
  v_body text;
  v_url text;
  v_req_id bigint;
begin
  if coalesce(length(p_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  if coalesce(length(p_email),0) < 3 or position('@' in p_email) = 0 then
    raise exception 'email required'; end if;

  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;

  if exists (select 1 from public.trees where room_id = v_room_id and name = p_name) then
    raise exception 'この名前はすでに使われています';
  end if;

  delete from public.pending_registrations
    where (room_id = v_room_id and name = p_name) or expires_at < now();

  v_token := encode(extensions.gen_random_bytes(18), 'hex');

  insert into public.pending_registrations(
    room_id, name, email, passcode_hash, verification_token, expires_at
  ) values (
    v_room_id, p_name, p_email,
    extensions.crypt(p_passcode, extensions.gen_salt('bf')),
    v_token, now() + interval '24 hours'
  );

  v_url := rtrim(coalesce(p_base_url, ''), '/') || '/r/' || p_room_slug || '?verify=' || v_token;
  v_subject := 'morinokki / 本登録のご案内';
  v_body := p_name || E'さんの登録を受け付けました。\n' ||
            E'下記リンクを24時間以内にクリックして本登録を完了してください。\n\n' ||
            v_url || E'\n\n' ||
            E'心当たりがない場合はこのメールを無視してください。\n' ||
            E'-- morinokki';

  v_req_id := public.send_email_via_resend(p_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (p_email, v_subject, v_body,
            case when v_req_id is not null then now() else null end);

  return json_build_object('sent', true);
end;
$fn$;

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
  if not found then return json_build_object('sent', false); end if;
  if v_tree.recovery_email is null or length(v_tree.recovery_email) = 0 then
    return json_build_object('sent', false);
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
            case when v_req_id is not null then now() else null end);
  return json_build_object('sent', true);
end;
$fn$;
