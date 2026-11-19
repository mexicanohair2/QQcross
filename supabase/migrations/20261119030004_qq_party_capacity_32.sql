-- Increase QQ party rooms to a practical mobile Realtime limit.
-- The limit remains server-validated to protect the shared room from unbounded fan-out.
alter table public.qq_party_rooms drop constraint if exists qq_party_rooms_player_limit_check;
alter table public.qq_party_rooms
  add constraint qq_party_rooms_player_limit_check check (player_limit between 2 and 32);
alter table public.qq_party_players drop constraint if exists qq_party_players_seat_check;
alter table public.qq_party_players
  add constraint qq_party_players_seat_check check (seat between 1 and 32);

create or replace function private.qq_party_create_room(
  p_game text,p_nickname text,p_player_limit integer,p_public_state jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_code text;
  v_username text;
  v_avatar integer;
begin
  if p_game not in ('team_word','crocodile') then raise exception 'INVALID_GAME'; end if;
  if p_player_limit not between 2 and 32 then raise exception 'INVALID_PLAYER_LIMIT'; end if;
  select p.username,p.avatar into v_username,v_avatar
    from public.profiles p where p.id=v_uid;
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(
      select 1 from public.qq_party_rooms r
      where r.code=v_code and r.status in ('waiting','choosing','playing')
    );
  end loop;
  insert into public.qq_party_rooms(code,game,host_id,player_limit,public_state)
    values(v_code,p_game,v_uid,p_player_limit,'{}'::jsonb)
    returning * into v_room;
  insert into public.qq_party_players(room_id,user_id,nickname,avatar,seat)
    values(v_room.id,v_uid,v_username,v_avatar,1);
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(v_room.id,v_uid,'room_created',jsonb_build_object('game',p_game));
  return jsonb_build_object(
    'room_id',v_room.id,'code',v_room.code,'game',v_room.game,
    'status',v_room.status,'host_id',v_uid,'player_limit',v_room.player_limit
  );
end
$function$;

revoke all on function private.qq_party_create_room(text,text,integer,jsonb) from public,anon;
grant execute on function private.qq_party_create_room(text,text,integer,jsonb) to authenticated;
revoke all on function public.qq_party_create_room(text,text,integer,jsonb) from public,anon;
grant execute on function public.qq_party_create_room(text,text,integer,jsonb) to authenticated;
