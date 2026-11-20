-- Team Word now reveals one letter per minute. The server clock remains authoritative.
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
  v_next:=coalesce((v_state->>'next_reveal_at')::timestamptz,v_room.started_at+interval '60 seconds');
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
    v_next:=v_next+interval '60 seconds';
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
          'next_reveal_at',now()+interval '60 seconds'
        ),
        updated_at=now()
    where id=p_room_id;
  return private.qq_party_get_room(p_room_id);
end
$function$;

-- Move the first reveal for any currently active round onto the new 60-second cadence.
update public.qq_party_rooms
set public_state=jsonb_set(
      coalesce(public_state,'{}'::jsonb),
      '{next_reveal_at}',
      to_jsonb(now()+interval '60 seconds'),
      true
    ),
    updated_at=now()
where game='team_word'
  and status='playing'
  and coalesce(public_state,'{}'::jsonb) ? 'next_reveal_at';

revoke all on function private.qq_party_tick_team_word(uuid) from public,anon;
revoke all on function private.qq_party_start_team_word(uuid,jsonb,integer) from public,anon;
grant execute on function private.qq_party_tick_team_word(uuid) to authenticated;
grant execute on function private.qq_party_start_team_word(uuid,jsonb,integer) to authenticated;
