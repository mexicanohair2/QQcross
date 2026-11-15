alter table private.qqcross_level_reward_claims drop constraint if exists qqcross_level_reward_claims_game_key_check;
alter table private.qqcross_level_reward_claims add constraint qqcross_level_reward_claims_game_key_check
  check (game_key in ('scanword','search','wow','cody','wordle'));
alter table private.qqcross_level_reward_claims drop constraint if exists qqcross_level_reward_claims_level_no_check;
alter table private.qqcross_level_reward_claims add constraint qqcross_level_reward_claims_level_no_check
  check (level_no between 1 and 2147483647);

create or replace function private.award_qqcross_level_reward(p_game_key text,p_level integer)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := auth.uid(); v_inserted boolean := false; v_coins integer; v_today_count integer;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if p_game_key not in ('scanword','search','wow','cody','wordle') or p_level not between 1 and 2147483647 then raise exception 'Некорректная награда за уровень'; end if;
  select p.coins into v_coins from public.profiles p where p.id=v_user for update;
  if v_coins is null then raise exception 'Профиль не найден'; end if;
  select count(*) into v_today_count from private.qqcross_level_reward_claims r
  where r.user_id=v_user and r.awarded_at>=date_trunc('day',now());
  if v_today_count>=100 then raise exception 'Достигнут дневной лимит наград'; end if;
  insert into private.qqcross_level_reward_claims(user_id,game_key,level_no) values(v_user,p_game_key,p_level)
  on conflict(user_id,game_key,level_no) do nothing returning true into v_inserted;
  if coalesce(v_inserted,false) then update public.profiles set coins=coins+5 where id=v_user returning coins into v_coins; end if;
  return jsonb_build_object('coins',v_coins,'reward',case when coalesce(v_inserted,false) then 5 else 0 end,'already_claimed',not coalesce(v_inserted,false));
end;
$function$;