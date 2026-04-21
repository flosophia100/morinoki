-- 020 背景・ギミック管理: rooms.ambience
-- 管理者が時間帯配色・季節固定・鳥頻度・背景森影密度を森ごとに調整できる

alter table public.rooms add column if not exists ambience jsonb default '{}'::jsonb;

create or replace function public.set_room_ambience(
  p_admin_token text, p_slug text, p_ambience jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_variable
begin
  perform public.verify_admin_token(p_admin_token);
  update public.rooms set ambience = p_ambience where slug = p_slug;
  return p_ambience;
end;
$fn$;
