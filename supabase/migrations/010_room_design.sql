-- rooms.design (JSONB) — 管理者が設定する森のビジュアルパラメタ
alter table public.rooms add column if not exists design jsonb;

-- admin_token で design を更新するRPC
create or replace function public.set_room_design(
  p_admin_token text,
  p_design jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $srd$
#variable_conflict use_variable
declare
  v_room_id uuid;
begin
  v_room_id := public.verify_admin_token(p_admin_token);
  update public.rooms set design = p_design where id = v_room_id;
  return p_design;
end;
$srd$;
