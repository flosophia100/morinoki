-- Realtime: UPDATEイベントで旧値を含むよう REPLICA IDENTITY FULL に
alter table public.trees replica identity full;
alter table public.nodes replica identity full;
alter table public.rooms replica identity full;

-- anon/authenticated に明示的な SELECT 権限(RLSがあるので実質安全)
grant select on public.rooms to anon, authenticated;
grant select on public.trees to anon, authenticated;
grant select on public.nodes to anon, authenticated;
