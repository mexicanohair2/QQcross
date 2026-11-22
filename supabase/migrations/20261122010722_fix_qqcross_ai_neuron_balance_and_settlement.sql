-- Keep balance reads non-null for players who have not used AI yet,
-- and make repeated settlement responses report the amount actually charged.

create or replace function public.settle_qqcross_ai_neurons(
  p_user_id uuid,
  p_reservation_id uuid,
  p_actual_neurons integer
)
returns table (
  settled boolean,
  charged_neurons integer,
  neurons_used integer,
  neurons_reserved integer,
  neurons_remaining integer,
  daily_limit integer,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reservation public.qqcross_ai_neuron_reservations%rowtype;
  v_used integer;
  v_reserved integer;
  v_charge integer;
  v_reset timestamptz;
begin
  if p_user_id is null or p_reservation_id is null then
    raise exception 'User id and reservation id are required';
  end if;
  if p_actual_neurons is null or p_actual_neurons < 0 then
    raise exception 'Actual neuron count cannot be negative';
  end if;

  select * into v_reservation
  from public.qqcross_ai_neuron_reservations as r
  where r.id = p_reservation_id and r.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Neuron reservation not found';
  end if;

  v_reset := ((v_reservation.usage_date + 1)::timestamp at time zone 'UTC');

  if v_reservation.status = 'settled' then
    select u.neurons_used, u.neurons_reserved
      into v_used, v_reserved
    from public.qqcross_ai_neuron_usage as u
    where u.user_id = p_user_id and u.usage_date = v_reservation.usage_date;
    return query
      select true,
             least(coalesce(v_reservation.actual_neurons, 0), v_reservation.reserved_neurons),
             v_used, v_reserved,
             greatest(0, 10000 - v_used - v_reserved), 10000, v_reset;
    return;
  end if;

  select u.neurons_used, u.neurons_reserved
    into v_used, v_reserved
  from public.qqcross_ai_neuron_usage as u
  where u.user_id = p_user_id and u.usage_date = v_reservation.usage_date
  for update;

  v_charge := least(p_actual_neurons, v_reservation.reserved_neurons);

  update public.qqcross_ai_neuron_usage as u
  set neurons_used = least(10000, u.neurons_used + v_charge),
      neurons_reserved = greatest(0, u.neurons_reserved - v_reservation.reserved_neurons),
      updated_at = now()
  where u.user_id = p_user_id and u.usage_date = v_reservation.usage_date
  returning u.neurons_used, u.neurons_reserved into v_used, v_reserved;

  update public.qqcross_ai_neuron_reservations as r
  set actual_neurons = p_actual_neurons,
      status = 'settled',
      settled_at = now()
  where r.id = p_reservation_id;

  return query
    select true, v_charge, v_used, v_reserved,
           greatest(0, 10000 - v_used - v_reserved), 10000, v_reset;
end;
$$;

create or replace function public.get_qqcross_ai_neuron_balance(p_user_id uuid)
returns table (
  neurons_used integer,
  neurons_reserved integer,
  neurons_remaining integer,
  daily_limit integer,
  resets_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_day date := (now() at time zone 'UTC')::date;
  v_used integer := 0;
  v_reserved integer := 0;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  select coalesce(max(u.neurons_used), 0),
         coalesce(max(u.neurons_reserved), 0)
    into v_used, v_reserved
  from public.qqcross_ai_neuron_usage as u
  where u.user_id = p_user_id and u.usage_date = v_day;

  return query
    select v_used, v_reserved, greatest(0, 10000 - v_used - v_reserved),
           10000, ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.settle_qqcross_ai_neurons(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_qqcross_ai_neuron_balance(uuid) from public, anon, authenticated;
grant execute on function public.settle_qqcross_ai_neurons(uuid, uuid, integer) to service_role;
grant execute on function public.get_qqcross_ai_neuron_balance(uuid) to service_role;
