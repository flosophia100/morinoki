-- create_room が admin_passcode_hash を 'admin' で初期化するよう更新
create or replace function public.create_room(p_slug text, p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $cr$
#variable_conflict use_variable
declare
  r public.rooms;
begin
  if p_slug is null or length(p_slug) < 3 then
    raise exception 'slug too short';
  end if;
  insert into public.rooms(slug, name, admin_passcode_hash)
    values (p_slug, p_name, extensions.crypt('admin', extensions.gen_salt('bf')))
    returning * into r;
  return r;
end;
$cr$;

-- 既存の admin_passcode_hash が NULL の room を 'admin' で初期化
update public.rooms
set admin_passcode_hash = extensions.crypt('admin', extensions.gen_salt('bf'))
where admin_passcode_hash is null;
