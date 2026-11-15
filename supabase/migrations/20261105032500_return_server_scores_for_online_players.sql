
create or replace function private.start_qqcross_match(target_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare v_match public.matches%rowtype; v_count integer; v_players jsonb;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  select * into v_match from public.matches where id=target_match_id for update;
  if not found or v_match.host_id<>auth.uid() then raise exception 'Только создатель может начать партию'; end if;
  if v_match.status<>'waiting' then raise exception 'Партия уже запущена или закрыта'; end if;
  select count(*) into v_count from public.match_players where match_id=target_match_id and status='accepted';
  if v_count<2 then raise exception 'Нужно дождаться хотя бы одного друга'; end if;
  update public.match_players set status='playing' where match_id=target_match_id and status='accepted';
  update public.matches set status='active',current_turn_user_id=auth.uid(),turn_started_at=now(),
    turn_ends_at=now()+interval '60 seconds',started_at=now(),state_version=1 where id=target_match_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'avatar',p.avatar,'seat',mp.seat,'score',mp.score) order by mp.seat),'[]'::jsonb)
    into v_players from public.match_players mp join public.profiles p on p.id=mp.user_id
    where mp.match_id=target_match_id and mp.status='playing';
  return jsonb_build_object('match_id',target_match_id,'puzzle_snapshot',v_match.puzzle_snapshot,'players',v_players,'state_version',1,'status','active');
end;
$function$;
