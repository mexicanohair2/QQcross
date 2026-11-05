-- QQcross: расширенный поиск игроков и список отправленных заявок.
-- Безопасные RPC: клиент получает только публичные поля профиля и состояние связи с текущим игроком.

create or replace function public.search_qqcross_players_with_status(search_text text)
returns table(id uuid, username text, avatar integer, relation_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.avatar,
    case
      when exists (
        select 1 from public.friendships f
        where (f.user_id = auth.uid() and f.friend_id = p.id)
           or (f.friend_id = auth.uid() and f.user_id = p.id)
      ) then 'friends'
      when exists (
        select 1 from public.friend_requests r
        where r.sender_id = p.id and r.receiver_id = auth.uid()
          and r.status = 'pending'
      ) then 'incoming'
      when exists (
        select 1 from public.friend_requests r
        where r.sender_id = auth.uid() and r.receiver_id = p.id
          and r.status = 'pending'
      ) then 'outgoing'
      else 'none'
    end
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and length(btrim(coalesce(search_text, ''))) >= 2
    and position(lower(btrim(search_text)) in p.username_lower) > 0
  order by
    case when p.username_lower like lower(btrim(search_text)) || '%' then 0 else 1 end,
    p.username_lower
  limit 20;
$$;

create or replace function public.list_qqcross_outgoing_friend_requests()
returns table(request_id uuid, receiver_id uuid, username text, avatar integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, p.id, p.username, p.avatar, r.created_at
  from public.friend_requests r
  join public.profiles p on p.id = r.receiver_id
  where auth.uid() is not null
    and r.sender_id = auth.uid()
    and r.status = 'pending'
  order by r.created_at desc;
$$;

revoke all on function public.search_qqcross_players_with_status(text) from public;
revoke all on function public.list_qqcross_outgoing_friend_requests() from public;
grant execute on function public.search_qqcross_players_with_status(text) to authenticated;
grant execute on function public.list_qqcross_outgoing_friend_requests() to authenticated;
