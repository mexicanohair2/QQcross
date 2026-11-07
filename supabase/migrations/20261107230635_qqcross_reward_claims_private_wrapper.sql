create schema if not exists qqcross_private;
revoke all on schema qqcross_private from public, anon;
grant usage on schema qqcross_private to authenticated;

create or replace function qqcross_private.claim_qqcross_progress_reward(p_reward_key text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_keys text[] := array[
    'scanword_1','scanword_5','scanword_25','scanword_50','scanword_100',
    'wordle_1','wordle_25','wordle_100',
    'wow_5','wow_25','wow_100',
    'search_5','search_25',
    'cody_5','cody_25','cody_100',
    'daily_3','daily_7','daily_14','daily_30','daily_100',
    'words_25','words_100','groups_5'
  ];
  v_index integer;
  v_item_type text;
  v_reward_quantity integer;
  v_current_quantity integer;
  v_inserted boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  v_index := array_position(v_keys, p_reward_key);
  if v_index is null then raise exception 'Unknown achievement reward'; end if;
  if not exists (
    select 1 from public.qqcross_player_progress p
    where p.user_id = v_user_id
      and p.progress #> array['achievements', p_reward_key] is not null
  ) then raise exception 'Achievement is not unlocked'; end if;

  v_item_type := case mod(v_index - 1, 3)
    when 0 then 'magnifier' when 1 then 'clock' else 'trash'
  end;
  if v_index <= 4 then
    v_reward_quantity := round(2 * power(1.5, v_index - 1))::integer;
  else
    v_reward_quantity := least(18, round(2 * power(1.5, 3) + (v_index - 4) * 2)::integer);
  end if;

  insert into public.qqcross_reward_claims(user_id, reward_key, item_type, quantity)
  values (v_user_id, p_reward_key, v_item_type, v_reward_quantity)
  on conflict (user_id, reward_key) do nothing
  returning true into v_inserted;

  if coalesce(v_inserted, false) then
    insert into public.inventory(user_id, item_type, quantity)
    values (v_user_id, v_item_type, v_reward_quantity)
    on conflict (user_id, item_type)
    do update set quantity = inventory.quantity + excluded.quantity, updated_at = now()
    returning quantity into v_current_quantity;
  else
    select quantity into v_current_quantity from public.inventory
    where user_id = v_user_id and item_type = v_item_type;
  end if;

  return jsonb_build_object(
    'item_type', v_item_type,
    'reward_quantity', v_reward_quantity,
    'current_quantity', coalesce(v_current_quantity, 0),
    'already_claimed', not coalesce(v_inserted, false)
  );
end;
$$;

revoke all on function qqcross_private.claim_qqcross_progress_reward(text) from public, anon;
grant execute on function qqcross_private.claim_qqcross_progress_reward(text) to authenticated;

create or replace function public.claim_qqcross_progress_reward(p_reward_key text)
returns jsonb
language sql
security invoker
set search_path = public, qqcross_private, pg_temp
as $$
  select qqcross_private.claim_qqcross_progress_reward(p_reward_key);
$$;
revoke all on function public.claim_qqcross_progress_reward(text) from public, anon;
grant execute on function public.claim_qqcross_progress_reward(text) to authenticated;

drop policy if exists "No direct access to reward claims" on public.qqcross_reward_claims;
create policy "No direct access to reward claims"
on public.qqcross_reward_claims for all to authenticated
using (false) with check (false);
