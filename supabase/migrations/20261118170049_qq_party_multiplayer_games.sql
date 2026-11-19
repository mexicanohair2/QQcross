
create table if not exists public.qq_party_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  game text not null check (game in ('team_word','crocodile')),
  host_id uuid not null references auth.users(id) on delete cascade,
  player_limit int not null check (player_limit between 2 and 3),
  status text not null default 'waiting' check (status in ('waiting','playing','finished','cancelled')),
  round_no int not null default 1,
  public_state jsonb not null default '{}'::jsonb check (jsonb_typeof(public_state)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '8 hours'
);
create table if not exists public.qq_party_players (
  room_id uuid not null references public.qq_party_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 16),
  seat int not null check (seat between 1 and 3),
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id),
  unique(room_id,seat)
);
create table if not exists public.qq_party_secrets (
  room_id uuid primary key references public.qq_party_rooms(id) on delete cascade,
  secret_word text not null,
  artist_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.qq_party_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.qq_party_rooms(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists qq_party_rooms_code_idx on public.qq_party_rooms(code);
create index if not exists qq_party_events_room_idx on public.qq_party_events(room_id,id);

alter table public.qq_party_rooms enable row level security;
alter table public.qq_party_players enable row level security;
alter table public.qq_party_secrets enable row level security;
alter table public.qq_party_events enable row level security;

drop policy if exists qq_party_rooms_member_read on public.qq_party_rooms;
create policy qq_party_rooms_member_read on public.qq_party_rooms for select to authenticated
using (exists(select 1 from public.qq_party_players p where p.room_id=id and p.user_id=(select auth.uid())));
drop policy if exists qq_party_players_member_read on public.qq_party_players;
create policy qq_party_players_member_read on public.qq_party_players for select to authenticated
using (exists(select 1 from public.qq_party_players me where me.room_id=qq_party_players.room_id and me.user_id=(select auth.uid())));
drop policy if exists qq_party_secret_artist_read on public.qq_party_secrets;
create policy qq_party_secret_artist_read on public.qq_party_secrets for select to authenticated
using (artist_id=(select auth.uid()));
drop policy if exists qq_party_events_member_read on public.qq_party_events;
create policy qq_party_events_member_read on public.qq_party_events for select to authenticated
using (exists(select 1 from public.qq_party_players p where p.room_id=qq_party_events.room_id and p.user_id=(select auth.uid())));

grant select on public.qq_party_rooms, public.qq_party_players, public.qq_party_secrets, public.qq_party_events to authenticated;
revoke insert, update, delete on public.qq_party_rooms, public.qq_party_players, public.qq_party_secrets, public.qq_party_events from anon, authenticated;

create or replace function public.qq_party_create_room(p_game text,p_nickname text,p_player_limit int,p_public_state jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_code text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_game not in ('team_word','crocodile') then raise exception 'INVALID_GAME'; end if;
 if p_player_limit not between 2 and 3 then raise exception 'INVALID_PLAYER_LIMIT'; end if;
 if length(trim(coalesce(p_nickname,''))) not between 1 and 16 then raise exception 'INVALID_NICKNAME'; end if;
 loop
   v_code:=upper(substr(encode(gen_random_bytes(8),'hex'),1,6));
   exit when not exists(select 1 from public.qq_party_rooms where code=v_code and status in ('waiting','playing'));
 end loop;
 insert into public.qq_party_rooms(code,game,host_id,player_limit,public_state)
 values(v_code,p_game,v_uid,p_player_limit,coalesce(p_public_state,'{}'::jsonb)) returning * into v_room;
 insert into public.qq_party_players(room_id,user_id,nickname,seat) values(v_room.id,v_uid,trim(p_nickname),1);
 insert into public.qq_party_events(room_id,actor_id,event_type,payload) values(v_room.id,v_uid,'room_created',jsonb_build_object('game',p_game));
 return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status,'host_id',v_uid);
end $$;

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
 select coalesce(max(seat),0)+1 into v_seat from public.qq_party_players where room_id=v_room.id;
 if v_seat>v_room.player_limit then raise exception 'ROOM_FULL'; end if;
 insert into public.qq_party_players(room_id,user_id,nickname,seat) values(v_room.id,v_uid,trim(p_nickname),v_seat);
 insert into public.qq_party_events(room_id,actor_id,event_type,payload) values(v_room.id,v_uid,'player_joined',jsonb_build_object('nickname',trim(p_nickname)));
 return jsonb_build_object('room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status);
end $$;

create or replace function public.qq_party_get_room(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_players jsonb; v_secret jsonb:='null'::jsonb;
begin
 if v_uid is null or not exists(select 1 from public.qq_party_players where room_id=p_room_id and user_id=v_uid) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
 select * into v_room from public.qq_party_rooms where id=p_room_id;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'nickname',nickname,'seat',seat) order by seat),'[]'::jsonb) into v_players from public.qq_party_players where room_id=p_room_id;
 select jsonb_build_object('word',secret_word,'artist_id',artist_id) into v_secret from public.qq_party_secrets where room_id=p_room_id and artist_id=v_uid;
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
 insert into public.qq_party_secrets(room_id,secret_word,artist_id) values(p_room_id,lower(replace(p_word,'ё','е')),v_uid)
 on conflict(room_id) do update set secret_word=excluded.secret_word,artist_id=excluded.artist_id,updated_at=now();
 update public.qq_party_rooms set status='playing',public_state=jsonb_build_object('length',p_length,'turn_seat',1,'guesses','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_team_guess(p_room_id uuid,p_word text,p_feedback jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_player public.qq_party_players; v_target text; v_guesses jsonb; v_len int;
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
 v_guesses:=v_guesses||jsonb_build_array(jsonb_build_object('word',lower(replace(p_word,'ё','е')),'user_id',v_uid,'seat',v_player.seat,'feedback',p_feedback,'correct',lower(replace(p_word,'ё','е'))=v_target));
 if lower(replace(p_word,'ё','е'))=v_target then
   update public.qq_party_rooms set status='finished',public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('winner_seat',v_player.seat),updated_at=now() where id=p_room_id;
 else
   update public.qq_party_rooms set public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('turn_seat',(v_player.seat % v_room.player_limit)+1),updated_at=now() where id=p_room_id;
 end if;
 insert into public.qq_party_events(room_id,actor_id,event_type,payload) values(p_room_id,v_uid,'team_guess',jsonb_build_object('word',lower(p_word)));
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_start_crocodile(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_count int;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
 select count(*) into v_count from public.qq_party_players where room_id=p_room_id;
 if v_count<2 then raise exception 'NEED_TWO_PLAYERS'; end if;
 if v_room.game<>'crocodile' or v_room.status not in ('waiting','finished') then raise exception 'INVALID_GAME_STATE'; end if;
 if p_word !~ '^[а-яА-ЯёЁ]{4,20}$' then raise exception 'INVALID_WORD'; end if;
 insert into public.qq_party_secrets(room_id,secret_word,artist_id) values(p_room_id,lower(replace(p_word,'ё','е')),v_uid)
 on conflict(room_id) do update set secret_word=excluded.secret_word,artist_id=excluded.artist_id,updated_at=now();
 update public.qq_party_rooms set status='playing',public_state=jsonb_build_object('artist_id',v_uid,'guess_turn_seat',2,'guesses','[]'::jsonb,'strokes','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_croc_guess(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_player public.qq_party_players; v_target text; v_artist uuid; v_turn int; v_guesses jsonb; v_next int; v_count int;
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
   select count(*) into v_count from public.qq_party_players where room_id=p_room_id;
   v_next:=v_turn;
   for i in 1..v_count loop
     v_next:=(v_next % v_room.player_limit)+1;
     exit when exists(select 1 from public.qq_party_players p where p.room_id=p_room_id and p.seat=v_next and p.user_id<>v_artist);
   end loop;
   update public.qq_party_rooms set public_state=jsonb_set(public_state,'{guesses}',v_guesses)||jsonb_build_object('guess_turn_seat',v_next),updated_at=now() where id=p_room_id;
 end if;
 return public.qq_party_get_room(p_room_id);
end $$;

create or replace function public.qq_party_add_stroke(p_room_id uuid,p_stroke jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_artist uuid; v_strokes jsonb;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if not exists(select 1 from public.qq_party_players where room_id=p_room_id and user_id=v_uid) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
 if v_room.game<>'crocodile' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
 select artist_id into v_artist from public.qq_party_secrets where room_id=p_room_id;
 if v_artist<>v_uid then raise exception 'ARTIST_ONLY'; end if;
 if pg_column_size(p_stroke)>12000 then raise exception 'STROKE_TOO_LARGE'; end if;
 v_strokes:=coalesce(v_room.public_state->'strokes','[]'::jsonb)||jsonb_build_array(p_stroke);
 if jsonb_array_length(v_strokes)>600 then raise exception 'TOO_MANY_STROKES'; end if;
 update public.qq_party_rooms set public_state=jsonb_set(public_state,'{strokes}',v_strokes),updated_at=now() where id=p_room_id;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.qq_party_clear_canvas(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_artist uuid;
begin
 if not exists(select 1 from public.qq_party_players where room_id=p_room_id and user_id=v_uid) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
 select artist_id into v_artist from public.qq_party_secrets where room_id=p_room_id;
 if v_artist<>v_uid then raise exception 'ARTIST_ONLY'; end if;
 update public.qq_party_rooms set public_state=jsonb_set(public_state,'{strokes}','[]'::jsonb),updated_at=now() where id=p_room_id;
 return jsonb_build_object('ok',true);
end $$;

create or replace function public.qq_party_next_croc_round(p_room_id uuid,p_word text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_room public.qq_party_rooms; v_seat int; v_artist uuid;
begin
 select * into v_room from public.qq_party_rooms where id=p_room_id for update;
 if v_room.game<>'crocodile' or v_room.status<>'finished' then raise exception 'ROUND_NOT_FINISHED'; end if;
 v_seat:=(v_room.public_state->>'winner_seat')::int;
 if not exists(select 1 from public.qq_party_players where room_id=p_room_id and user_id=v_uid and seat=v_seat) then raise exception 'WINNER_ONLY'; end if;
 if p_word !~ '^[а-яА-ЯёЁ]{4,20}$' then raise exception 'INVALID_WORD'; end if;
 v_artist:=v_uid;
 update public.qq_party_secrets set secret_word=lower(replace(p_word,'ё','е')),artist_id=v_artist,updated_at=now() where room_id=p_room_id;
 update public.qq_party_rooms set status='playing',round_no=round_no+1,public_state=jsonb_build_object('artist_id',v_artist,'guess_turn_seat',(v_seat % player_limit)+1,'guesses','[]'::jsonb,'strokes','[]'::jsonb,'winner_seat',null),updated_at=now() where id=p_room_id;
 return public.qq_party_get_room(p_room_id);
end $$;

revoke all on function public.qq_party_create_room(text,text,int,jsonb) from public,anon;
revoke all on function public.qq_party_join_room(text,text) from public,anon;
revoke all on function public.qq_party_get_room(uuid) from public,anon;
revoke all on function public.qq_party_start_team_word(uuid,text,int) from public,anon;
revoke all on function public.qq_party_team_guess(uuid,text,jsonb) from public,anon;
revoke all on function public.qq_party_start_crocodile(uuid,text) from public,anon;
revoke all on function public.qq_party_croc_guess(uuid,text) from public,anon;
revoke all on function public.qq_party_add_stroke(uuid,jsonb) from public,anon;
revoke all on function public.qq_party_clear_canvas(uuid) from public,anon;
revoke all on function public.qq_party_next_croc_round(uuid,text) from public,anon;
grant execute on function public.qq_party_create_room(text,text,int,jsonb) to authenticated;
grant execute on function public.qq_party_join_room(text,text) to authenticated;
grant execute on function public.qq_party_get_room(uuid) to authenticated;
grant execute on function public.qq_party_start_team_word(uuid,text,int) to authenticated;
grant execute on function public.qq_party_team_guess(uuid,text,jsonb) to authenticated;
grant execute on function public.qq_party_start_crocodile(uuid,text) to authenticated;
grant execute on function public.qq_party_croc_guess(uuid,text) to authenticated;
grant execute on function public.qq_party_add_stroke(uuid,jsonb) to authenticated;
grant execute on function public.qq_party_clear_canvas(uuid) to authenticated;
grant execute on function public.qq_party_next_croc_round(uuid,text) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.qq_party_rooms;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.qq_party_players;
exception when duplicate_object then null;
end $$;
