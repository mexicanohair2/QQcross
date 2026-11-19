
create or replace function public.qq_party_leave_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_player public.qq_party_players;
 v_next_host uuid; v_remaining int; v_artist uuid; v_turn int; v_next int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 select * into v_player from public.qq_party_players where room_id=p_room_id and user_id=v_uid;
 if not found then return jsonb_build_object('ok',true); end if;
 select artist_id into v_artist from public.qq_party_secrets where room_id=p_room_id;
 delete from public.qq_party_players where room_id=p_room_id and user_id=v_uid;
 select count(*) into v_remaining from public.qq_party_players where room_id=p_room_id;
 if v_remaining=0 then
   delete from public.qq_party_rooms where id=p_room_id;
   return jsonb_build_object('ok',true,'deleted',true);
 end if;
 if v_room.host_id=v_uid then
   select user_id into v_next_host from public.qq_party_players where room_id=p_room_id order by joined_at,seat limit 1;
   update public.qq_party_rooms set host_id=v_next_host where id=p_room_id;
 end if;
 if v_remaining<2 then
   delete from public.qq_party_secrets where room_id=p_room_id;
   update public.qq_party_rooms set status='waiting',public_state='{}'::jsonb,updated_at=now() where id=p_room_id;
 else
   if v_room.game='team_word' and v_room.status='playing' and (v_room.public_state->>'turn_seat')::int=v_player.seat then
     select min(seat) into v_next from public.qq_party_players where room_id=p_room_id and seat>v_player.seat;
     if v_next is null then select min(seat) into v_next from public.qq_party_players where room_id=p_room_id; end if;
     update public.qq_party_rooms set public_state=jsonb_set(public_state,'{turn_seat}',to_jsonb(v_next)),updated_at=now() where id=p_room_id;
   elsif v_room.game='crocodile' and v_room.status='playing' then
     if v_artist=v_uid then
       delete from public.qq_party_secrets where room_id=p_room_id;
       update public.qq_party_rooms set status='waiting',public_state='{}'::jsonb,updated_at=now() where id=p_room_id;
     elsif (v_room.public_state->>'guess_turn_seat')::int=v_player.seat then
       select min(seat) into v_next from public.qq_party_players where room_id=p_room_id and seat>v_player.seat and user_id<>v_artist;
       if v_next is null then select min(seat) into v_next from public.qq_party_players where room_id=p_room_id and user_id<>v_artist; end if;
       update public.qq_party_rooms set public_state=jsonb_set(public_state,'{guess_turn_seat}',to_jsonb(v_next)),updated_at=now() where id=p_room_id;
     end if;
   end if;
 end if;
 return jsonb_build_object('ok',true,'remaining',v_remaining);
end $$;
revoke all on function public.qq_party_leave_room(uuid) from public,anon;
grant execute on function public.qq_party_leave_room(uuid) to authenticated;
