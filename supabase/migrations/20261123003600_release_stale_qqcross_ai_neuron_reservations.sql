-- Automatically release abandoned AI neuron reservations after the maximum request window.
create or replace function public.release_stale_qqcross_ai_neuron_reservations(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reservation record;
  v_released integer := 0;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  for v_reservation in
    select r.id, r.usage_date, r.reserved_neurons
    from public.qqcross_ai_neuron_reservations as r
    where r.user_id = p_user_id
      and r.status = 'pending'
      and r.created_at < now() - interval '3 minutes'
    order by r.created_at
    for update skip locked
  loop
    update public.qqcross_ai_neuron_usage as u
    set neurons_reserved = greatest(0, u.neurons_reserved - v_reservation.reserved_neurons),
        updated_at = now()
    where u.user_id = p_user_id
      and u.usage_date = v_reservation.usage_date;

    update public.qqcross_ai_neuron_reservations as r
    set actual_neurons = 0,
        status = 'settled',
        settled_at = now()
    where r.id = v_reservation.id
      and r.status = 'pending';

    v_released := v_released + 1;
  end loop;

  return v_released;
end;
$$;

revoke all on function public.release_stale_qqcross_ai_neuron_reservations(uuid) from public, anon, authenticated;
grant execute on function public.release_stale_qqcross_ai_neuron_reservations(uuid) to service_role;
