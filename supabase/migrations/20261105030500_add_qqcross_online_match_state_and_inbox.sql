create or replace function public.init_qqcross_match_state(target_match_id uuid, initial_state jsonb)
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_version integer;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if initial_state is null or jsonb_typeof(initial_state)<>'object' or octet_length(initial_state::text)>200000 then raise exception 'Некорректное начальное состояние'; end if;
  update public.matches set game_state=initial_state,state_version=state_version+1
    where id=target_match_id and host_id=auth.uid() and status='active'
      and current_turn_user_id=auth.uid() and state_version=1 and game_state is null
    returning state_version into v_version;
  if v_version is null then raise exception 'Не удалось инициализировать партию'; end if;
  return v_version;
end;
$function$;

create or replace function public.list_qqcross_my_matches()
returns table(match_id uuid,host_username text,status text,player_limit integer,current_turn_user_id uuid,state_version integer,created_at timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select m.id,p.username,m.status,m.player_limit,m.current_turn_user_id,m.state_version,m.created_at
  from public.matches m join public.match_players mp on mp.match_id=m.id
  join public.profiles p on p.id=m.host_id
  where mp.user_id=auth.uid() and mp.status in ('accepted','playing')
    and m.status in ('waiting','active')
  order by m.created_at desc;
$function$;

revoke all on function public.init_qqcross_match_state(uuid,jsonb) from public,anon;
revoke all on function public.list_qqcross_my_matches() from public,anon;
grant execute on function public.init_qqcross_match_state(uuid,jsonb) to authenticated;
grant execute on function public.list_qqcross_my_matches() to authenticated;
