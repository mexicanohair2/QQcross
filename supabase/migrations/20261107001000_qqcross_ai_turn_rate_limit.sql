create table if not exists public.qqcross_ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default date_trunc('hour', now()),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.qqcross_ai_usage enable row level security;
revoke all on table public.qqcross_ai_usage from anon, authenticated;

create or replace function public.consume_qqcross_ai_turn_limit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count integer;
begin
  insert into public.qqcross_ai_usage(user_id, window_started_at, request_count)
  values (p_user_id, date_trunc('hour', now()), 1)
  on conflict (user_id) do update
    set window_started_at = case
          when public.qqcross_ai_usage.window_started_at < date_trunc('hour', now())
          then date_trunc('hour', now())
          else public.qqcross_ai_usage.window_started_at
        end,
        request_count = case
          when public.qqcross_ai_usage.window_started_at < date_trunc('hour', now())
          then 1
          else public.qqcross_ai_usage.request_count + 1
        end;
  select request_count into current_count
  from public.qqcross_ai_usage where user_id = p_user_id;
  return current_count <= 30;
end;
$$;
revoke all on function public.consume_qqcross_ai_turn_limit(uuid) from public, anon, authenticated;
grant execute on function public.consume_qqcross_ai_turn_limit(uuid) to service_role;
