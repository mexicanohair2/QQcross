
drop index if exists public.match_players_match_user_uidx;

create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;

alter function public.award_qqcross_match_result(integer,text) set schema private;
alter function public.create_qqcross_match(uuid[],jsonb) set schema private;
alter function public.get_qqcross_match(uuid) set schema private;
alter function public.init_qqcross_match_state(uuid,jsonb) set schema private;
alter function public.is_qqcross_match_player(uuid) set schema private;
alter function public.list_qqcross_friends() set schema private;
alter function public.list_qqcross_incoming_friend_requests() set schema private;
alter function public.list_qqcross_match_invites() set schema private;
alter function public.list_qqcross_my_matches() set schema private;
alter function public.list_qqcross_outgoing_friend_requests() set schema private;
alter function public.purchase_qqcross_items(text,integer) set schema private;
alter function public.respond_qqcross_friend_request(uuid,boolean) set schema private;
alter function public.respond_qqcross_match_invite(uuid,boolean) set schema private;
alter function public.search_qqcross_players_with_status(text) set schema private;
alter function public.send_qqcross_friend_request(text) set schema private;
alter function public.start_qqcross_match(uuid) set schema private;
alter function public.submit_qqcross_match_turn(uuid,integer,jsonb,integer,uuid,boolean) set schema private;
alter function public.use_qqcross_item(text) set schema private;

revoke all on all functions in schema private from public,anon;
grant execute on all functions in schema private to authenticated;

create function public.award_qqcross_match_result(points integer,match_id text)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select private.award_qqcross_match_result($1,$2) $$;
create function public.create_qqcross_match(invited_user_ids uuid[],puzzle_data jsonb)
returns uuid language sql volatile security invoker set search_path=''
as $$ select private.create_qqcross_match($1,$2) $$;
create function public.get_qqcross_match(target_match_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.get_qqcross_match($1) $$;
create function public.init_qqcross_match_state(target_match_id uuid,initial_state jsonb)
returns integer language sql volatile security invoker set search_path=''
as $$ select private.init_qqcross_match_state($1,$2) $$;
create function public.is_qqcross_match_player(target_match_id uuid)
returns boolean language sql stable security invoker set search_path=''
as $$ select private.is_qqcross_match_player($1) $$;
create function public.list_qqcross_friends()
returns table(id uuid,username text,avatar integer)
language sql stable security invoker set search_path=''
as $$ select * from private.list_qqcross_friends() $$;
create function public.list_qqcross_incoming_friend_requests()
returns table(request_id uuid,sender_id uuid,username text,avatar integer,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$ select * from private.list_qqcross_incoming_friend_requests() $$;
create function public.list_qqcross_match_invites()
returns table(match_id uuid,host_username text,player_limit integer,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$ select * from private.list_qqcross_match_invites() $$;
create function public.list_qqcross_my_matches()
returns table(match_id uuid,host_username text,status text,player_limit integer,current_turn_user_id uuid,state_version integer,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$ select * from private.list_qqcross_my_matches() $$;
create function public.list_qqcross_outgoing_friend_requests()
returns table(request_id uuid,receiver_id uuid,username text,avatar integer,created_at timestamptz)
language sql stable security invoker set search_path=''
as $$ select * from private.list_qqcross_outgoing_friend_requests() $$;
create function public.purchase_qqcross_items(item_type text,quantity integer)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select private.purchase_qqcross_items($1,$2) $$;
create function public.respond_qqcross_friend_request(request_id uuid,accept_request boolean)
returns boolean language sql volatile security invoker set search_path=''
as $$ select private.respond_qqcross_friend_request($1,$2) $$;
create function public.respond_qqcross_match_invite(target_match_id uuid,accept_invite boolean)
returns boolean language sql volatile security invoker set search_path=''
as $$ select private.respond_qqcross_match_invite($1,$2) $$;
create function public.search_qqcross_players_with_status(search_text text)
returns table(id uuid,username text,avatar integer,relation_status text)
language sql stable security invoker set search_path=''
as $$ select * from private.search_qqcross_players_with_status($1) $$;
create function public.send_qqcross_friend_request(target_username text)
returns uuid language sql volatile security invoker set search_path=''
as $$ select private.send_qqcross_friend_request($1) $$;
create function public.start_qqcross_match(target_match_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select private.start_qqcross_match($1) $$;
create function public.submit_qqcross_match_turn(target_match_id uuid,expected_version integer,next_state jsonb,points_earned integer,next_user_id uuid,is_finished boolean default false)
returns jsonb language sql volatile security invoker set search_path=''
as $$ select private.submit_qqcross_match_turn($1,$2,$3,$4,$5,$6) $$;
create function public.use_qqcross_item(item_type text)
returns integer language sql volatile security invoker set search_path=''
as $$ select private.use_qqcross_item($1) $$;

revoke all on all functions in schema public from public,anon;
grant execute on function public.award_qqcross_match_result(integer,text) to authenticated;
grant execute on function public.create_qqcross_match(uuid[],jsonb) to authenticated;
grant execute on function public.get_qqcross_match(uuid) to authenticated;
grant execute on function public.init_qqcross_match_state(uuid,jsonb) to authenticated;
grant execute on function public.is_qqcross_match_player(uuid) to authenticated;
grant execute on function public.list_qqcross_friends() to authenticated;
grant execute on function public.list_qqcross_incoming_friend_requests() to authenticated;
grant execute on function public.list_qqcross_match_invites() to authenticated;
grant execute on function public.list_qqcross_my_matches() to authenticated;
grant execute on function public.list_qqcross_outgoing_friend_requests() to authenticated;
grant execute on function public.purchase_qqcross_items(text,integer) to authenticated;
grant execute on function public.respond_qqcross_friend_request(uuid,boolean) to authenticated;
grant execute on function public.respond_qqcross_match_invite(uuid,boolean) to authenticated;
grant execute on function public.search_qqcross_players_with_status(text) to authenticated;
grant execute on function public.send_qqcross_friend_request(text) to authenticated;
grant execute on function public.start_qqcross_match(uuid) to authenticated;
grant execute on function public.submit_qqcross_match_turn(uuid,integer,jsonb,integer,uuid,boolean) to authenticated;
grant execute on function public.use_qqcross_item(text) to authenticated;
