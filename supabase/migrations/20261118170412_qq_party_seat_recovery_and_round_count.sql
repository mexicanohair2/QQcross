
create or replace function public.qq_party_join_room(p_code text,p_nickname text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_seat int;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if length(trim(coalesce(p_nickname,''))) not between 1 and 16 then raise exception 'INVALID_NICKNAME'; end if;
 select * into v_room from public.qq_party_rooms where code=upper(trim(p_code)) and status='waiting' and expires_at>now() for update;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 if exists(select 1 from public.qq_party_players where room_id=v_room.id and user_id=v_uid) then
   return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status);
 end if;
 select s into v_seat from generate_series(1,v_room.player_limit) s
 where not exists(select 1 from public.qq_party_players p where p.room_id=v_room.id and p.seat=s)
 order by s limit 1;
 if v_seat is null then raise exception 'ROOM_FULL'; end if;
 insert into public.qq_party_players(room_id,user_id,nickname,seat) values(v_room.id,v_uid,trim(p_nickname),v_seat);
 insert into public.qq_party_events(room_id,actor_id,event_type,payload) values(v_room.id,v_uid,'player_joined',jsonb_build_object('nickname',trim(p_nickname)));
 return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status);
end $$;

create or replace function public.qq_party_start_team_word(p_room_id uuid,p_words jsonb,p_length int)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_count int; v_candidates text[]; v_word text; v_first_seat int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
 select count(*),min(seat) into v_count,v_first_seat from public.qq_party_players where room_id=p_room_id;
 if v_count<2 then raise exception 'NEED_TWO_PLAYERS'; end if;
 if v_room.game<>'team_word' or v_room.status not in ('waiting','finished') then raise exception 'INVALID_GAME_STATE'; end if;
 if p_length not between 4 and 8 or jsonb_typeof(p_words)<>'array' then raise exception 'INVALID_WORD_POOL'; end if;
 select array_agg(w) into v_candidates
 from (select distinct lower(replace(value,'ё','е')) as w from jsonb_array_elements_text(p_words) where value ~ '^[а-яА-ЯёЁ]{4,8}$' and char_length(replace(lower(value),'ё','е'))=p_length) q;
 if coalesce(cardinality(v_candidates),0)=0 then raise exception 'EMPTY_WORD_POOL'; end if;
 v_word:=v_candidates[1+floor(random()*cardinality(v_candidates))::int];
 insert into public.qq_party_secrets(room_id,secret_word,artist_id) values(p_room_id,v_word,null)
 on conflict(room_id) do update set secret_word=excluded.secret_word,artist_id=null,updated_at=now();
 update public.qq_party_rooms set status='playing',round_no=case when v_room.status='finished' then round_no+1 else round_no end,
 public_state=jsonb_build_object('length',p_length,'turn_seat',v_first_seat,'guesses','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;
