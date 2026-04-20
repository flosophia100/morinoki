-- 012 メール認証付き登録
-- - pending_registrations: 仮登録(メール確認待ち)
-- - mail_outbox: 汎用メール送信キュー(Edge Functionが消化)
-- - request_tree_registration: 仮登録+確認メール発送
-- - verify_registration: トークン検証→trees実体化
-- - request_passcode_reset: 既存を mail_outbox 経由に差し替え

-- ---- mail_outbox(汎用メール送信キュー) ----
create table if not exists public.mail_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  body text not null,
  created_at timestamptz default now(),
  sent_at timestamptz
);
alter table public.mail_outbox enable row level security;
-- ポリシー作らない: 通常クライアント不可。security definer + service_roleのみ

-- ---- pending_registrations(仮登録) ----
create table if not exists public.pending_registrations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  email text not null,
  passcode_hash text not null,
  verification_token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
alter table public.pending_registrations enable row level security;
create index if not exists idx_pending_token on public.pending_registrations(verification_token);
create index if not exists idx_pending_expires on public.pending_registrations(expires_at);

-- ---- request_tree_registration ----
-- メール必須。trees に即入れない。pending に保存して確認メール送信
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
begin
  if coalesce(length(p_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  if coalesce(length(p_email),0) < 3 or position('@' in p_email) = 0 then
    raise exception 'email required'; end if;

  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;

  -- 既存tree名と衝突
  if exists (select 1 from public.trees where room_id = v_room_id and name = p_name) then
    raise exception 'この名前はすでに使われています';
  end if;

  -- 期限切れ、または同名の仮登録を先に削除(再申請に対応)
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

  -- メール本文
  v_url := rtrim(coalesce(p_base_url, ''), '/') || '/r/' || p_room_slug || '?verify=' || v_token;
  v_subject := '森 / 本登録のご案内';
  v_body := p_name || E'さんの登録を受け付けました。\n' ||
            E'下記リンクを24時間以内にクリックして本登録を完了してください。\n\n' ||
            v_url || E'\n\n' ||
            E'心当たりがない場合はこのメールを無視してください。';

  insert into public.mail_outbox(to_email, subject, body)
    values (p_email, v_subject, v_body);

  return json_build_object('sent', true);
end;
$fn$;

-- ---- verify_registration ----
create or replace function public.verify_registration(p_token text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_pending public.pending_registrations%rowtype;
  v_recovery text;
  v_seed bigint;
  v_tree_id uuid;
  v_edit_token text;
  v_room_slug text;
begin
  select * into v_pending from public.pending_registrations
    where verification_token = p_token;
  if not found then raise exception 'このリンクは無効または使用済みです'; end if;

  if v_pending.expires_at < now() then
    delete from public.pending_registrations where id = v_pending.id;
    raise exception 'このリンクは期限切れです。もう一度登録し直してください';
  end if;

  -- 名前がこの間にtreesに作られていたら衝突エラー
  if exists (select 1 from public.trees
             where room_id = v_pending.room_id and name = v_pending.name) then
    delete from public.pending_registrations where id = v_pending.id;
    raise exception 'この名前は他の方が先に登録しました';
  end if;

  v_recovery := encode(extensions.gen_random_bytes(8), 'hex');
  v_seed := abs(hashtext(v_pending.name || v_recovery))::bigint;

  insert into public.trees(room_id, name, passcode_hash,
                           recovery_key_hash, recovery_email, seed)
    values (v_pending.room_id, v_pending.name, v_pending.passcode_hash,
            extensions.crypt(v_recovery, extensions.gen_salt('bf')),
            v_pending.email, v_seed)
    returning id into v_tree_id;

  delete from public.pending_registrations where id = v_pending.id;

  v_edit_token := public.sign_edit_token(v_tree_id);
  select slug into v_room_slug from public.rooms where id = v_pending.room_id;

  return json_build_object(
    'tree_id', v_tree_id,
    'edit_token', v_edit_token,
    'recovery_key', v_recovery,
    'room_slug', v_room_slug,
    'name', v_pending.name
  );
end;
$fn$;

-- ---- request_passcode_reset(mail_outbox経由に差し替え) ----
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

  insert into public.mail_outbox(to_email, subject, body)
    values (v_tree.recovery_email, v_subject, v_body);
  return json_build_object('sent', true);
end;
$fn$;
