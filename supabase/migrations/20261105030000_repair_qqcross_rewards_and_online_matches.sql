-- QQCross cloud rewards and authenticated online-match RPCs.
alter table public.matches
  add column if not exists puzzle_snapshot jsonb,
  add column if not exists game_state jsonb,
  add column if not exists state_version integer not null default 0,
  add column if not exists started_at timestamptz;

create unique index if not exists match_players_match_user_uidx
  on public.match_players(match_id,user_id);

create table if not exists public.match_rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null,
  points integer not null check (points between 0 and 10000),
  reward integer not null check (reward between 10 and 10000),
  created_at timestamptz not null default now(),
  primary key(user_id,match_id)
);
alter table public.match_rewards enable row level security;
revoke all on public.match_rewards from anon, authenticated, public;

drop function if exists public.award_qqcross_match_result(integer);
create or replace function public.award_qqcross_match_result(points integer, match_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_reward integer := greatest(10,points);
  v_coins integer; v_games integer; v_wins integer; v_points integer; v_inserted integer;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if points is null or points < 0 or points > 10000 then raise exception 'Некорректный результат'; end if;
  if match_id is null or length(match_id) < 5 or length(match_id) > 100 then raise exception 'Некорректный номер партии'; end if;
  insert into public.match_rewards(user_id,match_id,points,reward)
    values(v_user,match_id,points,v_reward) on conflict(user_id,match_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    update public.profiles
      set games=games+1,wins=wins+1,points=public.profiles.points+award_qqcross_match_result.points,coins=coins+v_reward
      where id=v_user returning coins,games,wins,public.profiles.points into v_coins,v_games,v_wins,v_points;
    if not found then raise exception 'Профиль не найден'; end if;
  else
    select coins,games,wins,points into v_coins,v_games,v_wins,v_points from public.profiles where id=v_user;
  end if;
  return jsonb_build_object('coins',v_coins,'games',v_games,'wins',v_wins,'points',v_points,
    'reward',case when v_inserted=1 then v_reward else 0 end,'duplicate',v_inserted=0);
end;
$function$;

create or replace function public.create_qqcross_match(invited_user_ids uuid[], puzzle_data jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := auth.uid(); v_match uuid; v_friend uuid; v_seat integer := 2; v_count integer;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if puzzle_data is null or jsonb_typeof(puzzle_data) <> 'object' or octet_length(puzzle_data::text) > 200000 then raise exception 'Некорректные данные сканворда'; end if;
  if invited_user_ids is null or cardinality(invited_user_ids) < 1 or cardinality(invited_user_ids) > 3 then raise exception 'Выбери от одного до трёх друзей'; end if;
  select count(distinct x) into v_count from unnest(invited_user_ids) x;
  if v_count <> cardinality(invited_user_ids) or v_user = any(invited_user_ids) then raise exception 'В списке приглашений есть повтор или собственный аккаунт'; end if;
  if exists(select 1 from unnest(invited_user_ids) x where not exists(
    select 1 from public.friendships f where (f.user_id=v_user and f.friend_id=x) or (f.user_id=x and f.friend_id=v_user)
  )) then raise exception 'Приглашать можно только друзей'; end if;
  insert into public.matches(host_id,player_limit,status,puzzle_snapshot)
    values(v_user,cardinality(invited_user_ids)+1,'waiting',puzzle_data) returning id into v_match;
  insert into public.match_players(match_id,user_id,seat,status) values(v_match,v_user,1,'accepted');
  foreach v_friend in array invited_user_ids loop
    insert into public.match_players(match_id,user_id,seat,status) values(v_match,v_friend,v_seat,'invited');
    v_seat := v_seat + 1;
  end loop;
  return v_match;
end;
$function$;

create or replace function public.list_qqcross_match_invites()
returns table(match_id uuid,host_username text,player_limit integer,created_at timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select m.id,p.username,m.player_limit,m.created_at from public.matches m
  join public.match_players mp on mp.match_id=m.id join public.profiles p on p.id=m.host_id
  where mp.user_id=auth.uid() and mp.status='invited' and m.status='waiting' order by m.created_at desc;
$function$;

create or replace function public.respond_qqcross_match_invite(target_match_id uuid, accept_invite boolean)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_updated integer;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  update public.match_players mp set status=case when accept_invite then 'accepted' else 'declined' end
    from public.matches m where mp.match_id=target_match_id and mp.user_id=auth.uid()
      and mp.status='invited' and m.id=mp.match_id and m.status='waiting';
  get diagnostics v_updated = row_count;
  if v_updated=0 then raise exception 'Приглашение уже недоступно'; end if;
  return true;
end;
$function$;

create or replace function public.start_qqcross_match(target_match_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
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
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'avatar',p.avatar,'seat',mp.seat) order by mp.seat),'[]'::jsonb)
    into v_players from public.match_players mp join public.profiles p on p.id=mp.user_id
    where mp.match_id=target_match_id and mp.status='playing';
  return jsonb_build_object('match_id',target_match_id,'puzzle_snapshot',v_match.puzzle_snapshot,'players',v_players,'state_version',1,'status','active');
end;
$function$;

create or replace function public.get_qqcross_match(target_match_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_match public.matches%rowtype; v_players jsonb;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  select * into v_match from public.matches where id=target_match_id;
  if not found or not exists(select 1 from public.match_players where match_id=target_match_id and user_id=auth.uid() and status in ('accepted','playing','finished')) then raise exception 'Нет доступа к этой партии'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'avatar',p.avatar,'seat',mp.seat,'status',mp.status,'score',mp.score) order by mp.seat),'[]'::jsonb)
    into v_players from public.match_players mp join public.profiles p on p.id=mp.user_id
    where mp.match_id=target_match_id and mp.status in ('accepted','playing','finished');
  return jsonb_build_object('match_id',v_match.id,'host_id',v_match.host_id,'status',v_match.status,
    'player_limit',v_match.player_limit,'current_turn_user_id',v_match.current_turn_user_id,
    'turn_ends_at',v_match.turn_ends_at,'puzzle_snapshot',v_match.puzzle_snapshot,
    'game_state',v_match.game_state,'state_version',v_match.state_version,'players',v_players);
end;
$function$;

create or replace function public.submit_qqcross_match_turn(
  target_match_id uuid, expected_version integer, next_state jsonb,
  points_earned integer, next_user_id uuid, is_finished boolean default false
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_match public.matches%rowtype; v_updated integer;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if next_state is null or jsonb_typeof(next_state)<>'object' or octet_length(next_state::text)>200000 then raise exception 'Некорректное состояние игры'; end if;
  if points_earned is null or points_earned<0 or points_earned>1000 then raise exception 'Некорректное количество очков'; end if;
  select * into v_match from public.matches where id=target_match_id for update;
  if not found or v_match.status<>'active' or v_match.current_turn_user_id<>auth.uid() then raise exception 'Сейчас не твой ход'; end if;
  if v_match.state_version<>expected_version then raise exception 'Состояние партии уже обновилось. Загрузи последний ход'; end if;
  if not is_finished and not exists(select 1 from public.match_players where match_id=target_match_id and user_id=next_user_id and status='playing') then raise exception 'Следующий игрок не участвует в партии'; end if;
  update public.match_players set score=score+points_earned where match_id=target_match_id and user_id=auth.uid();
  update public.matches set game_state=next_state,state_version=state_version+1,
    current_turn_user_id=case when is_finished then null else next_user_id end,
    turn_started_at=case when is_finished then null else now() end,
    turn_ends_at=case when is_finished then null else now()+interval '60 seconds' end,
    status=case when is_finished then 'finished' else 'active' end,
    finished_at=case when is_finished then now() else null end
    where id=target_match_id and state_version=expected_version;
  get diagnostics v_updated=row_count;
  if v_updated=0 then raise exception 'Не удалось сохранить ход. Обнови партию'; end if;
  if is_finished then update public.match_players set status='finished' where match_id=target_match_id and status='playing'; end if;
  return jsonb_build_object('state_version',expected_version+1,'status',case when is_finished then 'finished' else 'active' end);
end;
$function$;

revoke all on function public.award_qqcross_match_result(integer,text) from public,anon;
revoke all on function public.create_qqcross_match(uuid[],jsonb) from public,anon;
revoke all on function public.list_qqcross_match_invites() from public,anon;
revoke all on function public.respond_qqcross_match_invite(uuid,boolean) from public,anon;
revoke all on function public.start_qqcross_match(uuid) from public,anon;
revoke all on function public.get_qqcross_match(uuid) from public,anon;
revoke all on function public.submit_qqcross_match_turn(uuid,integer,jsonb,integer,uuid,boolean) from public,anon;
grant execute on function public.award_qqcross_match_result(integer,text) to authenticated;
grant execute on function public.create_qqcross_match(uuid[],jsonb) to authenticated;
grant execute on function public.list_qqcross_match_invites() to authenticated;
grant execute on function public.respond_qqcross_match_invite(uuid,boolean) to authenticated;
grant execute on function public.start_qqcross_match(uuid) to authenticated;
grant execute on function public.get_qqcross_match(uuid) to authenticated;
grant execute on function public.submit_qqcross_match_turn(uuid,integer,jsonb,integer,uuid,boolean) to authenticated;
