
create or replace function private.award_qqcross_match_result(points integer, match_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_reward integer;
  v_points integer;
  v_coins integer;
  v_games integer;
  v_wins integer;
  v_total_points integer;
  v_inserted integer;
  v_match_uuid uuid;
  v_last_solo timestamptz;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if points is null or points < 0 or points > 10000 then raise exception 'Некорректный результат'; end if;
  if match_id is null or length(match_id) < 5 or length(match_id) > 100 then raise exception 'Некорректный номер партии'; end if;

  select coins,games,wins,profiles.points into v_coins,v_games,v_wins,v_total_points
    from public.profiles where id=v_user for update;
  if not found then raise exception 'Профиль не найден'; end if;

  if exists(select 1 from public.match_rewards where user_id=v_user and public.match_rewards.match_id=award_qqcross_match_result.match_id) then
    return jsonb_build_object('coins',v_coins,'games',v_games,'wins',v_wins,'points',v_total_points,'reward',0,'duplicate',true);
  end if;

  begin
    v_match_uuid:=match_id::uuid;
  exception when invalid_text_representation then
    v_match_uuid:=null;
  end;

  if v_match_uuid is not null then
    select (m.game_state->>'scores')::integer into v_points
    from public.matches m join public.match_players mp on mp.match_id=m.id
    where m.id=v_match_uuid and m.status='finished' and mp.user_id=v_user and mp.status='finished';
    if v_points is null then raise exception 'Завершённая онлайн-партия не найдена'; end if;
    v_points:=greatest(0,least(v_points,10000));
    v_reward:=greatest(10,v_points);
  else
    if match_id not like 'match-%' then raise exception 'Недопустимый идентификатор партии'; end if;
    select max(created_at) into v_last_solo from public.match_rewards
      where user_id=v_user and match_id like 'match-%';
    if v_last_solo is not null and v_last_solo>now()-interval '10 minutes' then
      raise exception 'Награда за одиночную игру уже получена недавно';
    end if;
    v_points:=least(points,250);
    v_reward:=10;
  end if;

  insert into public.match_rewards(user_id,match_id,points,reward)
    values(v_user,award_qqcross_match_result.match_id,v_points,v_reward)
    on conflict(user_id,match_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=1 then
    update public.profiles set games=games+1,wins=wins+1,
      points=public.profiles.points+v_points,coins=coins+v_reward
      where id=v_user returning coins,games,wins,public.profiles.points into v_coins,v_games,v_wins,v_total_points;
  end if;
  return jsonb_build_object('coins',v_coins,'games',v_games,'wins',v_wins,'points',v_total_points,
    'reward',case when v_inserted=1 then v_reward else 0 end,'duplicate',v_inserted=0);
end;
$function$;
