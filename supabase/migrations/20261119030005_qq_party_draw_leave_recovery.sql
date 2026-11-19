-- Recover QQ Draw when the current artist or winner leaves a room.
-- Team Word and QQ Draw both accept simultaneous player actions; no per-seat turn is advanced here.
create or replace function private.qq_party_leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_room public.qq_party_rooms;
  v_player public.qq_party_players;
  v_remaining integer;
  v_artist uuid;
  v_winner uuid;
  v_next_host uuid;
  v_next_artist uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok',true);
  end if;

  select * into v_room
    from public.qq_party_rooms r
    where r.id=p_room_id
    for update;
  if not found then
    return jsonb_build_object('ok',true);
  end if;

  select * into v_player
    from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=v_uid;
  if not found then
    return jsonb_build_object('ok',true);
  end if;

  select s.artist_id into v_artist
    from public.qq_party_secrets s
    where s.room_id=p_room_id;
  if v_room.game='crocodile' and v_room.status='choosing' then
    v_artist:=nullif(v_room.public_state->>'artist_id','')::uuid;
  end if;
  v_winner:=nullif(v_room.public_state->>'solved_by','')::uuid;

  delete from public.qq_party_players
    where room_id=p_room_id and user_id=v_uid;

  select count(*) into v_remaining
    from public.qq_party_players p
    where p.room_id=p_room_id;

  if v_remaining=0 then
    delete from public.qq_party_rooms where id=p_room_id;
    return jsonb_build_object('ok',true,'deleted',true);
  end if;

  if v_room.host_id=v_uid then
    select p.user_id into v_next_host
      from public.qq_party_players p
      where p.room_id=p_room_id
      order by p.joined_at,p.seat
      limit 1;
    update public.qq_party_rooms
      set host_id=v_next_host,updated_at=now()
      where id=p_room_id;
  end if;

  if v_remaining<2 then
    delete from public.qq_party_secrets where room_id=p_room_id;
    delete from private.qq_party_draw_choices where room_id=p_room_id;
    update public.qq_party_rooms
      set status='waiting',
          round_no=round_no+case when status<>'waiting' then 1 else 0 end,
          public_state='{}'::jsonb,
          started_at=null,
          updated_at=now()
      where id=p_room_id;
    return jsonb_build_object('ok',true,'remaining',v_remaining,'reset_to_waiting',true);
  end if;

  if v_room.game='crocodile'
     and (
       (v_room.status='choosing' and v_artist=v_uid)
       or (v_room.status='playing' and v_artist=v_uid)
       or (v_room.status='finished' and v_winner=v_uid)
     ) then
    select p.user_id into v_next_artist
      from public.qq_party_players p
      where p.room_id=p_room_id
      order by random()
      limit 1;
    if v_next_artist is null then
      raise exception 'NO_REMAINING_DRAW_ARTIST';
    end if;

    perform private.qq_party_prepare_draw_choices(p_room_id,v_next_artist,true);
    insert into public.qq_party_events(room_id,actor_id,event_type,payload)
      values(
        p_room_id,v_uid,'draw_artist_replaced',
        jsonb_build_object('left_player_id',v_uid,'new_artist_id',v_next_artist)
      );
    return jsonb_build_object(
      'ok',true,'remaining',v_remaining,'new_artist_id',v_next_artist,
      'round_no',(select r.round_no from public.qq_party_rooms r where r.id=p_room_id),
      'status','choosing'
    );
  end if;

  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(p_room_id,v_uid,'player_left',jsonb_build_object('remaining',v_remaining));
  return jsonb_build_object('ok',true,'remaining',v_remaining);
end
$function$;

revoke all on function private.qq_party_leave_room(uuid) from public,anon;
grant execute on function private.qq_party_leave_room(uuid) to authenticated;
revoke all on function public.qq_party_leave_room(uuid) from public,anon;
grant execute on function public.qq_party_leave_room(uuid) to authenticated;
