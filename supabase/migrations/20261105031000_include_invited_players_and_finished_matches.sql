
create or replace function public.get_qqcross_match(target_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_match public.matches%rowtype; v_players jsonb;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  select * into v_match from public.matches where id=target_match_id;
  if not found or not exists(select 1 from public.match_players where match_id=target_match_id and user_id=auth.uid() and status in ('accepted','playing','finished')) then
    raise exception 'Нет доступа к этой партии';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'avatar',p.avatar,'seat',mp.seat,'status',mp.status,'score',mp.score) order by mp.seat),'[]'::jsonb)
    into v_players from public.match_players mp join public.profiles p on p.id=mp.user_id
    where mp.match_id=target_match_id and (mp.status in ('accepted','playing','finished') or v_match.host_id=auth.uid());
  return jsonb_build_object('match_id',v_match.id,'host_id',v_match.host_id,'status',v_match.status,
    'player_limit',v_match.player_limit,'current_turn_user_id',v_match.current_turn_user_id,
    'turn_ends_at',v_match.turn_ends_at,'puzzle_snapshot',v_match.puzzle_snapshot,
    'game_state',v_match.game_state,'state_version',v_match.state_version,'players',v_players);
end;
$function$;

create or replace function public.list_qqcross_my_matches()
returns table(match_id uuid,host_username text,status text,player_limit integer,current_turn_user_id uuid,state_version integer,created_at timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select m.id,p.username,m.status,m.player_limit,m.current_turn_user_id,m.state_version,m.created_at
  from public.matches m join public.match_players mp on mp.match_id=m.id
  join public.profiles p on p.id=m.host_id
  where mp.user_id=auth.uid() and mp.status in ('accepted','playing','finished')
    and m.status in ('waiting','active','finished')
    and (m.finished_at is null or m.finished_at>now()-interval '14 days')
  order by m.created_at desc;
$function$;
