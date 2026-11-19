create or replace function public.qq_party_create_room(p_game text,p_nickname text,p_player_limit int,p_public_state jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_code text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_game not in ('team_word','crocodile') then raise exception 'INVALID_GAME'; end if;
 if p_player_limit not between 2 and 3 then raise exception 'INVALID_PLAYER_LIMIT'; end if;
 if length(trim(coalesce(p_nickname,''))) not between 1 and 16 then raise exception 'INVALID_NICKNAME'; end if;
 loop
   v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
   exit when not exists(select 1 from public.qq_party_rooms where code=v_code and status in ('waiting','playing'));
 end loop;
 insert into public.qq_party_rooms(code,game,host_id,player_limit,public_state)
 values(v_code,p_game,v_uid,p_player_limit,coalesce(p_public_state,'{}'::jsonb)) returning * into v_room;
 insert into public.qq_party_players(room_id,user_id,nickname,seat) values(v_room.id,v_uid,trim(p_nickname),1);
 insert into public.qq_party_events(room_id,actor_id,event_type,payload) values(v_room.id,v_uid,'room_created',jsonb_build_object('game',p_game));
 return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status,'host_id',v_uid);
end $$;