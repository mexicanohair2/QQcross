alter table public.inventory drop constraint if exists inventory_item_type_check;
alter table public.inventory add constraint inventory_item_type_check
  check (item_type = any (array['magnifier','clock','trash','bulb']::text[]));

create table if not exists private.qqcross_level_reward_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null check (game_key in ('scanword','search','wow','cody')),
  level_no integer not null check (level_no between 1 and 1000),
  awarded_at timestamptz not null default now(),
  primary key (user_id, game_key, level_no)
);
revoke all on table private.qqcross_level_reward_claims from public, anon, authenticated;

create or replace function private.purchase_qqcross_items(item_type text, quantity integer)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := auth.uid(); v_price integer; v_coins integer; v_quantity integer;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if item_type not in ('magnifier','clock','trash','bulb') or quantity not in (5,10) then raise exception 'Некорректная покупка'; end if;
  v_price := case when quantity=5 then 100 else 200 end;
  select p.coins into v_coins from public.profiles p where p.id=v_user for update;
  if v_coins is null then raise exception 'Профиль не найден'; end if;
  if v_coins<v_price then raise exception 'Не хватает монет'; end if;
  update public.profiles set coins=coins-v_price where id=v_user returning coins into v_coins;
  insert into public.inventory(user_id,item_type,quantity) values(v_user,purchase_qqcross_items.item_type,quantity)
  on conflict(user_id,item_type) do update set quantity=public.inventory.quantity+excluded.quantity,updated_at=now()
  returning public.inventory.quantity into v_quantity;
  insert into public.purchases(user_id,item_type,quantity,price_coins) values(v_user,purchase_qqcross_items.item_type,quantity,v_price);
  return jsonb_build_object('coins',v_coins,'quantity',v_quantity);
end;
$function$;

create or replace function private.use_qqcross_item(item_type text)
returns integer language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := auth.uid(); v_quantity integer;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if item_type not in ('magnifier','clock','trash','bulb') then raise exception 'Некорректный предмет'; end if;
  update public.inventory set quantity=quantity-1,updated_at=now()
  where user_id=v_user and public.inventory.item_type=use_qqcross_item.item_type and quantity>0
  returning quantity into v_quantity;
  if v_quantity is null then raise exception 'Предметы закончились'; end if;
  return v_quantity;
end;
$function$;

create or replace function private.award_qqcross_level_reward(p_game_key text,p_level integer)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := auth.uid(); v_inserted boolean := false; v_coins integer; v_today_count integer;
begin
  if v_user is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if p_game_key not in ('scanword','search','wow','cody') or p_level not between 1 and 1000 then raise exception 'Некорректная награда за уровень'; end if;
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

revoke all on function private.purchase_qqcross_items(text,integer) from public,anon;
revoke all on function private.use_qqcross_item(text) from public,anon;
revoke all on function private.award_qqcross_level_reward(text,integer) from public,anon;
grant execute on function private.purchase_qqcross_items(text,integer) to authenticated,service_role;
grant execute on function private.use_qqcross_item(text) to authenticated,service_role;
grant execute on function private.award_qqcross_level_reward(text,integer) to authenticated,service_role;

create or replace function public.award_qqcross_level_reward(p_game_key text,p_level integer)
returns jsonb language sql set search_path to ''
as $function$ select private.award_qqcross_level_reward($1,$2) $function$;
revoke all on function public.award_qqcross_level_reward(text,integer) from public,anon;
grant execute on function public.award_qqcross_level_reward(text,integer) to authenticated,service_role;
