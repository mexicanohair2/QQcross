-- QQCross Party invitations use the existing friendships and profile tables.
-- The invite table is only a room invitation inbox; it does not create a separate friend system.

create table if not exists public.qq_party_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.qq_party_rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint qq_party_invites_distinct_users check (sender_id<>recipient_id)
);
create unique index if not exists qq_party_invites_pending_unique
  on public.qq_party_invites(room_id,recipient_id)
  where status='pending';
create index if not exists qq_party_invites_recipient_idx
  on public.qq_party_invites(recipient_id,status,created_at desc);
create index if not exists qq_party_invites_sender_idx
  on public.qq_party_invites(sender_id,created_at desc);

alter table public.qq_party_invites enable row level security;
drop policy if exists qq_party_invites_participant_read on public.qq_party_invites;
create policy qq_party_invites_participant_read
  on public.qq_party_invites for select to authenticated
  using (sender_id=auth.uid() or recipient_id=auth.uid());
revoke all on table public.qq_party_invites from public,anon,authenticated;
grant select on table public.qq_party_invites to authenticated;

create or replace function private.qq_party_list_friends(p_room_id uuid)
returns table(
  user_id uuid,
  username text,
  avatar integer,
  in_room boolean,
  already_invited boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
begin
  select * into v_room
    from public.qq_party_rooms r
    where r.id=p_room_id;
  if not found or not private.qq_party_is_member(p_room_id) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.status<>'waiting' then
    raise exception 'ROOM_NOT_WAITING';
  end if;

  return query
  select
    f.friend_id,
    p.username,
    p.avatar,
    exists(
      select 1 from public.qq_party_players rp
      where rp.room_id=p_room_id and rp.user_id=f.friend_id
    ) as in_room,
    exists(
      select 1 from public.qq_party_invites i
      where i.room_id=p_room_id
        and i.recipient_id=f.friend_id
        and i.status='pending'
    ) as already_invited
  from public.friendships f
  join public.profiles p on p.id=f.friend_id
  where f.user_id=v_uid
  order by p.username_lower;
end
$function$;

create or replace function private.qq_party_invite_friend(
  p_room_id uuid,
  p_friend_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_friend public.profiles;
  v_existing public.qq_party_invites;
  v_invite public.qq_party_invites;
begin
  if p_friend_id is null or p_friend_id=v_uid then raise exception 'INVALID_FRIEND'; end if;

  select * into v_room
    from public.qq_party_rooms r
    where r.id=p_room_id
    for update;
  if not found or not private.qq_party_is_member(p_room_id) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.status<>'waiting' or v_room.expires_at<=now() then
    raise exception 'ROOM_NOT_WAITING';
  end if;
  if not exists(
    select 1 from public.friendships f
    where (f.user_id=v_uid and f.friend_id=p_friend_id)
       or (f.user_id=p_friend_id and f.friend_id=v_uid)
  ) then raise exception 'NOT_A_FRIEND'; end if;

  select * into v_friend from public.profiles p where p.id=p_friend_id;
  if not found then raise exception 'FRIEND_PROFILE_NOT_FOUND'; end if;

  if exists(
    select 1 from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=p_friend_id
  ) then raise exception 'ALREADY_IN_ROOM'; end if;

  select * into v_existing
    from public.qq_party_invites i
    where i.room_id=p_room_id
      and i.recipient_id=p_friend_id
      and i.status='pending';
  if found then
    return jsonb_build_object(
      'ok',true,'already_pending',true,'invite_id',v_existing.id,
      'room_id',p_room_id,'code',v_room.code,'game',v_room.game,
      'friend_username',v_friend.username
    );
  end if;

  insert into public.qq_party_invites(room_id,sender_id,recipient_id)
    values(p_room_id,v_uid,p_friend_id)
    returning * into v_invite;

  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(
      p_room_id,v_uid,'player_invited',
      jsonb_build_object('invite_id',v_invite.id,'recipient_id',p_friend_id)
    );

  return jsonb_build_object(
    'ok',true,'already_pending',false,'invite_id',v_invite.id,
    'room_id',p_room_id,'code',v_room.code,'game',v_room.game,
    'friend_username',v_friend.username
  );
end
$function$;

create or replace function private.qq_party_list_my_invites()
returns table(
  invite_id uuid,
  room_id uuid,
  code text,
  game text,
  player_limit integer,
  sender_id uuid,
  sender_username text,
  sender_avatar integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    i.id,
    r.id,
    r.code,
    r.game,
    r.player_limit,
    i.sender_id,
    p.username,
    p.avatar,
    i.created_at
  from public.qq_party_invites i
  join public.qq_party_rooms r on r.id=i.room_id
  join public.profiles p on p.id=i.sender_id
  where i.recipient_id=auth.uid()
    and i.status='pending'
    and r.status='waiting'
    and r.expires_at>now()
  order by i.created_at desc
$function$;

create or replace function private.qq_party_respond_invite(
  p_invite_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_invite public.qq_party_invites;
  v_room public.qq_party_rooms;
  v_username text;
  v_avatar integer;
  v_seat integer;
begin
  select * into v_invite
    from public.qq_party_invites i
    where i.id=p_invite_id
      and i.recipient_id=v_uid
      and i.status='pending'
    for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;

  if not p_accept then
    update public.qq_party_invites
      set status='declined',responded_at=now()
      where id=p_invite_id;
    return jsonb_build_object('ok',true,'accepted',false);
  end if;

  select * into v_room
    from public.qq_party_rooms r
    where r.id=v_invite.room_id
    for update;
  if not found or v_room.status<>'waiting' or v_room.expires_at<=now() then
    update public.qq_party_invites
      set status='expired',responded_at=now()
      where id=p_invite_id;
    raise exception 'ROOM_NOT_WAITING';
  end if;

  if exists(
    select 1 from public.qq_party_players p
    where p.room_id=v_room.id and p.user_id=v_uid
  ) then
    update public.qq_party_invites
      set status='accepted',responded_at=now()
      where id=p_invite_id;
    return jsonb_build_object(
      'ok',true,'accepted',true,'already_member',true,
      'room_id',v_room.id,'code',v_room.code,'game',v_room.game,
      'player_limit',v_room.player_limit
    );
  end if;

  select s into v_seat
    from generate_series(1,v_room.player_limit) s
    where not exists(
      select 1 from public.qq_party_players p
      where p.room_id=v_room.id and p.seat=s
    )
    order by s
    limit 1;
  if v_seat is null then raise exception 'ROOM_FULL'; end if;

  select p.username,p.avatar into v_username,v_avatar
    from public.profiles p where p.id=v_uid;
  if v_username is null then raise exception 'PROFILE_REQUIRED'; end if;

  insert into public.qq_party_players(room_id,user_id,nickname,avatar,seat)
    values(v_room.id,v_uid,v_username,v_avatar,v_seat);

  update public.qq_party_invites
    set status='accepted',responded_at=now()
    where id=p_invite_id;

  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(
      v_room.id,v_uid,'player_joined',
      jsonb_build_object('nickname',v_username,'invite_id',p_invite_id)
    );

  return jsonb_build_object(
    'ok',true,'accepted',true,'already_member',false,
    'room_id',v_room.id,'code',v_room.code,'game',v_room.game,
    'player_limit',v_room.player_limit
  );
end
$function$;

create or replace function public.qq_party_list_friends(p_room_id uuid)
returns table(user_id uuid,username text,avatar integer,in_room boolean,already_invited boolean)
language sql
stable
set search_path = 'public','private','pg_temp'
as $function$
  select * from private.qq_party_list_friends(p_room_id)
$function$;

create or replace function public.qq_party_invite_friend(p_room_id uuid,p_friend_id uuid)
returns jsonb
language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_invite_friend(p_room_id,p_friend_id)
$function$;

create or replace function public.qq_party_list_my_invites()
returns table(
  invite_id uuid,room_id uuid,code text,game text,player_limit integer,
  sender_id uuid,sender_username text,sender_avatar integer,created_at timestamptz
)
language sql
stable
set search_path = 'public','private','pg_temp'
as $function$
  select * from private.qq_party_list_my_invites()
$function$;

create or replace function public.qq_party_respond_invite(p_invite_id uuid,p_accept boolean)
returns jsonb
language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_respond_invite(p_invite_id,p_accept)
$function$;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='qq_party_invites'
  ) then
    alter publication supabase_realtime add table public.qq_party_invites;
  end if;
end $$;

revoke all on function private.qq_party_list_friends(uuid) from public,anon;
revoke all on function private.qq_party_invite_friend(uuid,uuid) from public,anon;
revoke all on function private.qq_party_list_my_invites() from public,anon;
revoke all on function private.qq_party_respond_invite(uuid,boolean) from public,anon;
grant execute on function private.qq_party_list_friends(uuid) to authenticated;
grant execute on function private.qq_party_invite_friend(uuid,uuid) to authenticated;
grant execute on function private.qq_party_list_my_invites() to authenticated;
grant execute on function private.qq_party_respond_invite(uuid,boolean) to authenticated;

revoke all on function public.qq_party_list_friends(uuid) from public,anon;
revoke all on function public.qq_party_invite_friend(uuid,uuid) from public,anon;
revoke all on function public.qq_party_list_my_invites() from public,anon;
revoke all on function public.qq_party_respond_invite(uuid,boolean) from public,anon;
grant execute on function public.qq_party_list_friends(uuid) to authenticated;
grant execute on function public.qq_party_invite_friend(uuid,uuid) to authenticated;
grant execute on function public.qq_party_list_my_invites() to authenticated;
grant execute on function public.qq_party_respond_invite(uuid,boolean) to authenticated;
