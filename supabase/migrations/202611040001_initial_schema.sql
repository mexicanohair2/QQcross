-- QQcross: первая безопасная схема базы данных для Supabase
-- Версия 1. Создание таблиц, базовой защиты и стартового инвентаря.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  username_lower text generated always as (lower(username)) stored unique,
  avatar integer not null default 0 check (avatar between 0 and 9),
  coins integer not null default 0 check (coins >= 0),
  wins integer not null default 0 check (wins >= 0),
  games integer not null default 0 check (games >= 0),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (sender_id <> receiver_id),
  constraint friend_requests_unique_pair unique (sender_id, receiver_id)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_not_self check (user_id <> friend_id),
  constraint friendships_unique_pair unique (user_id, friend_id)
);

create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  puzzle_data jsonb not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid references public.puzzles(id),
  host_id uuid not null references public.profiles(id),
  player_limit integer not null check (player_limit between 2 and 4),
  status text not null default 'waiting' check (status in ('waiting','active','finished','cancelled')),
  current_turn_user_id uuid references public.profiles(id),
  turn_started_at timestamptz,
  turn_ends_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat integer not null check (seat between 1 and 4),
  status text not null default 'invited' check (status in ('invited','accepted','declined','playing','finished')),
  score integer not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  constraint match_players_unique_user unique (match_id, user_id),
  constraint match_players_unique_seat unique (match_id, seat)
);

create table if not exists public.match_moves (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  move_data jsonb not null,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('magnifier','clock','trash')),
  quantity integer not null default 5 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  constraint inventory_one_row_per_item unique (user_id, item_type)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('magnifier','clock','trash')),
  quantity integer not null check (quantity in (5,10)),
  price_coins integer not null check (price_coins in (100,200)),
  created_at timestamptz not null default now()
);

create index if not exists friend_requests_receiver_status_idx on public.friend_requests(receiver_id, status);
create index if not exists friendships_user_idx on public.friendships(user_id);
create index if not exists match_players_user_idx on public.match_players(user_id);
create index if not exists match_moves_match_created_idx on public.match_moves(match_id, created_at);
create index if not exists inventory_user_idx on public.inventory(user_id);

-- Создаёт профиль и выдаёт новичку по 5 предметов каждого типа.
create or replace function public.create_qqcross_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted_name text;
begin
  wanted_name := new.raw_user_meta_data ->> 'username';

  if wanted_name is null or wanted_name !~ '^[A-Za-z0-9_]{3,16}$'
     or exists (select 1 from public.profiles p where p.username_lower = lower(wanted_name)) then
    wanted_name := 'player_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  insert into public.profiles (id, username, avatar)
  values (new.id, wanted_name, 0);

  insert into public.inventory (user_id, item_type, quantity)
  values
    (new.id, 'magnifier', 5),
    (new.id, 'clock', 5),
    (new.id, 'trash', 5)
  on conflict (user_id, item_type) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_qqcross on auth.users;
create trigger on_auth_user_created_qqcross
after insert on auth.users
for each row execute procedure public.create_qqcross_profile();

-- Включаем защиту строк для всех таблиц.
alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.puzzles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_moves enable row level security;
alter table public.inventory enable row level security;
alter table public.purchases enable row level security;

-- Удаляем политики с теми же именами, если скрипт запускают повторно.
drop policy if exists "Profiles are visible to signed-in players" on public.profiles;
drop policy if exists "Players update own basic profile" on public.profiles;
drop policy if exists "Users see their friend requests" on public.friend_requests;
drop policy if exists "Users send their own friend requests" on public.friend_requests;
drop policy if exists "Receivers respond to friend requests" on public.friend_requests;
drop policy if exists "Users see their friendships" on public.friendships;
drop policy if exists "Signed-in users see published puzzles" on public.puzzles;
drop policy if exists "Players see matches they joined" on public.matches;
drop policy if exists "Players see match participants" on public.match_players;
drop policy if exists "Players see moves in their matches" on public.match_moves;
drop policy if exists "Players see own inventory" on public.inventory;
drop policy if exists "Players see own purchases" on public.purchases;

-- В профилях видны только общедоступные поля; монеты и инвентарь не открываем другим.
create policy "Profiles are visible to signed-in players"
on public.profiles for select to authenticated
using (true);

create policy "Players update own basic profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Клиенту разрешено менять только ник и аватар, но не монеты/очки/победы.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, avatar, wins, games, points, created_at) on public.profiles to authenticated;
grant update (username, avatar) on public.profiles to authenticated;

create policy "Users see their friend requests"
on public.friend_requests for select to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users send their own friend requests"
on public.friend_requests for insert to authenticated
with check (auth.uid() = sender_id and sender_id <> receiver_id);

create policy "Receivers respond to friend requests"
on public.friend_requests for update to authenticated
using (auth.uid() = receiver_id and status = 'pending')
with check (auth.uid() = receiver_id and status in ('accepted','rejected'));

create policy "Users see their friendships"
on public.friendships for select to authenticated
using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Signed-in users see published puzzles"
on public.puzzles for select to authenticated
using (is_published = true);

-- Чтение партий доступно только их участникам. Создание/изменение партий
-- будет выполняться защищёнными серверными функциями на следующем этапе.
create or replace function public.is_qqcross_match_player(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_players mp
    where mp.match_id = target_match_id and mp.user_id = auth.uid()
      and mp.status in ('accepted','playing','finished')
  );
$$;

revoke all on function public.is_qqcross_match_player(uuid) from public;
grant execute on function public.is_qqcross_match_player(uuid) to authenticated;

create policy "Players see matches they joined"
on public.matches for select to authenticated
using (public.is_qqcross_match_player(id) or auth.uid() = host_id);

create policy "Players see match participants"
on public.match_players for select to authenticated
using (public.is_qqcross_match_player(match_id) or auth.uid() = user_id);

create policy "Players see moves in their matches"
on public.match_moves for select to authenticated
using (public.is_qqcross_match_player(match_id));

create policy "Players see own inventory"
on public.inventory for select to authenticated
using (auth.uid() = user_id);

create policy "Players see own purchases"
on public.purchases for select to authenticated
using (auth.uid() = user_id);

-- Пока запрещаем клиенту напрямую менять монеты, инвентарь, покупки и ходы.
-- Позже добавим безопасные функции для покупки, приглашений и ходов.
revoke insert, update, delete on public.friendships from anon, authenticated;
revoke insert, update, delete on public.matches from anon, authenticated;
revoke insert, update, delete on public.match_players from anon, authenticated;
revoke insert, update, delete on public.match_moves from anon, authenticated;
revoke insert, update, delete on public.inventory from anon, authenticated;
revoke insert, update, delete on public.purchases from anon, authenticated;
revoke insert, update, delete on public.puzzles from anon, authenticated;

grant select on public.friend_requests, public.friendships, public.puzzles,
  public.matches, public.match_players, public.match_moves,
  public.inventory, public.purchases to authenticated;
grant insert on public.friend_requests to authenticated;
grant update (status, responded_at) on public.friend_requests to authenticated;

-- Включаем Realtime для игровых таблиц. Повторный запуск не добавит дубликаты.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['matches','match_players','match_moves','inventory'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end $$;
