-- 023_tree_self_deletion.sql
-- ユーザー自身による樹(ログインID)の削除 — メール認証経由。
-- request_tree_self_deletion: 現メールに承認リンク送信(kind='tree_delete')
-- verify_credential_change: 'tree_delete' を処理対象に追加(実削除)

-- kind の CHECK 制約に 'tree_delete' を追加
alter table public.pending_credential_change
  drop constraint if exists pending_credential_change_kind_check;
alter table public.pending_credential_change
  add constraint pending_credential_change_kind_check
  check (kind in ('passcode_reset','passcode_change','email_change','tree_delete'));

create or replace function public.request_tree_self_deletion(
  p_edit_token text,
  p_base_url text default null
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
  v_tid := public.verify_edit_token(p_edit_token);
  select * into v_tree from public.trees where id = v_tid;
  if not found then raise exception 'tree not found'; end if;
  if v_tree.recovery_email is null or length(v_tree.recovery_email) = 0 then
    raise exception 'このアカウントにはメールが登録されていません';
  end if;

  delete from public.pending_credential_change
    where tree_id = v_tid and kind = 'tree_delete';

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.pending_credential_change(
    tree_id, kind, token, expires_at
  ) values (
    v_tid, 'tree_delete', v_token, now() + interval '24 hours'
  );

  select slug into v_room_slug from public.rooms where id = v_tree.room_id;
  v_url := rtrim(coalesce(p_base_url,''),'/') || '/r/' || v_room_slug || '?credchange=' || v_token;
  v_subject := 'morinokki / 樹(ログインID)の削除承認';
  v_body := v_tree.name || E'さんの樹(ログインID)の削除申請を受け付けました。\n' ||
            E'次のリンクをクリックすると、樹と登録したすべてのマイワード(枝)が削除されます(24時間以内)。\n' ||
            E'この操作は取り消せません。\n\n' ||
            v_url || E'\n\n' ||
            E'心当たりがない場合はこのメールを無視してください。その場合、樹は削除されません。\n-- morinokki';

  perform public.send_email_via_resend(v_tree.recovery_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (v_tree.recovery_email, v_subject, v_body, now());

  return json_build_object('sent', true);
end;
$fn$;

-- verify_credential_change を拡張して tree_delete に対応
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
  elsif v_pending.kind = 'tree_delete' then
    -- 樹と紐づくノードを削除(trees.id への cascade で nodes も消える想定)
    delete from public.trees where id = v_pending.tree_id;
  else
    raise exception 'このトークンは合言葉/メール変更/樹削除用ではありません';
  end if;

  delete from public.pending_credential_change where id = v_pending.id;
  return json_build_object('kind', v_pending.kind, 'applied', true);
end;
$fn$;
