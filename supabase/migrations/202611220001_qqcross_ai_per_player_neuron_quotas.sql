-- Per-player daily AI neuron allowance for QQCross.
-- This is an application quota; Cloudflare's Workers AI quota remains account-wide.

create table if not exists public.qqcross_ai_neuron_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  neurons_used integer not null default 0 check (neurons_used >= 0 and neurons_used <= 10000),
  neurons_reserved integer not null default 0 check (neurons_reserved >= 0 and neurons_reserved <= 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date),
  check (neurons_used + neurons_reserved <= 10000)
);

create table if not exists public.qqcross_ai_neuron_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  reserved_neurons integer not null check (reserved_neurons > 0 and reserved_neurons <= 10000),
  actual_neurons integer check (actual_neurons is null or actual_neurons >= 0),
  status text not null default 'pending' check (status in ('pending', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists qqcross_ai_neuron_reservations_user_day_idx
  on public.qqcross_ai_neuron_reservations(user_id, usage_date, status);

alter table public.qqcross_ai_neuron_usage enable row level security;
alter table public.qqcross_ai_neuron_reservations enable row level security;

revoke all on table public.qqcross_ai_neuron_usage from public, anon, authenticated;
revoke all on table public.qqcross_ai_neuron_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.qqcross_ai_neuron_usage to service_role;
grant select, insert, update, delete on table public.qqcross_ai_neuron_reservations to service_role;

create or replace function public.reserve_qqcross_ai_neurons(
  p_user_id uuid,
  p_neurons integer
)
returns table (
  reservation_id uuid,
  allowed boolean,
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
  v_reset timestamptz;
  v_used integer;
  v_reserved integer;
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;
  if p_neurons is null or p_neurons < 1 or p_neurons > 10000 then
    raise exception 'Reservation must be between 1 and 10000 neurons';
  end if;

  v_reset := ((v_day + 1)::timestamp at time zone 'UTC');

  insert into public.qqcross_ai_neuron_usage(user_id, usage_date)
  values (p_user_id, v_day)
  on conflict (user_id, usage_date) do nothing;

  select u.neurons_used, u.neurons_reserved
    into v_used, v_reserved
  from public.qqcross_ai_neuron_usage as u
  where u.user_id = p_user_id and u.usage_date = v_day
  for update;

  if v_used + v_reserved + p_neurons > 10000 then
    return query
      select null::uuid, false, v_used, v_reserved,
             greatest(0, 10000 - v_used - v_reserved), 10000, v_reset;
    return;
  end if;

  update public.qqcross_ai_neuron_usage as u
  set neurons_reserved = u.neurons_reserved + p_neurons,
      updated_at = now()
  where u.user_id = p_user_id and u.usage_date = v_day;

  insert into public.qqcross_ai_neuron_reservations(user_id, usage_date, reserved_neurons)
  values (p_user_id, v_day, p_neurons)
  returning id into v_id;

  return query
    select v_id, true, v_used, v_reserved + p_neurons,
           greatest(0, 10000 - v_used - v_reserved - p_neurons), 10000, v_reset;
end;
$$;

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
      select true, coalesce(v_reservation.actual_neurons, 0), v_used, v_reserved,
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

  select u.neurons_used, u.neurons_reserved
    into v_used, v_reserved
  from public.qqcross_ai_neuron_usage as u
  where u.user_id = p_user_id and u.usage_date = v_day;

  return query
    select v_used, v_reserved, greatest(0, 10000 - v_used - v_reserved),
           10000, ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.reserve_qqcross_ai_neurons(uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_qqcross_ai_neurons(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_qqcross_ai_neuron_balance(uuid) from public, anon, authenticated;

grant execute on function public.reserve_qqcross_ai_neurons(uuid, integer) to service_role;
grant execute on function public.settle_qqcross_ai_neurons(uuid, uuid, integer) to service_role;
grant execute on function public.get_qqcross_ai_neuron_balance(uuid) to service_role;
