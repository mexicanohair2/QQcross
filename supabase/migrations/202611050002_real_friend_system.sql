-- QQcross: настоящие запросы в друзья и поиск зарегистрированных игроков.
-- Все изменения дружбы выполняются в транзакционных SECURITY DEFINER RPC.

create or replace function public.search_qqcross_players(search_text text)
returns table(id uuid, username text, avatar integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.avatar
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(btrim(coalesce(search_text, ''))) >= 2
    and p.username_lower like lower(btrim(search_text)) || '%'
  order by p.username_lower
  limit 12;
$$;

create or replace function public.send_qqcross_friend_request(target_username text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;

  select p.id into target_id
  from public.profiles p
  where p.username_lower = lower(btrim(target_username));

  if target_id is null then
    raise exception 'Игрок с таким ником не найден';
  end if;
  if target_id = auth.uid() then
    raise exception 'Нельзя добавить самого себя';
  end if;
  if exists (
    select 1 from public.friendships f
    where (f.user_id = auth.uid() and f.friend_id = target_id)
       or (f.user_id = target_id and f.friend_id = auth.uid())
  ) then
    raise exception 'Вы уже друзья';
  end if;
  if exists (
    select 1 from public.friend_requests r
    where r.sender_id = target_id and r.receiver_id = auth.uid()
      and r.status = 'pending'
  ) then
    raise exception 'У этого игрока уже есть для тебя заявка — проверь входящие';
  end if;

  insert into public.friend_requests(sender_id, receiver_id, status)
  values(auth.uid(), target_id, 'pending')
  on conflict(sender_id, receiver_id) do update
    set status = 'pending', created_at = now(), responded_at = null
    where public.friend_requests.status = 'rejected'
  returning id into request_id;

  if request_id is null then
    raise exception 'Заявка уже отправлена';
  end if;
  return request_id;
end;
$$;

create or replace function public.respond_qqcross_friend_request(request_id uuid, accept_request boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.friend_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;

  select * into req
  from public.friend_requests r
  where r.id = request_id
  for update;

  if not found or req.receiver_id <> auth.uid() or req.status <> 'pending' then
    raise exception 'Заявка не найдена или уже обработана';
  end if;

  update public.friend_requests
  set status = case when accept_request then 'accepted' else 'rejected' end,
      responded_at = now()
  where id = request_id;

  if accept_request then
    insert into public.friendships(user_id, friend_id)
    values (req.sender_id, req.receiver_id), (req.receiver_id, req.sender_id)
    on conflict(user_id, friend_id) do nothing;
  end if;
  return true;
end;
$$;

create or replace function public.list_qqcross_friends()
returns table(id uuid, username text, avatar integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.avatar
  from public.friendships f
  join public.profiles p
    on p.id = case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  where auth.uid() is not null
    and (f.user_id = auth.uid() or f.friend_id = auth.uid())
  order by p.username_lower;
$$;

create or replace function public.list_qqcross_incoming_friend_requests()
returns table(request_id uuid, sender_id uuid, username text, avatar integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.id, p.username, p.avatar, r.created_at
  from public.friend_requests r
  join public.profiles p on p.id = r.sender_id
  where auth.uid() is not null
    and r.receiver_id = auth.uid()
    and r.status = 'pending'
  order by r.created_at desc;
$$;

revoke all on function public.search_qqcross_players(text) from public;
revoke all on function public.send_qqcross_friend_request(text) from public;
revoke all on function public.respond_qqcross_friend_request(uuid, boolean) from public;
revoke all on function public.list_qqcross_friends() from public;
revoke all on function public.list_qqcross_incoming_friend_requests() from public;

grant execute on function public.search_qqcross_players(text) to authenticated;
grant execute on function public.send_qqcross_friend_request(text) to authenticated;
grant execute on function public.respond_qqcross_friend_request(uuid, boolean) to authenticated;
grant execute on function public.list_qqcross_friends() to authenticated;
grant execute on function public.list_qqcross_incoming_friend_requests() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships'
  ) then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
