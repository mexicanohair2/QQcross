create or replace function private.delete_qqcross_match(target_match_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_id uuid;
  v_match_status text;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'Необходимо войти в аккаунт';
  end if;
  select m.host_id, m.status
    into v_host_id, v_match_status
    from public.matches m
    where m.id = target_match_id
    for update;
  if not found then
    return 'not_found';
  end if;
  if v_host_id = auth.uid() then
    delete from public.match_moves where match_id = target_match_id;
    delete from public.match_players where match_id = target_match_id;
    delete from public.matches where id = target_match_id;
    return 'deleted';
  end if;
  update public.match_players
    set status = 'declined'
    where match_id = target_match_id
      and user_id = auth.uid()
      and status in ('accepted', 'playing', 'finished');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Нет доступа к этой партии';
  end if;
  return 'left';
end;
$$;
revoke all on function private.delete_qqcross_match(uuid) from public, anon;
grant execute on function private.delete_qqcross_match(uuid) to authenticated;
create or replace function public.delete_qqcross_match(target_match_id uuid)
returns text
language sql
volatile
security invoker
set search_path = ''
as $$ select private.delete_qqcross_match($1) $$;
revoke all on function public.delete_qqcross_match(uuid) from public, anon;
grant execute on function public.delete_qqcross_match(uuid) to authenticated;
