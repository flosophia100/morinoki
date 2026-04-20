-- 013 pg_net を使ったメール直送(Edge Function 不要化)
-- Postgres から Resend API を直接叩く。mail_outbox への記録は監査用に残す。
-- APIキーと送信元は _config テーブルに格納:
--   insert into public._config(key,value) values
--     ('resend_api_key','re_xxxx'),
--     ('resend_from','morinoki <noreply@yourdomain.com>')
--   on conflict(key) do update set value = excluded.value;

create extension if not exists pg_net with schema extensions;

-- helper: Resend API を net.http_post でfire-and-forget送信
-- _config にAPIキーが無ければ何もしない(フェイルセーフ)
create or replace function public.send_email_via_resend(
  p_to text, p_subject text, p_body text
) returns bigint
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_api_key text;
  v_from text;
  v_req_id bigint;
begin
  v_api_key := (select value from public._config where key = 'resend_api_key');
  v_from    := coalesce((select value from public._config where key = 'resend_from'),
                        'morinoki <noreply@example.com>');
  if coalesce(v_api_key, '') = '' then
    return null;  -- 未設定なら送信しない(フロントの動作は継続)
  end if;

  select net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_api_key,
                 'Content-Type',  'application/json'),
    body    := jsonb_build_object(
                 'from', v_from,
                 'to',   p_to,
                 'subject', p_subject,
                 'text', p_body)
  ) into v_req_id;
  return v_req_id;
end;
$fn$;

-- request_tree_registration を直送版に差し替え(mail_outbox はログとして残す)
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
  v_subject := '森 / 本登録のご案内';
  v_body := p_name || E'さんの登録を受け付けました。\n' ||
            E'下記リンクを24時間以内にクリックして本登録を完了してください。\n\n' ||
            v_url || E'\n\n' ||
            E'心当たりがない場合はこのメールを無視してください。';

  -- 直接送信
  v_req_id := public.send_email_via_resend(p_email, v_subject, v_body);
  -- 監査ログ(送信済みフラグはリクエストIDが返れば付ける)
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (p_email, v_subject, v_body,
            case when v_req_id is not null then now() else null end);

  return json_build_object('sent', true);
end;
$fn$;

-- request_passcode_reset も直送版に差し替え
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

  v_subject := '森 / 合言葉の再設定';
  v_body := p_name || E'さんの合言葉を再設定できる一時キーです。\n\n' ||
            E'一時キー: ' || v_recovery || E'\n\n' ||
            E'ログイン画面で、名前+この一時キーでログインしてください。\n' ||
            E'ログイン後、サイドパネルから新しい合言葉を設定できます。' ||
            case when p_base_url is not null
                 then E'\n\n森: ' || rtrim(p_base_url, '/') || '/r/' || p_room_slug
                 else '' end;

  v_req_id := public.send_email_via_resend(v_tree.recovery_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (v_tree.recovery_email, v_subject, v_body,
            case when v_req_id is not null then now() else null end);
  return json_build_object('sent', true);
end;
$fn$;
