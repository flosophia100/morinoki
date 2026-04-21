-- 018 合言葉・メール変更のメール認証化
-- - update_tree_credentials(直接変更)を廃止
-- - request_passcode_change: 新合言葉を pending に保存 → 現メール宛に承認リンク(所有者確認)
-- - request_email_change: 新メールを pending に保存
--     → 新メール宛に承認リンク、現メール宛に通知(Q5=両方)
-- - verify_credential_change: トークンで実反映

drop function if exists public.update_tree_credentials(text, text, text);

create or replace function public.request_passcode_change(
  p_edit_token text, p_new_passcode text, p_base_url text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_url text;
  v_subject text;
  v_body text;
  v_room_slug text;
begin
  if coalesce(length(p_new_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  v_tid := public.verify_edit_token(p_edit_token);
  select * into v_tree from public.trees where id = v_tid;
  if v_tree.recovery_email is null or length(v_tree.recovery_email) = 0 then
    raise exception 'このアカウントにはメールが登録されていません';
  end if;

  delete from public.pending_credential_change
    where tree_id = v_tid and kind = 'passcode_change';

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.pending_credential_change(
    tree_id, kind, new_passcode_hash, token, expires_at
  ) values (
    v_tid, 'passcode_change',
    extensions.crypt(p_new_passcode, extensions.gen_salt('bf')),
    v_token, now() + interval '24 hours'
  );

  select slug into v_room_slug from public.rooms where id = v_tree.room_id;
  v_url := rtrim(coalesce(p_base_url,''),'/') || '/r/' || v_room_slug || '?credchange=' || v_token;
  v_subject := 'morinokki / 合言葉の変更承認';
  v_body := v_tree.name || E'さんが合言葉の変更を申請しました。\n' ||
            E'次のリンクをクリックすると変更が適用されます(24時間以内)。\n\n' ||
            v_url || E'\n\n' ||
            E'心当たりがない場合はこのメールを無視してください。その場合、現在の合言葉は変更されません。\n-- morinokki';

  perform public.send_email_via_resend(v_tree.recovery_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (v_tree.recovery_email, v_subject, v_body, now());

  return json_build_object('sent', true);
end;
$fn$;

create or replace function public.request_email_change(
  p_edit_token text, p_new_email text, p_base_url text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_tid uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_url text;
  v_subject text;
  v_body text;
  v_notify_subject text;
  v_notify_body text;
  v_room_slug text;
begin
  if coalesce(length(p_new_email),0) < 3 or position('@' in p_new_email) = 0 then
    raise exception 'email invalid';
  end if;
  v_tid := public.verify_edit_token(p_edit_token);
  select * into v_tree from public.trees where id = v_tid;

  delete from public.pending_credential_change
    where tree_id = v_tid and kind = 'email_change';

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.pending_credential_change(
    tree_id, kind, new_email, token, expires_at
  ) values (
    v_tid, 'email_change', p_new_email, v_token, now() + interval '24 hours'
  );

  select slug into v_room_slug from public.rooms where id = v_tree.room_id;
  v_url := rtrim(coalesce(p_base_url,''),'/') || '/r/' || v_room_slug || '?credchange=' || v_token;

  -- 新メール宛: 承認リンク
  v_subject := 'morinokki / メールアドレスの確認';
  v_body := v_tree.name || E'さんのアカウントの連絡先メールとして登録されました。\n' ||
            E'このアドレスがご本人のものであれば、次のリンクを24時間以内にクリックしてください。\n\n' ||
            v_url || E'\n\n' ||
            E'心当たりがない場合はこのメールを無視してください。\n-- morinokki';
  perform public.send_email_via_resend(p_new_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (p_new_email, v_subject, v_body, now());

  -- 現メール宛: 通知(現メール登録済なら)
  if v_tree.recovery_email is not null and length(v_tree.recovery_email) > 0 then
    v_notify_subject := 'morinokki / メールアドレス変更の申請がありました';
    v_notify_body := v_tree.name || E'さんのアカウントのメールアドレス変更リクエストを受け付けました。\n' ||
                     E'新しいメール: ' || p_new_email || E'\n' ||
                     E'変更は、新しいメールアドレス側で承認リンクがクリックされたときに適用されます。\n' ||
                     E'心当たりがない場合は、すぐに合言葉を変更してください。\n-- morinokki';
    perform public.send_email_via_resend(v_tree.recovery_email, v_notify_subject, v_notify_body);
    insert into public.mail_outbox(to_email, subject, body, sent_at)
      values (v_tree.recovery_email, v_notify_subject, v_notify_body, now());
  end if;

  return json_build_object('sent', true);
end;
$fn$;

create or replace function public.verify_credential_change(p_token text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_pending public.pending_credential_change%rowtype;
begin
  select * into v_pending from public.pending_credential_change where token = p_token;
  if not found then raise exception 'このリンクは無効または使用済みです'; end if;
  if v_pending.expires_at < now() then
    delete from public.pending_credential_change where id = v_pending.id;
    raise exception 'このリンクは期限切れです';
  end if;

  if v_pending.kind = 'passcode_change' then
    update public.trees set passcode_hash = v_pending.new_passcode_hash,
                            updated_at = now()
      where id = v_pending.tree_id;
  elsif v_pending.kind = 'email_change' then
    update public.trees set recovery_email = v_pending.new_email,
                            updated_at = now()
      where id = v_pending.tree_id;
  else
    raise exception 'このトークンは合言葉/メール変更用ではありません';
  end if;

  delete from public.pending_credential_change where id = v_pending.id;
  return json_build_object('kind', v_pending.kind, 'applied', true);
end;
$fn$;
