
create or replace function public.qq_party_is_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.qq_party_players where room_id=p_room_id and user_id=auth.uid())
$$;
revoke all on function public.qq_party_is_member(uuid) from public,anon;
grant execute on function public.qq_party_is_member(uuid) to authenticated;

drop policy if exists qq_party_rooms_member_read on public.qq_party_rooms;
create policy qq_party_rooms_member_read on public.qq_party_rooms for select to authenticated using (public.qq_party_is_member(id));
drop policy if exists qq_party_players_member_read on public.qq_party_players;
create policy qq_party_players_member_read on public.qq_party_players for select to authenticated using (public.qq_party_is_member(room_id));
drop policy if exists qq_party_events_member_read on public.qq_party_events;
create policy qq_party_events_member_read on public.qq_party_events for select to authenticated using (public.qq_party_is_member(room_id));

alter table public.qq_party_secrets alter column artist_id drop not null;

create or replace function public.qq_party_get_room(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_players jsonb; v_secret jsonb:='null'::jsonb;
begin
 if v_uid is null or not public.qq_party_is_member(p_room_id) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
 select * into v_room from public.qq_party_rooms where id=p_room_id;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'nickname',nickname,'seat',seat) order by seat),'[]'::jsonb) into v_players from public.qq_party_players where room_id=p_room_id;
 if v_room.game='crocodile' then
   select jsonb_build_object('word',secret_word,'artist_id',artist_id) into v_secret from public.qq_party_secrets where room_id=p_room_id and artist_id=v_uid;
 end if;
 return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'game',v_room.game,'host_id',v_room.host_id,'player_limit',v_room.player_limit,'status',v_room.status,'round_no',v_room.round_no,'public_state',v_room.public_state,'players',v_players,'private',coalesce(v_secret,'null'::jsonb));
end $$;

create or replace function public.qq_party_start_team_word(p_room_id uuid,p_word text,p_length int)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_count int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
 select count(*) into v_count from public.qq_party_players where room_id=p_room_id;
 if v_count<2 then raise exception 'NEED_TWO_PLAYERS'; end if;
 if v_room.game<>'team_word' or v_room.status not in ('waiting','finished') then raise exception 'INVALID_GAME_STATE'; end if;
 if p_word !~ '^[а-яА-ЯёЁ]{4,8}$' or char_length(replace(lower(p_word),'ё','е'))<>p_length then raise exception 'INVALID_WORD'; end if;
 insert into public.qq_party_secrets(room_id,secret_word,artist_id) values(p_room_id,lower(replace(p_word,'ё','е')),null)
 on conflict(room_id) do update set secret_word=excluded.secret_word,artist_id=null,updated_at=now();
 update public.qq_party_rooms set status='playing',public_state=jsonb_build_object('length',p_length,'turn_seat',1,'guesses','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_team_guess(p_room_id uuid,p_word text,p_feedback jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_player public.qq_party_players; v_target text; v_guesses jsonb; v_len int; v_next int; v_correct boolean;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 select * into v_player from public.qq_party_players where room_id=p_room_id and user_id=v_uid;
 if not found then raise exception 'NOT_A_ROOM_MEMBER'; end if;
 if v_room.game<>'team_word' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
 if (v_room.public_state->>'turn_seat')::int<>v_player.seat then raise exception 'NOT_YOUR_TURN'; end if;
 select secret_word into v_target from public.qq_party_secrets where room_id=p_room_id;
 v_len:=(v_room.public_state->>'length')::int;
 if char_length(replace(lower(p_word),'ё','е'))<>v_len or p_word !~ '^[а-яА-ЯёЁ]+$' then raise exception 'INVALID_WORD'; end if;
 v_guesses:=coalesce(v_room.public_state->'guesses','[]'::jsonb);
 if exists(select 1 from jsonb_array_elements(v_guesses) g where g->>'word'=lower(replace(p_word,'ё','е'))) then raise exception 'DUPLICATE_GUESS'; end if;
 if jsonb_typeof(p_feedback)<>'array' or jsonb_array_length(p_feedback)<>v_len then raise exception 'INVALID_FEEDBACK'; end if;
 v_correct:=lower(replace(p_word,'ё','е'))=v_target;
 v_guesses:=v_guesses||jsonb_build_array(jsonb_build_object('word',lower(replace(p_word,'ё','е')),'user_id',v_uid,'seat',v_player.seat,'feedback',p_feedback,'correct',v_correct));
 if v_correct then
   update public.qq_party_rooms set status='finished',public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('winner_seat',v_player.seat),updated_at=now() where id=p_room_id;
 else
   select min(seat) into v_next from public.qq_party_players where room_id=p_room_id and seat>v_player.seat;
   if v_next is null then select min(seat) into v_next from public.qq_party_players where room_id=p_room_id; end if;
   update public.qq_party_rooms set public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('turn_seat',v_next),updated_at=now() where id=p_room_id;
 end if;
 insert into public.qq_party_events(room_id,actor_id,event_type,payload) values(p_room_id,v_uid,'team_guess',jsonb_build_object('word',lower(p_word)));
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_start_crocodile(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_count int; v_artist_seat int; v_guess_seat int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
 select count(*) into v_count from public.qq_party_players where room_id=p_room_id;
 if v_count<2 then raise exception 'NEED_TWO_PLAYERS'; end if;
 if v_room.game<>'crocodile' or v_room.status not in ('waiting','finished') then raise exception 'INVALID_GAME_STATE'; end if;
 if p_word !~ '^[а-яА-ЯёЁ]{4,20}$' then raise exception 'INVALID_WORD'; end if;
 select seat into v_artist_seat from public.qq_party_players where room_id=p_room_id and user_id=v_uid;
 select min(seat) into v_guess_seat from public.qq_party_players where room_id=p_room_id and user_id<>v_uid;
 insert into public.qq_party_secrets(room_id,secret_word,artist_id) values(p_room_id,lower(replace(p_word,'ё','е')),v_uid)
 on conflict(room_id) do update set secret_word=excluded.secret_word,artist_id=v_uid,updated_at=now();
 update public.qq_party_rooms set status='playing',public_state=jsonb_build_object('artist_id',v_uid,'artist_seat',v_artist_seat,'guess_turn_seat',v_guess_seat,'guesses','[]'::jsonb,'strokes','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_croc_guess(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_player public.qq_party_players; v_target text; v_artist uuid; v_turn int; v_guesses jsonb; v_next int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 select * into v_player from public.qq_party_players where room_id=p_room_id and user_id=v_uid;
 if not found then raise exception 'NOT_A_ROOM_MEMBER'; end if;
 if v_room.game<>'crocodile' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
 select secret_word,artist_id into v_target,v_artist from public.qq_party_secrets where room_id=p_room_id;
 v_turn:=(v_room.public_state->>'guess_turn_seat')::int;
 if v_player.seat<>v_turn or v_uid=v_artist then raise exception 'NOT_YOUR_TURN'; end if;
 if p_word !~ '^[а-яА-ЯёЁ]{1,30}$' then raise exception 'INVALID_GUESS'; end if;
 v_guesses:=coalesce(v_room.public_state->'guesses','[]'::jsonb)||jsonb_build_array(jsonb_build_object('word',lower(replace(p_word,'ё','е')),'user_id',v_uid,'seat',v_player.seat));
 if lower(replace(p_word,'ё','е'))=v_target then
   update public.qq_party_rooms set status='finished',public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('winner_seat',v_player.seat),updated_at=now() where id=p_room_id;
 else
   select min(seat) into v_next from public.qq_party_players where room_id=p_room_id and seat>v_turn and user_id<>v_artist;
   if v_next is null then select min(seat) into v_next from public.qq_party_players where room_id=p_room_id and user_id<>v_artist; end if;
   update public.qq_party_rooms set public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('guess_turn_seat',v_next),updated_at=now() where id=p_room_id;
 end if;
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_next_croc_round(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_seat int; v_artist_seat int; v_guess_seat int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if v_room.game<>'crocodile' or v_room.status<>'finished' then raise exception 'ROUND_NOT_FINISHED'; end if;
 v_seat:=(v_room.public_state->>'winner_seat')::int;
 if not exists(select 1 from public.qq_party_players where room_id=p_room_id and user_id=v_uid and seat=v_seat) then raise exception 'WINNER_ONLY'; end if;
 if p_word !~ '^[а-яА-ЯёЁ]{4,20}$' then raise exception 'INVALID_WORD'; end if;
 select min(seat) into v_guess_seat from public.qq_party_players where room_id=p_room_id and user_id<>v_uid;
 update public.qq_party_secrets set secret_word=lower(replace(p_word,'ё','е')),artist_id=v_uid,updated_at=now() where room_id=p_room_id;
 update public.qq_party_rooms set status='playing',round_no=round_no+1,public_state=jsonb_build_object('artist_id',v_uid,'artist_seat',v_seat,'guess_turn_seat',v_guess_seat,'guesses','[]'::jsonb,'strokes','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;
