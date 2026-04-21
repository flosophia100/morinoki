-- 017 復元キー(文字列記憶)を廃止、パスワードリセットを「メール内リンク」方式に
-- - trees.recovery_key_hash を削除(カラムも)
-- - auth_tree RPC を削除
-- - login_tree を合言葉のみに
-- - plant_tree / plant_or_login / verify_registration / admin_create_tree から
--   recovery_key 生成を削除
-- - request_passcode_reset: pending_credential_change にトークン保存+再設定リンクをメール送信
-- - verify_passcode_reset: リンクから新合言葉を受け取り適用

-- pending_credential_change: Phase3でも使うが先に用意
create table if not exists public.pending_credential_change (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  kind text not null check (kind in ('passcode_reset','passcode_change','email_change')),
  new_passcode_hash text,
  new_email text,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
alter table public.pending_credential_change enable row level security;
create index if not exists idx_pending_cc_token on public.pending_credential_change(token);
create index if not exists idx_pending_cc_expires on public.pending_credential_change(expires_at);

-- まず recovery_key_hash を nullable に(既存関数のinsertで非NULL制約違反にならないように)
alter table public.trees alter column recovery_key_hash drop not null;

-- auth_tree 廃止
drop function if exists public.auth_tree(uuid, text);

-- login_tree: 合言葉のみ
create or replace function public.login_tree(
  p_room_slug text, p_name text, p_passcode text
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
begin
  if coalesce(length(p_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  select * into v_tree from public.trees where room_id = v_room_id and name = p_name;
  if not found then raise exception 'その名前の樹は見つかりません'; end if;
  if v_tree.passcode_hash <> extensions.crypt(p_passcode, v_tree.passcode_hash) then
    raise exception '合言葉が違います';
  end if;
  v_token := public.sign_edit_token(v_tree.id);
  return json_build_object('kind','login','tree_id', v_tree.id,'edit_token', v_token);
end;
$fn$;

-- plant_or_login: 旧互換で残すが合言葉のみに
create or replace function public.plant_or_login(
  p_room_slug text, p_name text, p_passcode text, p_email text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_seed bigint;
begin
  if coalesce(length(p_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  select * into v_tree from public.trees where room_id = v_room_id and name = p_name;
  if found then
    if v_tree.passcode_hash = extensions.crypt(p_passcode, v_tree.passcode_hash) then
      v_token := public.sign_edit_token(v_tree.id);
      return json_build_object('kind','login','tree_id', v_tree.id, 'edit_token', v_token);
    end if;
    raise exception 'name exists but passcode mismatch';
  end if;
  v_seed := abs(hashtext(p_name || extract(epoch from now())::text))::bigint;
  insert into public.trees(room_id, name, passcode_hash, recovery_email, seed)
    values (v_room_id, p_name,
            extensions.crypt(p_passcode, extensions.gen_salt('bf')),
            nullif(p_email,''),
            v_seed)
    returning * into v_tree;
  v_token := public.sign_edit_token(v_tree.id);
  return json_build_object('kind','planted','tree_id', v_tree.id, 'edit_token', v_token);
end;
$fn$;

-- plant_tree: 合言葉のみ、recovery_key_hash 不生成
create or replace function public.plant_tree(
  p_room_slug text, p_name text, p_passcode text, p_email text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_seed bigint;
begin
  if coalesce(length(p_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if exists (select 1 from public.trees where room_id = v_room_id and name = p_name) then
    raise exception 'この名前はすでに使われています';
  end if;
  v_seed := abs(hashtext(p_name || extract(epoch from now())::text))::bigint;
  insert into public.trees(room_id, name, passcode_hash, recovery_email, seed)
    values (v_room_id, p_name,
            extensions.crypt(p_passcode, extensions.gen_salt('bf')),
            nullif(p_email,''),
            v_seed)
    returning * into v_tree;
  v_token := public.sign_edit_token(v_tree.id);
  return json_build_object('kind','planted','tree_id', v_tree.id,'edit_token', v_token);
end;
$fn$;

-- verify_registration: recovery_key 生成を削除
create or replace function public.verify_registration(p_token text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_pending public.pending_registrations%rowtype;
  v_seed bigint;
  v_tree_id uuid;
  v_edit_token text;
  v_room_slug text;
begin
  select * into v_pending from public.pending_registrations where verification_token = p_token;
  if not found then raise exception 'このリンクは無効または使用済みです'; end if;
  if v_pending.expires_at < now() then
    delete from public.pending_registrations where id = v_pending.id;
    raise exception 'このリンクは期限切れです。もう一度登録し直してください';
  end if;
  if exists (select 1 from public.trees where room_id = v_pending.room_id and name = v_pending.name) then
    delete from public.pending_registrations where id = v_pending.id;
    raise exception 'この名前は他の方が先に登録しました';
  end if;
  v_seed := abs(hashtext(v_pending.name || extract(epoch from now())::text))::bigint;
  insert into public.trees(room_id, name, passcode_hash, recovery_email, seed)
    values (v_pending.room_id, v_pending.name, v_pending.passcode_hash,
            v_pending.email, v_seed)
    returning id into v_tree_id;
  delete from public.pending_registrations where id = v_pending.id;
  v_edit_token := public.sign_edit_token(v_tree_id);
  select slug into v_room_slug from public.rooms where id = v_pending.room_id;
  return json_build_object(
    'tree_id', v_tree_id, 'edit_token', v_edit_token,
    'room_slug', v_room_slug, 'name', v_pending.name
  );
end;
$fn$;

-- admin_create_tree: recovery_key_hash 不生成
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
begin
  perform public.verify_admin_token(p_admin_token);
  if coalesce(length(p_name),0) < 1 then raise exception 'name required'; end if;
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  if exists (select 1 from public.trees where room_id = v_room_id and name = p_name) then
    raise exception 'この名前はすでに使われています';
  end if;
  v_random_pass := encode(extensions.gen_random_bytes(24), 'hex');
  v_seed := abs(hashtext(p_name || v_random_pass))::bigint;
  insert into public.trees(room_id, name, passcode_hash, seed)
    values (v_room_id, p_name,
            extensions.crypt(v_random_pass, extensions.gen_salt('bf')),
            v_seed)
    returning * into v_tree;
  return v_tree;
end;
$fn$;

-- request_passcode_reset: リンク方式に差し替え
create or replace function public.request_passcode_reset(
  p_room_slug text, p_name text, p_base_url text default null
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_room_id uuid;
  v_tree public.trees%rowtype;
  v_token text;
  v_subject text;
  v_body text;
  v_url text;
begin
  v_room_id := (select id from public.rooms where slug = p_room_slug);
  if v_room_id is null then raise exception 'room not found'; end if;
  select * into v_tree from public.trees where room_id = v_room_id and name = p_name;
  if not found then return json_build_object('sent', false); end if;
  if v_tree.recovery_email is null or length(v_tree.recovery_email) = 0 then
    return json_build_object('sent', false);
  end if;

  delete from public.pending_credential_change
    where tree_id = v_tree.id and kind = 'passcode_reset';

  v_token := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.pending_credential_change(tree_id, kind, token, expires_at)
    values (v_tree.id, 'passcode_reset', v_token, now() + interval '24 hours');

  v_url := rtrim(coalesce(p_base_url,''),'/') || '/r/' || p_room_slug || '?reset=' || v_token;
  v_subject := 'morinokki / 合言葉の再設定';
  v_body := p_name || E'さんの合言葉を再設定するリンクです(24時間有効)。\n\n' ||
            v_url || E'\n\n' ||
            E'リンクを開き、新しい合言葉を入力してください。\n' ||
            E'心当たりがない場合はこのメールを無視してください。\n-- morinokki';

  perform public.send_email_via_resend(v_tree.recovery_email, v_subject, v_body);
  insert into public.mail_outbox(to_email, subject, body, sent_at)
    values (v_tree.recovery_email, v_subject, v_body, now());
  return json_build_object('sent', true);
end;
$fn$;

-- verify_passcode_reset: トークンで新合言葉を適用
create or replace function public.verify_passcode_reset(
  p_token text, p_new_passcode text
) returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
declare
  v_pending public.pending_credential_change%rowtype;
  v_edit_token text;
  v_tree public.trees%rowtype;
  v_room_slug text;
begin
  if coalesce(length(p_new_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  select * into v_pending from public.pending_credential_change
    where token = p_token and kind = 'passcode_reset';
  if not found then raise exception 'このリンクは無効または使用済みです'; end if;
  if v_pending.expires_at < now() then
    delete from public.pending_credential_change where id = v_pending.id;
    raise exception 'このリンクは期限切れです';
  end if;
  update public.trees
    set passcode_hash = extensions.crypt(p_new_passcode, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_pending.tree_id
    returning * into v_tree;
  delete from public.pending_credential_change where id = v_pending.id;
  v_edit_token := public.sign_edit_token(v_tree.id);
  select slug into v_room_slug from public.rooms where id = v_tree.room_id;
  return json_build_object(
    'tree_id', v_tree.id, 'edit_token', v_edit_token,
    'room_slug', v_room_slug, 'name', v_tree.name
  );
end;
$fn$;

-- 最後に recovery_key_hash カラムを削除
alter table public.trees drop column if exists recovery_key_hash;
