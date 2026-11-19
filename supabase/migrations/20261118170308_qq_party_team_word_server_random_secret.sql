
drop function if exists public.qq_party_start_team_word(uuid,text,int);
create or replace function public.qq_party_start_team_word(p_room_id uuid,p_words jsonb,p_length int)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_count int; v_candidates text[]; v_word text;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
 select count(*) into v_count from public.qq_party_players where room_id=p_room_id;
 if v_count<2 then raise exception 'NEED_TWO_PLAYERS'; end if;
 if v_room.game<>'team_word' or v_room.status not in ('waiting','finished') then raise exception 'INVALID_GAME_STATE'; end if;
 if p_length not between 4 and 8 or jsonb_typeof(p_words)<>'array' then raise exception 'INVALID_WORD_POOL'; end if;
 select array_agg(w) into v_candidates
 from (select distinct lower(replace(value,'ё','е')) as w from jsonb_array_elements_text(p_words) where value ~ '^[а-яА-ЯёЁ]{4,8}$' and char_length(replace(lower(value),'ё','е'))=p_length) q;
 if coalesce(cardinality(v_candidates),0)=0 then raise exception 'EMPTY_WORD_POOL'; end if;
 v_word:=v_candidates[1+floor(random()*cardinality(v_candidates))::int];
 insert into public.qq_party_secrets(room_id,secret_word,artist_id) values(p_room_id,v_word,null)
 on conflict(room_id) do update set secret_word=excluded.secret_word,artist_id=null,updated_at=now();
 update public.qq_party_rooms set status='playing',public_state=jsonb_build_object('length',p_length,'turn_seat',1,'guesses','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;
revoke all on function public.qq_party_start_team_word(uuid,jsonb,int) from public,anon;
grant execute on function public.qq_party_start_team_word(uuid,jsonb,int) to authenticated;
