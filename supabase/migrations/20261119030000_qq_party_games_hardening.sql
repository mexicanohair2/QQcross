-- QQCross Party games: secure shared rooms, server-owned words, simultaneous guesses,
-- ordered drawing events, profile-backed identities, and bounded room capacity.
-- Existing public.qq_party_* APIs are retained where possible for client compatibility.

-- 1. Expand room capacity and persist the avatar snapshot next to the profile nickname.
alter table public.qq_party_rooms drop constraint if exists qq_party_rooms_player_limit_check;
alter table public.qq_party_rooms
  add constraint qq_party_rooms_player_limit_check check (player_limit between 2 and 12);

alter table public.qq_party_rooms drop constraint if exists qq_party_rooms_status_check;
alter table public.qq_party_rooms
  add constraint qq_party_rooms_status_check
  check (status in ('waiting','choosing','playing','finished','cancelled'));

alter table public.qq_party_players drop constraint if exists qq_party_players_seat_check;
alter table public.qq_party_players
  add constraint qq_party_players_seat_check check (seat between 1 and 12);

alter table public.qq_party_players
  add column if not exists avatar integer not null default 0;
alter table public.qq_party_players drop constraint if exists qq_party_players_avatar_check;
alter table public.qq_party_players
  add constraint qq_party_players_avatar_check check (avatar between 0 and 9);

create index if not exists qq_party_players_user_idx on public.qq_party_players(user_id);
create index if not exists qq_party_rooms_host_idx on public.qq_party_rooms(host_id);
create index if not exists qq_party_events_actor_idx on public.qq_party_events(actor_id);
create index if not exists qq_party_secrets_artist_idx on public.qq_party_secrets(artist_id);

-- 2. The server, not the client, owns the source dictionary and QQ Draw word choices.
create table if not exists private.qq_party_word_bank (
  word text primary key,
  enabled boolean not null default true,
  constraint qq_party_word_bank_word_check
    check (word = lower(word) and word ~ '^[а-яё]{4,20}$')
);
alter table private.qq_party_word_bank enable row level security;
revoke all on table private.qq_party_word_bank from public, anon, authenticated;

insert into private.qq_party_word_bank(word) values
('арбуз'),('банан'),('берег'),('билет'),('белка'),('бочка'),('ветер'),('вилка'),
('вишня'),('волна'),('ворона'),('время'),('глина'),('гнездо'),('город'),('гриб'),
('груша'),('дверь'),('дождь'),('доска'),('дубль'),('ежик'),('железо'),('жемчуг'),
('жираф'),('завод'),('замок'),('запах'),('зебра'),('земля'),('зеркало'),('зима'),
('игрок'),('индеец'),('кабан'),('кактус'),('камень'),('камин'),('капля'),('карта'),
('каска'),('кастрюля'),('катер'),('качели'),('кедр'),('кепка'),('кисть'),('клавиша'),
('клетка'),('книга'),('кнопка'),('кобра'),('ковер'),('колено'),('колесо'),('комета'),
('комната'),('конверт'),('корзина'),('корова'),('космос'),('костер'),('кошка'),('краб'),
('кран'),('кресло'),('кролик'),('кружка'),('крыша'),('кузнец'),('кукла'),('курица'),
('лавина'),('лампа'),('ландыш'),('леска'),('лимон'),('линейка'),('лиса'),('листок'),
('лодка'),('лопата'),('лошадь'),('луна'),('лыжи'),('магазин'),('магнит'),('майка'),
('макет'),('малина'),('маска'),('машина'),('медаль'),('медведь'),('мелок'),('метель'),
('метро'),('молот'),('морковь'),('мост'),('мотор'),('муха'),('мячик'),('набор'),
('навес'),('нитка'),('ножницы'),('облако'),('огонь'),('океан'),('окно'),('олень'),
('орех'),('осень'),('остров'),('отель'),('пальма'),('панда'),('парус'),('паста'),
('паук'),('певец'),('пенал'),('перец'),('песок'),('петух'),('печать'),('печенье'),
('пианино'),('письмо'),('пицца'),('пламя'),('плита'),('плоскость'),('погода'),('подкова'),
('подушка'),('поезд'),('пожар'),('полка'),('помидор'),('попугай'),('порог'),('порт'),
('порция'),('поток'),('почка'),('пчела'),('пятно'),('радуга'),('ракета'),('рамка'),
('рубашка'),('рыба'),('рюкзак'),('сапог'),('сахар'),('свеча'),('свитер'),('север'),
('сердце'),('сетка'),('сигнал'),('сирень'),('скала'),('скворец'),('скрипка'),('слава'),
('солнце'),('сосна'),('спичка'),('стакан'),('стена'),('степь'),('столик'),('струна'),
('сумка'),('сурок'),('сцена'),('сырник'),('табак'),('такси'),('тарелка'),('театр'),
('телефон'),('тетрадь'),('тигр'),('ткань'),('тополь'),('торт'),('трава'),('труба'),
('туман'),('тыква'),('угол'),('улица'),('утка'),('факел'),('фазан'),('фонарь'),
('футбол'),('халат'),('хвост'),('хлеб'),('хлопок'),('хомяк'),('холод'),('цветок'),
('чайник'),('часы'),('чашка'),('чемодан'),('черепаха'),('чертеж'),('чехол'),('шапка'),
('шарик'),('шахматы'),('швея'),('шишка'),('школа'),('шляпа'),('шоколад'),('шоссе'),
('штора'),('штурвал'),('щетка'),('экран'),('эскимо'),('юбка'),('ящик'),
('автобус'),('аквариум'),('аккордеон'),('апельсин'),('барабан'),('библиотека'),('велосипед'),
('вертолет'),('водопад'),('воздушныйшар'),('гитара'),('динозавр'),('домино'),('карандаш'),
('карнавал'),('картофель'),('колокольчик'),('компас'),('корабль'),('корона'),('космонавт'),
('крокодил'),('лаборатория'),('мандарин'),('медуза'),('мороженое'),('наушники'),('паровоз'),
('пирамида'),('подводнаялодка'),('пылесос'),('самолет'),('самовар'),('светофор'),('скейтборд'),
('снеговик'),('снегурочка'),('телескоп'),('термометр'),('трамвай'),('трещотка'),('фейерверк'),
('фламинго'),('фотография'),('чемпион'),('череп'),('электричка')
on conflict (word) do nothing;

-- Only a real, confirmed QQCross account with an existing profile may enter a network room.
create or replace function private.qq_party_require_human()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_anonymous boolean;
  v_confirmed_at timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select u.is_anonymous,u.email_confirmed_at
    into v_is_anonymous,v_confirmed_at
  from auth.users u
  where u.id=v_uid;
  if not found or coalesce(v_is_anonymous,true) or v_confirmed_at is null then
    raise exception 'VERIFIED_ACCOUNT_REQUIRED';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid) then
    raise exception 'PROFILE_REQUIRED';
  end if;
  return v_uid;
end
$function$;

revoke all on function private.qq_party_require_human() from public, anon;
grant execute on function private.qq_party_require_human() to authenticated;

-- 3. One event per drawing action. Sequence uniqueness is enforced by the database.
create table if not exists public.qq_party_draw_events (
  room_id uuid not null references public.qq_party_rooms(id) on delete cascade,
  round_no integer not null check (round_no >= 1),
  sequence_no bigint not null check (sequence_no > 0),
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('begin','move','end','clear','undo')),
  stroke_id bigint,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=5000),
  created_at timestamptz not null default now(),
  primary key(room_id,round_no,sequence_no)
);
create index if not exists qq_party_draw_events_actor_idx
  on public.qq_party_draw_events(actor_id);
alter table public.qq_party_draw_events enable row level security;
drop policy if exists qq_party_draw_events_member_read on public.qq_party_draw_events;
create policy qq_party_draw_events_member_read
  on public.qq_party_draw_events for select to authenticated
  using (private.qq_party_is_member(room_id));
revoke all on table public.qq_party_draw_events from public, anon, authenticated;
grant select on table public.qq_party_draw_events to authenticated;

create table if not exists private.qq_party_draw_choices (
  room_id uuid primary key references public.qq_party_rooms(id) on delete cascade,
  round_no integer not null check (round_no >= 1),
  artist_id uuid not null references auth.users(id) on delete cascade,
  choices text[] not null check (cardinality(choices)=3),
  created_at timestamptz not null default now()
);
alter table private.qq_party_draw_choices enable row level security;
revoke all on table private.qq_party_draw_choices from public, anon, authenticated;

-- 4. Create/join reads identity from QQCross profiles; client-supplied names and avatars are ignored.
create or replace function private.qq_party_create_room(
  p_game text,p_nickname text,p_player_limit integer,p_public_state jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_code text;
  v_username text;
  v_avatar integer;
begin
  if p_game not in ('team_word','crocodile') then raise exception 'INVALID_GAME'; end if;
  if p_player_limit not between 2 and 12 then raise exception 'INVALID_PLAYER_LIMIT'; end if;
  select p.username,p.avatar into v_username,v_avatar
    from public.profiles p where p.id=v_uid;
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(
      select 1 from public.qq_party_rooms r
      where r.code=v_code and r.status in ('waiting','choosing','playing')
    );
  end loop;
  insert into public.qq_party_rooms(code,game,host_id,player_limit,public_state)
    values(v_code,p_game,v_uid,p_player_limit,'{}'::jsonb)
    returning * into v_room;
  insert into public.qq_party_players(room_id,user_id,nickname,avatar,seat)
    values(v_room.id,v_uid,v_username,v_avatar,1);
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(v_room.id,v_uid,'room_created',jsonb_build_object('game',p_game));
  return jsonb_build_object(
    'room_id',v_room.id,'code',v_room.code,'game',v_room.game,
    'status',v_room.status,'host_id',v_uid,'player_limit',v_room.player_limit
  );
end
$function$;

create or replace function private.qq_party_join_room(p_code text,p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_seat integer;
  v_username text;
  v_avatar integer;
begin
  select p.username,p.avatar into v_username,v_avatar
    from public.profiles p where p.id=v_uid;
  if length(trim(coalesce(p_code,'')))<>6 then raise exception 'INVALID_ROOM_CODE'; end if;
  select r.* into v_room
    from public.qq_party_rooms r
    join public.qq_party_players p on p.room_id=r.id
    where r.code=upper(trim(p_code)) and r.expires_at>now() and p.user_id=v_uid;
  if found then
    return jsonb_build_object(
      'room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status,
      'player_limit',v_room.player_limit
    );
  end if;
  select * into v_room
    from public.qq_party_rooms r
    where r.code=upper(trim(p_code))
      and r.status='waiting'
      and r.expires_at>now()
    for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select s into v_seat
    from generate_series(1,v_room.player_limit) s
    where not exists(
      select 1 from public.qq_party_players p where p.room_id=v_room.id and p.seat=s
    )
    order by s
    limit 1;
  if v_seat is null then raise exception 'ROOM_FULL'; end if;
  insert into public.qq_party_players(room_id,user_id,nickname,avatar,seat)
    values(v_room.id,v_uid,v_username,v_avatar,v_seat);
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(v_room.id,v_uid,'player_joined',jsonb_build_object('nickname',v_username));
  return jsonb_build_object(
    'room_id',v_room.id,'code',v_room.code,'game',v_room.game,'status',v_room.status,
    'player_limit',v_room.player_limit
  );
end
$function$;

-- 5. Server-owned Team Word timer. A client may request a tick, but the server clock decides.
create or replace function private.qq_party_tick_team_word(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.qq_party_rooms;
  v_word text;
  v_state jsonb;
  v_revealed jsonb;
  v_next timestamptz;
  v_position integer;
  v_length integer;
begin
  if not exists(
    select 1 from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=auth.uid()
  ) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.game<>'team_word' or v_room.status<>'playing' then
    return coalesce(v_room.public_state,'{}'::jsonb);
  end if;
  select s.secret_word into v_word
    from public.qq_party_secrets s where s.room_id=p_room_id;
  if v_word is null then raise exception 'SECRET_WORD_NOT_FOUND'; end if;
  v_length:=char_length(v_word);
  v_state:=v_room.public_state;
  v_revealed:=coalesce(v_state->'revealed','[]'::jsonb);
  v_next:=coalesce((v_state->>'next_reveal_at')::timestamptz,v_room.started_at+interval '15 seconds');
  while v_next<=now() and jsonb_array_length(v_revealed)<v_length loop
    select g into v_position
      from generate_series(1,v_length) g
      where not exists(
        select 1 from jsonb_array_elements(v_revealed) e
        where (e->>'index')::integer=g-1
      )
      order by random()
      limit 1;
    exit when v_position is null;
    v_revealed:=v_revealed||jsonb_build_array(
      jsonb_build_object('index',v_position-1,'letter',substr(v_word,v_position,1))
    );
    v_next:=v_next+interval '15 seconds';
    v_position:=null;
  end loop;
  if v_revealed is distinct from coalesce(v_state->'revealed','[]'::jsonb) then
    v_state:=jsonb_set(v_state,'{revealed}',v_revealed,true);
    if jsonb_array_length(v_revealed)>=v_length then
      v_state:=v_state-'next_reveal_at';
    else
      v_state:=jsonb_set(v_state,'{next_reveal_at}',to_jsonb(v_next),true);
    end if;
    update public.qq_party_rooms
      set public_state=v_state,updated_at=now()
      where id=p_room_id;
  end if;
  return v_state;
end
$function$;

-- 6. Team Word: random server dictionary answer; simultaneous guesses; no turn ownership.
create or replace function private.qq_party_start_team_word(
  p_room_id uuid,p_words jsonb,p_length integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_word text;
  v_length integer;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
  if v_room.game<>'team_word' or v_room.status not in ('waiting','finished') then
    raise exception 'INVALID_GAME_STATE';
  end if;
  if (select count(*) from public.qq_party_players p where p.room_id=p_room_id)<2 then
    raise exception 'NEED_TWO_PLAYERS';
  end if;
  select b.word into v_word
    from private.qq_party_word_bank b
    where b.enabled and char_length(b.word) between 4 and 8
    order by random()
    limit 1;
  if v_word is null then raise exception 'WORD_BANK_EMPTY'; end if;
  v_length:=char_length(v_word);
  insert into public.qq_party_secrets(room_id,secret_word,artist_id)
    values(p_room_id,v_word,null)
    on conflict(room_id) do update
      set secret_word=excluded.secret_word,artist_id=null,updated_at=now();
  update public.qq_party_rooms
    set status='playing',
        round_no=case when v_room.status='finished' then round_no+1 else round_no end,
        started_at=now(),
        public_state=jsonb_build_object(
          'length',v_length,
          'revealed','[]'::jsonb,
          'guesses','[]'::jsonb,
          'winner_seat',null,
          'next_reveal_at',now()+interval '15 seconds'
        ),
        updated_at=now()
    where id=p_room_id;
  return private.qq_party_get_room(p_room_id);
end
$function$;

create or replace function private.qq_party_team_guess(p_room_id uuid,p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_player public.qq_party_players;
  v_target text;
  v_guesses jsonb;
  v_length integer;
  v_correct boolean;
  v_feedback jsonb;
  v_username text;
  v_avatar integer;
  v_normalized text;
begin
  perform private.qq_party_tick_team_word(p_room_id);
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  select * into v_player from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=v_uid;
  if not found then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.game<>'team_word' or v_room.status<>'playing' then
    raise exception 'ROUND_NOT_ACTIVE';
  end if;
  select s.secret_word into v_target from public.qq_party_secrets s where s.room_id=p_room_id;
  v_length:=(v_room.public_state->>'length')::integer;
  if p_word is null or p_word !~ '^[а-яА-ЯёЁ]+$' then raise exception 'INVALID_GUESS'; end if;
  v_normalized:=lower(replace(p_word,'ё','е'));
  if char_length(v_normalized)<>v_length then raise exception 'INVALID_WORD_LENGTH'; end if;
  v_guesses:=coalesce(v_room.public_state->'guesses','[]'::jsonb);
  if jsonb_array_length(v_guesses)>=150 then raise exception 'GUESS_LIMIT_REACHED'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_guesses) g
    where g->>'word'=v_normalized
  ) then raise exception 'DUPLICATE_GUESS'; end if;
  select p.username,p.avatar into v_username,v_avatar
    from public.profiles p where p.id=v_uid;
  v_feedback:=public.qq_party_score_guess(v_normalized,v_target);
  v_correct:=v_normalized=v_target;
  v_guesses:=v_guesses||jsonb_build_array(jsonb_build_object(
    'word',v_normalized,'user_id',v_uid,'nickname',v_username,'avatar',v_avatar,
    'seat',v_player.seat,'feedback',v_feedback,'correct',v_correct,'created_at',now()
  ));
  if v_correct then
    update public.qq_party_rooms
      set status='finished',
          public_state=(v_room.public_state||jsonb_build_object(
            'guesses',v_guesses,'winner_seat',v_player.seat,'solution',v_target,
            'solved_by',v_uid,'solved_at',now()
          )),
          updated_at=now()
      where id=p_room_id;
  else
    update public.qq_party_rooms
      set public_state=jsonb_set(v_room.public_state,'{guesses}',v_guesses,true),
          updated_at=now()
      where id=p_room_id;
  end if;
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(p_room_id,v_uid,'team_guess',jsonb_build_object('word',v_normalized,'correct',v_correct));
  return private.qq_party_get_room(p_room_id);
end
$function$;

-- 7. QQ Draw: server randomly selects the first artist; artist privately receives three choices.
create or replace function private.qq_party_prepare_draw_choices(
  p_room_id uuid,p_artist_id uuid,p_increment_round boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_room public.qq_party_rooms;
  v_artist_seat integer;
  v_choices text[];
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or v_room.game<>'crocodile' then raise exception 'INVALID_GAME'; end if;
  if not exists(
    select 1 from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=p_artist_id
  ) then raise exception 'ARTIST_NOT_IN_ROOM'; end if;
  select p.seat into v_artist_seat
    from public.qq_party_players p where p.room_id=p_room_id and p.user_id=p_artist_id;
  select array_agg(q.word) into v_choices
    from (
      select b.word from private.qq_party_word_bank b
      where b.enabled and char_length(b.word) between 4 and 20
      order by random()
      limit 3
    ) q;
  if coalesce(cardinality(v_choices),0)<>3 then raise exception 'WORD_BANK_EMPTY'; end if;
  insert into private.qq_party_draw_choices(room_id,round_no,artist_id,choices,created_at)
    values(
      p_room_id,
      v_room.round_no+case when p_increment_round then 1 else 0 end,
      p_artist_id,v_choices,now()
    )
    on conflict(room_id) do update
      set round_no=excluded.round_no,artist_id=excluded.artist_id,
          choices=excluded.choices,created_at=now();
  delete from public.qq_party_secrets s where s.room_id=p_room_id;
  update public.qq_party_rooms
    set status='choosing',
        round_no=round_no+case when p_increment_round then 1 else 0 end,
        public_state=jsonb_build_object(
          'artist_id',p_artist_id,
          'artist_seat',v_artist_seat,
          'guesses','[]'::jsonb,
          'winner_seat',null
        ),
        updated_at=now()
    where id=p_room_id;
end
$function$;

create or replace function private.qq_party_start_crocodile(p_room_id uuid,p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_artist uuid;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or v_room.host_id<>v_uid then raise exception 'HOST_ONLY'; end if;
  if v_room.game<>'crocodile' or v_room.status<>'waiting' then
    raise exception 'INVALID_GAME_STATE';
  end if;
  if (select count(*) from public.qq_party_players p where p.room_id=p_room_id)<2 then
    raise exception 'NEED_TWO_PLAYERS';
  end if;
  select p.user_id into v_artist
    from public.qq_party_players p
    where p.room_id=p_room_id
    order by random()
    limit 1;
  perform private.qq_party_prepare_draw_choices(p_room_id,v_artist,false);
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(p_room_id,v_uid,'draw_round_prepared',jsonb_build_object('round',v_room.round_no));
  return private.qq_party_get_room(p_room_id);
end
$function$;

create or replace function private.qq_party_refresh_croc_choices(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or v_room.game<>'crocodile' or v_room.status<>'choosing' then
    raise exception 'ROUND_NOT_CHOOSING';
  end if;
  if v_room.public_state->>'artist_id' is distinct from v_uid::text then
    raise exception 'ARTIST_ONLY';
  end if;
  perform private.qq_party_prepare_draw_choices(p_room_id,v_uid,false);
  return private.qq_party_get_room(p_room_id);
end
$function$;

create or replace function private.qq_party_confirm_croc_word(p_room_id uuid,p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_choices private.qq_party_draw_choices;
  v_normalized text;
  v_artist_seat integer;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or v_room.game<>'crocodile' or v_room.status<>'choosing' then
    raise exception 'ROUND_NOT_CHOOSING';
  end if;
  if v_room.public_state->>'artist_id' is distinct from v_uid::text then
    raise exception 'ARTIST_ONLY';
  end if;
  select * into v_choices from private.qq_party_draw_choices c where c.room_id=p_room_id;
  if not found or v_choices.artist_id<>v_uid or v_choices.round_no<>v_room.round_no then
    raise exception 'DRAW_CHOICES_EXPIRED';
  end if;
  if p_word is null or p_word !~ '^[а-яА-ЯёЁ]{4,20}$' then
    raise exception 'INVALID_WORD';
  end if;
  v_normalized:=lower(replace(p_word,'ё','е'));
  if not (v_normalized=any(v_choices.choices)) then raise exception 'WORD_NOT_IN_CHOICES'; end if;
  v_artist_seat:=(v_room.public_state->>'artist_seat')::integer;
  insert into public.qq_party_secrets(room_id,secret_word,artist_id)
    values(p_room_id,v_normalized,v_uid)
    on conflict(room_id) do update
      set secret_word=excluded.secret_word,artist_id=excluded.artist_id,updated_at=now();
  update public.qq_party_rooms
    set status='playing',
        public_state=v_room.public_state||jsonb_build_object(
          'guesses','[]'::jsonb,'winner_seat',null,'artist_id',v_uid,'artist_seat',v_artist_seat
        ),
        updated_at=now()
    where id=p_room_id;
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(p_room_id,v_uid,'draw_word_confirmed',jsonb_build_object('round',v_room.round_no));
  return private.qq_party_get_room(p_room_id);
end
$function$;

create or replace function private.qq_party_croc_guess(p_room_id uuid,p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_player public.qq_party_players;
  v_target text;
  v_artist uuid;
  v_guesses jsonb;
  v_username text;
  v_avatar integer;
  v_normalized text;
  v_correct boolean;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  select * into v_player from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=v_uid;
  if not found then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.game<>'crocodile' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
  select s.secret_word,s.artist_id into v_target,v_artist
    from public.qq_party_secrets s where s.room_id=p_room_id;
  if v_uid=v_artist then raise exception 'ARTIST_CANNOT_GUESS'; end if;
  if p_word is null or p_word !~ '^[а-яА-ЯёЁ]{1,30}$' then raise exception 'INVALID_GUESS'; end if;
  v_normalized:=lower(replace(p_word,'ё','е'));
  v_guesses:=coalesce(v_room.public_state->'guesses','[]'::jsonb);
  if jsonb_array_length(v_guesses)>=300 then raise exception 'GUESS_LIMIT_REACHED'; end if;
  if exists(
    select 1 from jsonb_array_elements(v_guesses) g
    where g->>'user_id'=v_uid::text and g->>'word'=v_normalized
  ) then raise exception 'DUPLICATE_GUESS'; end if;
  select p.username,p.avatar into v_username,v_avatar
    from public.profiles p where p.id=v_uid;
  v_correct:=v_normalized=v_target;
  v_guesses:=v_guesses||jsonb_build_array(jsonb_build_object(
    'word',v_normalized,'user_id',v_uid,'nickname',v_username,'avatar',v_avatar,
    'seat',v_player.seat,'correct',v_correct,'created_at',now()
  ));
  if v_correct then
    update public.qq_party_rooms
      set status='finished',
          public_state=v_room.public_state||jsonb_build_object(
            'guesses',v_guesses,'winner_seat',v_player.seat,'solution',v_target,
            'solved_by',v_uid,'solved_at',now()
          ),
          updated_at=now()
      where id=p_room_id;
  else
    update public.qq_party_rooms
      set public_state=jsonb_set(v_room.public_state,'{guesses}',v_guesses,true),
          updated_at=now()
      where id=p_room_id;
  end if;
  insert into public.qq_party_events(room_id,actor_id,event_type,payload)
    values(p_room_id,v_uid,'draw_guess',jsonb_build_object('word',v_normalized,'correct',v_correct));
  return private.qq_party_get_room(p_room_id);
end
$function$;

create or replace function private.qq_party_next_croc_round(p_room_id uuid,p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_winner_seat integer;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or v_room.game<>'crocodile' or v_room.status<>'finished' then
    raise exception 'ROUND_NOT_FINISHED';
  end if;
  v_winner_seat:=(v_room.public_state->>'winner_seat')::integer;
  if not exists(
    select 1 from public.qq_party_players p
    where p.room_id=p_room_id and p.user_id=v_uid and p.seat=v_winner_seat
  ) then raise exception 'WINNER_ONLY'; end if;
  perform private.qq_party_prepare_draw_choices(p_room_id,v_uid,true);
  return private.qq_party_get_room(p_room_id);
end
$function$;

-- 8. Append-only stroke events. Each artist sends an explicit sequence and round identifier.
create or replace function private.qq_party_add_stroke(p_room_id uuid,p_stroke jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_artist uuid;
  v_sequence bigint;
  v_stroke_id bigint;
  v_last_sequence bigint;
  v_event_type text;
  v_existing public.qq_party_draw_events;
  v_x numeric;
  v_y numeric;
  v_width numeric;
begin
  if p_stroke is null or jsonb_typeof(p_stroke)<>'object'
     or octet_length(p_stroke::text)>4000 then raise exception 'INVALID_DRAW_EVENT'; end if;
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or not exists(
    select 1 from public.qq_party_players p where p.room_id=p_room_id and p.user_id=v_uid
  ) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.game<>'crocodile' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
  select s.artist_id into v_artist from public.qq_party_secrets s where s.room_id=p_room_id;
  if v_artist is distinct from v_uid then raise exception 'ARTIST_ONLY'; end if;
  if p_stroke->>'roundId' is distinct from (v_room.id::text||':'||v_room.round_no::text) then
    raise exception 'STALE_DRAW_ROUND';
  end if;
  if p_stroke->>'playerId' is distinct from v_uid::text then raise exception 'INVALID_DRAW_ACTOR'; end if;
  v_event_type:=p_stroke->>'type';
  if v_event_type is null or v_event_type not in ('begin','move','end') then
    raise exception 'INVALID_DRAW_EVENT_TYPE';
  end if;
  if coalesce(p_stroke->>'sequence','') !~ '^[1-9][0-9]{0,8}$'
     or coalesce(p_stroke->>'strokeId','') !~ '^[1-9][0-9]{0,8}$'
     or jsonb_typeof(p_stroke->'x') is distinct from 'number'
     or jsonb_typeof(p_stroke->'y') is distinct from 'number'
     or jsonb_typeof(p_stroke->'thickness') is distinct from 'number' then
    raise exception 'INVALID_DRAW_EVENT_FIELDS';
  end if;
  v_sequence:=(p_stroke->>'sequence')::bigint;
  v_stroke_id:=(p_stroke->>'strokeId')::bigint;
  v_x:=(p_stroke->>'x')::numeric;
  v_y:=(p_stroke->>'y')::numeric;
  v_width:=(p_stroke->>'thickness')::numeric;
  if v_x not between 0 and 1 or v_y not between 0 and 1 or v_width not between 1 and 32 then
    raise exception 'DRAW_COORDINATE_OUT_OF_RANGE';
  end if;
  if coalesce(p_stroke->>'color','') !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_DRAW_COLOR';
  end if;
  if v_event_type='begin' and v_stroke_id<>v_sequence then
    raise exception 'INVALID_STROKE_START';
  end if;
  if v_event_type in ('move','end') and not exists(
    select 1 from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no
      and e.event_type='begin' and e.stroke_id=v_stroke_id
  ) then raise exception 'STROKE_NOT_STARTED'; end if;
  if v_event_type in ('move','end') and exists(
    select 1 from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no
      and e.event_type in ('end','undo') and e.stroke_id=v_stroke_id
  ) then raise exception 'STROKE_ALREADY_ENDED'; end if;

  select * into v_existing from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no and e.sequence_no=v_sequence;
  if found then
    if v_existing.actor_id=v_uid and v_existing.event_type=v_event_type
       and v_existing.stroke_id=v_stroke_id and v_existing.payload=p_stroke then
      return jsonb_build_object('ok',true,'duplicate',true,'sequence',v_sequence);
    end if;
    raise exception 'DRAW_SEQUENCE_CONFLICT';
  end if;
  select coalesce(max(e.sequence_no),0) into v_last_sequence
    from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no;
  if v_sequence<>v_last_sequence+1 then raise exception 'DRAW_SEQUENCE_GAP'; end if;
  insert into public.qq_party_draw_events(
    room_id,round_no,sequence_no,actor_id,event_type,stroke_id,payload
  ) values(
    p_room_id,v_room.round_no,v_sequence,v_uid,v_event_type,v_stroke_id,p_stroke
  );
  return jsonb_build_object('ok',true,'duplicate',false,'sequence',v_sequence);
end
$function$;

create or replace function private.qq_party_clear_canvas(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_artist uuid;
  v_sequence bigint;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or not exists(
    select 1 from public.qq_party_players p where p.room_id=p_room_id and p.user_id=v_uid
  ) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.game<>'crocodile' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
  select s.artist_id into v_artist from public.qq_party_secrets s where s.room_id=p_room_id;
  if v_artist is distinct from v_uid then raise exception 'ARTIST_ONLY'; end if;
  select coalesce(max(e.sequence_no),0)+1 into v_sequence
    from public.qq_party_draw_events e where e.room_id=p_room_id and e.round_no=v_room.round_no;
  insert into public.qq_party_draw_events(room_id,round_no,sequence_no,actor_id,event_type,payload)
    values(p_room_id,v_room.round_no,v_sequence,v_uid,'clear','{}'::jsonb);
  return jsonb_build_object('ok',true,'sequence',v_sequence);
end
$function$;

create or replace function private.qq_party_undo_canvas(p_room_id uuid,p_stroke_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_artist uuid;
  v_sequence bigint;
begin
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id for update;
  if not found or not exists(
    select 1 from public.qq_party_players p where p.room_id=p_room_id and p.user_id=v_uid
  ) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if v_room.game<>'crocodile' or v_room.status<>'playing' then raise exception 'ROUND_NOT_ACTIVE'; end if;
  select s.artist_id into v_artist from public.qq_party_secrets s where s.room_id=p_room_id;
  if v_artist is distinct from v_uid then raise exception 'ARTIST_ONLY'; end if;
  if not exists(
    select 1 from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no
      and e.event_type='begin' and e.stroke_id=p_stroke_id
  ) then raise exception 'STROKE_NOT_FOUND'; end if;
  if exists(
    select 1 from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no
      and e.event_type='undo' and e.stroke_id=p_stroke_id
  ) then raise exception 'STROKE_ALREADY_UNDONE'; end if;
  select coalesce(max(e.sequence_no),0)+1 into v_sequence
    from public.qq_party_draw_events e where e.room_id=p_room_id and e.round_no=v_room.round_no;
  insert into public.qq_party_draw_events(
    room_id,round_no,sequence_no,actor_id,event_type,stroke_id,payload
  ) values(
    p_room_id,v_room.round_no,v_sequence,v_uid,'undo',p_stroke_id,
    jsonb_build_object('strokeId',p_stroke_id)
  );
  return jsonb_build_object('ok',true,'sequence',v_sequence);
end
$function$;

-- 9. Room snapshot: profile-backed avatars, revealed letters, secret data only for the artist.
create or replace function private.qq_party_get_room(p_room_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_room public.qq_party_rooms;
  v_players jsonb;
  v_private jsonb := 'null'::jsonb;
  v_draw_events jsonb := '[]'::jsonb;
  v_word text;
  v_choices text[];
begin
  if v_uid is null or not private.qq_party_is_member(p_room_id) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  perform private.qq_party_tick_team_word(p_room_id);
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'user_id',p.user_id,'nickname',p.nickname,'avatar',p.avatar,'seat',p.seat
    ) order by p.seat),
    '[]'::jsonb
  ) into v_players
    from public.qq_party_players p where p.room_id=p_room_id;

  if v_room.game='team_word' and v_room.status='finished' then
    select jsonb_build_object('word',s.secret_word) into v_private
      from public.qq_party_secrets s where s.room_id=p_room_id;
  elsif v_room.game='crocodile' then
    if v_room.status='choosing' and v_room.public_state->>'artist_id'=v_uid::text then
      select c.choices into v_choices
        from private.qq_party_draw_choices c
        where c.room_id=p_room_id and c.artist_id=v_uid and c.round_no=v_room.round_no;
      if v_choices is not null then
        v_private:=jsonb_build_object('role','artist','choices',to_jsonb(v_choices));
      end if;
    elsif v_room.status='playing' then
      select jsonb_build_object('role','artist','word',s.secret_word) into v_private
        from public.qq_party_secrets s
        where s.room_id=p_room_id and s.artist_id=v_uid;
    end if;
  end if;

  if v_room.game='crocodile' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'roundId',e.room_id::text||':'||e.round_no::text,
          'playerId',e.actor_id,
          'type',e.event_type,
          'sequence',e.sequence_no,
          'strokeId',e.stroke_id,
          'payload',e.payload,
          'createdAt',e.created_at
        ) order by e.sequence_no
      ),
      '[]'::jsonb
    ) into v_draw_events
    from (
      select * from public.qq_party_draw_events e
      where e.room_id=p_room_id and e.round_no=v_room.round_no
      order by e.sequence_no desc
      limit 2500
    ) e;
  end if;

  return jsonb_build_object(
    'room_id',v_room.id,'code',v_room.code,'game',v_room.game,'host_id',v_room.host_id,
    'player_limit',v_room.player_limit,'status',v_room.status,'round_no',v_room.round_no,
    'public_state',v_room.public_state,'players',v_players,
    'private',coalesce(v_private,'null'::jsonb),'draw_events',v_draw_events,
    'updated_at',v_room.updated_at
  );
end
$function$;

-- 10. Public RPC wrappers used by the independent game clients.
create or replace function public.qq_party_tick_team_word(p_room_id uuid)
returns jsonb language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_tick_team_word(p_room_id)
$function$;

create or replace function public.qq_party_refresh_croc_choices(p_room_id uuid)
returns jsonb language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_refresh_croc_choices(p_room_id)
$function$;

create or replace function public.qq_party_confirm_croc_word(p_room_id uuid,p_word text)
returns jsonb language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_confirm_croc_word(p_room_id,p_word)
$function$;

create or replace function public.qq_party_undo_canvas(p_room_id uuid,p_stroke_id bigint)
returns jsonb language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_undo_canvas(p_room_id,p_stroke_id)
$function$;

-- The new draw-event table is read-only to clients and included in Realtime.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='qq_party_draw_events'
  ) then
    alter publication supabase_realtime add table public.qq_party_draw_events;
  end if;
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='qq_party_events'
  ) then
    alter publication supabase_realtime add table public.qq_party_events;
  end if;
end $$;

-- Privileged implementations remain private; only authenticated RPC wrappers are callable.
revoke all on function private.qq_party_create_room(text,text,integer,jsonb) from public,anon;
revoke all on function private.qq_party_join_room(text,text) from public,anon;
revoke all on function private.qq_party_tick_team_word(uuid) from public,anon;
revoke all on function private.qq_party_start_team_word(uuid,jsonb,integer) from public,anon;
revoke all on function private.qq_party_team_guess(uuid,text) from public,anon;
revoke all on function private.qq_party_prepare_draw_choices(uuid,uuid,boolean) from public,anon;
revoke all on function private.qq_party_start_crocodile(uuid,text) from public,anon;
revoke all on function private.qq_party_refresh_croc_choices(uuid) from public,anon;
revoke all on function private.qq_party_confirm_croc_word(uuid,text) from public,anon;
revoke all on function private.qq_party_croc_guess(uuid,text) from public,anon;
revoke all on function private.qq_party_next_croc_round(uuid,text) from public,anon;
revoke all on function private.qq_party_add_stroke(uuid,jsonb) from public,anon;
revoke all on function private.qq_party_clear_canvas(uuid) from public,anon;
revoke all on function private.qq_party_undo_canvas(uuid,bigint) from public,anon;
revoke all on function private.qq_party_get_room(uuid) from public,anon;

grant execute on function private.qq_party_create_room(text,text,integer,jsonb) to authenticated;
grant execute on function private.qq_party_join_room(text,text) to authenticated;
grant execute on function private.qq_party_tick_team_word(uuid) to authenticated;
grant execute on function private.qq_party_start_team_word(uuid,jsonb,integer) to authenticated;
grant execute on function private.qq_party_team_guess(uuid,text) to authenticated;
grant execute on function private.qq_party_start_crocodile(uuid,text) to authenticated;
grant execute on function private.qq_party_refresh_croc_choices(uuid) to authenticated;
grant execute on function private.qq_party_confirm_croc_word(uuid,text) to authenticated;
grant execute on function private.qq_party_croc_guess(uuid,text) to authenticated;
grant execute on function private.qq_party_next_croc_round(uuid,text) to authenticated;
grant execute on function private.qq_party_add_stroke(uuid,jsonb) to authenticated;
grant execute on function private.qq_party_clear_canvas(uuid) to authenticated;
grant execute on function private.qq_party_undo_canvas(uuid,bigint) to authenticated;
grant execute on function private.qq_party_get_room(uuid) to authenticated;

revoke all on function public.qq_party_create_room(text,text,integer,jsonb) from public,anon;
revoke all on function public.qq_party_join_room(text,text) from public,anon;
revoke all on function public.qq_party_tick_team_word(uuid) from public,anon;
revoke all on function public.qq_party_start_team_word(uuid,jsonb,integer) from public,anon;
revoke all on function public.qq_party_team_guess(uuid,text) from public,anon;
revoke all on function public.qq_party_start_crocodile(uuid,text) from public,anon;
revoke all on function public.qq_party_refresh_croc_choices(uuid) from public,anon;
revoke all on function public.qq_party_confirm_croc_word(uuid,text) from public,anon;
revoke all on function public.qq_party_croc_guess(uuid,text) from public,anon;
revoke all on function public.qq_party_next_croc_round(uuid,text) from public,anon;
revoke all on function public.qq_party_add_stroke(uuid,jsonb) from public,anon;
revoke all on function public.qq_party_clear_canvas(uuid) from public,anon;
revoke all on function public.qq_party_undo_canvas(uuid,bigint) from public,anon;
revoke all on function public.qq_party_get_room(uuid) from public,anon;
revoke all on function public.qq_party_score_guess(text,text) from public,anon,authenticated;

grant execute on function public.qq_party_create_room(text,text,integer,jsonb) to authenticated;
grant execute on function public.qq_party_join_room(text,text) to authenticated;
grant execute on function public.qq_party_tick_team_word(uuid) to authenticated;
grant execute on function public.qq_party_start_team_word(uuid,jsonb,integer) to authenticated;
grant execute on function public.qq_party_team_guess(uuid,text) to authenticated;
grant execute on function public.qq_party_start_crocodile(uuid,text) to authenticated;
grant execute on function public.qq_party_refresh_croc_choices(uuid) to authenticated;
grant execute on function public.qq_party_confirm_croc_word(uuid,text) to authenticated;
grant execute on function public.qq_party_croc_guess(uuid,text) to authenticated;
grant execute on function public.qq_party_next_croc_round(uuid,text) to authenticated;
grant execute on function public.qq_party_add_stroke(uuid,jsonb) to authenticated;
grant execute on function public.qq_party_clear_canvas(uuid) to authenticated;
grant execute on function public.qq_party_undo_canvas(uuid,bigint) to authenticated;
grant execute on function public.qq_party_get_room(uuid) to authenticated;
