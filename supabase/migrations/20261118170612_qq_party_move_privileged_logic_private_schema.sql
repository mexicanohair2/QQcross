
alter function public.qq_party_is_member(uuid) set schema private;
alter function public.qq_party_add_stroke(uuid,jsonb) set schema private;
alter function public.qq_party_clear_canvas(uuid) set schema private;
alter function public.qq_party_create_room(text,text,int,jsonb) set schema private;
alter function public.qq_party_croc_guess(uuid,text) set schema private;
alter function public.qq_party_get_room(uuid) set schema private;
alter function public.qq_party_join_room(text,text) set schema private;
alter function public.qq_party_leave_room(uuid) set schema private;
alter function public.qq_party_next_croc_round(uuid,text) set schema private;
alter function public.qq_party_start_crocodile(uuid,text) set schema private;
alter function public.qq_party_start_team_word(uuid,jsonb,int) set schema private;
alter function public.qq_party_team_guess(uuid,text) set schema private;

grant usage on schema private to authenticated;
grant execute on function private.qq_party_is_member(uuid) to authenticated;
grant execute on function private.qq_party_add_stroke(uuid,jsonb) to authenticated;
grant execute on function private.qq_party_clear_canvas(uuid) to authenticated;
grant execute on function private.qq_party_create_room(text,text,int,jsonb) to authenticated;
grant execute on function private.qq_party_croc_guess(uuid,text) to authenticated;
grant execute on function private.qq_party_get_room(uuid) to authenticated;
grant execute on function private.qq_party_join_room(text,text) to authenticated;
grant execute on function private.qq_party_leave_room(uuid) to authenticated;
grant execute on function private.qq_party_next_croc_round(uuid,text) to authenticated;
grant execute on function private.qq_party_start_crocodile(uuid,text) to authenticated;
grant execute on function private.qq_party_start_team_word(uuid,jsonb,int) to authenticated;
grant execute on function private.qq_party_team_guess(uuid,text) to authenticated;

drop policy if exists qq_party_rooms_member_read on public.qq_party_rooms;
create policy qq_party_rooms_member_read on public.qq_party_rooms for select to authenticated using (private.qq_party_is_member(id));
drop policy if exists qq_party_players_member_read on public.qq_party_players;
create policy qq_party_players_member_read on public.qq_party_players for select to authenticated using (private.qq_party_is_member(room_id));
drop policy if exists qq_party_events_member_read on public.qq_party_events;
create policy qq_party_events_member_read on public.qq_party_events for select to authenticated using (private.qq_party_is_member(room_id));

create or replace function public.qq_party_is_member(p_room_id uuid)
returns boolean language sql stable security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_is_member(p_room_id)
$$;
create or replace function public.qq_party_add_stroke(p_room_id uuid,p_stroke jsonb)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_add_stroke(p_room_id,p_stroke)
$$;
create or replace function public.qq_party_clear_canvas(p_room_id uuid)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_clear_canvas(p_room_id)
$$;
create or replace function public.qq_party_create_room(p_game text,p_nickname text,p_player_limit int,p_public_state jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_create_room(p_game,p_nickname,p_player_limit,p_public_state)
$$;
create or replace function public.qq_party_croc_guess(p_room_id uuid,p_word text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_croc_guess(p_room_id,p_word)
$$;
create or replace function public.qq_party_get_room(p_room_id uuid)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_get_room(p_room_id)
$$;
create or replace function public.qq_party_join_room(p_code text,p_nickname text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_join_room(p_code,p_nickname)
$$;
create or replace function public.qq_party_leave_room(p_room_id uuid)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_leave_room(p_room_id)
$$;
create or replace function public.qq_party_next_croc_round(p_room_id uuid,p_word text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_next_croc_round(p_room_id,p_word)
$$;
create or replace function public.qq_party_start_crocodile(p_room_id uuid,p_word text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_start_crocodile(p_room_id,p_word)
$$;
create or replace function public.qq_party_start_team_word(p_room_id uuid,p_words jsonb,p_length int)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_start_team_word(p_room_id,p_words,p_length)
$$;
create or replace function public.qq_party_team_guess(p_room_id uuid,p_word text)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.qq_party_team_guess(p_room_id,p_word)
$$;

revoke all on function public.qq_party_is_member(uuid) from public,anon;
revoke all on function public.qq_party_add_stroke(uuid,jsonb) from public,anon;
revoke all on function public.qq_party_clear_canvas(uuid) from public,anon;
revoke all on function public.qq_party_create_room(text,text,int,jsonb) from public,anon;
revoke all on function public.qq_party_croc_guess(uuid,text) from public,anon;
revoke all on function public.qq_party_get_room(uuid) from public,anon;
revoke all on function public.qq_party_join_room(text,text) from public,anon;
revoke all on function public.qq_party_leave_room(uuid) from public,anon;
revoke all on function public.qq_party_next_croc_round(uuid,text) from public,anon;
revoke all on function public.qq_party_start_crocodile(uuid,text) from public,anon;
revoke all on function public.qq_party_start_team_word(uuid,jsonb,int) from public,anon;
revoke all on function public.qq_party_team_guess(uuid,text) from public,anon;
grant execute on function public.qq_party_add_stroke(uuid,jsonb) to authenticated;
grant execute on function public.qq_party_clear_canvas(uuid) to authenticated;
grant execute on function public.qq_party_create_room(text,text,int,jsonb) to authenticated;
grant execute on function public.qq_party_croc_guess(uuid,text) to authenticated;
grant execute on function public.qq_party_get_room(uuid) to authenticated;
grant execute on function public.qq_party_join_room(text,text) to authenticated;
grant execute on function public.qq_party_leave_room(uuid) to authenticated;
grant execute on function public.qq_party_next_croc_round(uuid,text) to authenticated;
grant execute on function public.qq_party_start_crocodile(uuid,text) to authenticated;
grant execute on function public.qq_party_start_team_word(uuid,jsonb,int) to authenticated;
grant execute on function public.qq_party_team_guess(uuid,text) to authenticated;
