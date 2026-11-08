create table if not exists public.qqcross_player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint qqcross_player_progress_object check (jsonb_typeof(progress) = 'object'),
  constraint qqcross_player_progress_size check (pg_column_size(progress) <= 65536)
);

alter table public.qqcross_player_progress enable row level security;

revoke all on table public.qqcross_player_progress from anon, authenticated;
grant select, insert, update on table public.qqcross_player_progress to authenticated;

drop policy if exists "Players read own QQCross progression" on public.qqcross_player_progress;
drop policy if exists "Players create own QQCross progression" on public.qqcross_player_progress;
drop policy if exists "Players update own QQCross progression" on public.qqcross_player_progress;

create policy "Players read own QQCross progression"
on public.qqcross_player_progress for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Players create own QQCross progression"
on public.qqcross_player_progress for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Players update own QQCross progression"
on public.qqcross_player_progress for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
