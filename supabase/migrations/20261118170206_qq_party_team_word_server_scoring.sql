
create or replace function public.qq_party_score_guess(p_guess text,p_target text)
returns jsonb language plpgsql immutable as $$
declare
  v_g text[]:=regexp_split_to_array(lower(replace(p_guess,'ё','е')),'');
  v_t text[]:=regexp_split_to_array(lower(replace(p_target,'ё','е')),'');
  v_result text[]; v_remaining jsonb:='{}'::jsonb; v_i int; v_n int; v_c text; v_left int;
begin
  v_n:=cardinality(v_t);
  if cardinality(v_g)<>v_n then raise exception 'INVALID_WORD_LENGTH'; end if;
  v_result:=array_fill('miss'::text,array[v_n]);
  for v_i in 1..v_n loop
    if v_g[v_i]=v_t[v_i] then v_result[v_i]:='green';
    else
      v_c:=v_t[v_i];
      v_remaining:=jsonb_set(v_remaining,array[v_c],to_jsonb(coalesce((v_remaining->>v_c)::int,0)+1),true);
    end if;
  end loop;
  for v_i in 1..v_n loop
    if v_result[v_i]<>'green' then
      v_c:=v_g[v_i]; v_left:=coalesce((v_remaining->>v_c)::int,0);
      if v_left>0 then
        v_result[v_i]:='yellow';
        v_remaining:=jsonb_set(v_remaining,array[v_c],to_jsonb(v_left-1),true);
      end if;
    end if;
  end loop;
  return to_jsonb(v_result);
end $$;
revoke all on function public.qq_party_score_guess(text,text) from public,anon,authenticated;

create or replace function public.qq_party_team_guess(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_player public.qq_party_players;
 v_target text; v_guesses jsonb; v_len int; v_next int; v_correct boolean; v_feedback jsonb;
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
 v_feedback:=public.qq_party_score_guess(p_word,v_target);
 v_correct:=lower(replace(p_word,'ё','е'))=v_target;
 v_guesses:=v_guesses||jsonb_build_array(jsonb_build_object('word',lower(replace(p_word,'ё','е')),'user_id',v_uid,'seat',v_player.seat,'feedback',v_feedback,'correct',v_correct));
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
revoke all on function public.qq_party_team_guess(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.qq_party_team_guess(uuid,text) from public,anon;
grant execute on function public.qq_party_team_guess(uuid,text) to authenticated;
