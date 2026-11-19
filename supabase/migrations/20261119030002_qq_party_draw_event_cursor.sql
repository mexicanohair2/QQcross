-- Cursor-based draw-event recovery keeps room snapshots small on mobile clients.
create or replace function private.qq_party_get_draw_events(
  p_room_id uuid,
  p_after_sequence bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := private.qq_party_require_human();
  v_room public.qq_party_rooms;
  v_events jsonb := '[]'::jsonb;
  v_last bigint := greatest(coalesce(p_after_sequence,0),0);
  v_has_more boolean := false;
begin
  if p_after_sequence is not null and p_after_sequence<0 then
    raise exception 'INVALID_EVENT_CURSOR';
  end if;
  select * into v_room from public.qq_party_rooms r where r.id=p_room_id;
  if not found or not private.qq_party_is_member(p_room_id) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;
  if v_room.game<>'crocodile' then
    return jsonb_build_object('room_id',p_room_id,'round_no',v_room.round_no,
      'events','[]'::jsonb,'next_after',v_last,'has_more',false);
  end if;
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'roundId',e.room_id::text||':'||e.round_no::text,
      'playerId',e.actor_id,
      'type',e.event_type,
      'sequence',e.sequence_no,
      'strokeId',e.stroke_id,
      'payload',e.payload,
      'createdAt',e.created_at
    ) order by e.sequence_no),
    '[]'::jsonb
  ) into v_events
  from (
    select * from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no
      and e.sequence_no>v_last
    order by e.sequence_no
    limit 1000
  ) e;
  select coalesce(max((x->>'sequence')::bigint),v_last)
    into v_last
  from jsonb_array_elements(v_events) x;
  select exists(
    select 1 from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no
      and e.sequence_no>v_last
  ) into v_has_more;
  return jsonb_build_object(
    'room_id',p_room_id,'round_no',v_room.round_no,
    'events',v_events,'next_after',v_last,'has_more',v_has_more
  );
end
$function$;

-- Room snapshots no longer embed a large drawing history; clients page it by sequence cursor.
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
  from public.qq_party_players p
  where p.room_id=p_room_id;

  if v_room.game='team_word' and v_room.status='finished' then
    select jsonb_build_object('word',s.secret_word) into v_private
    from public.qq_party_secrets s where s.room_id=p_room_id;
  elsif v_room.game='crocodile' then
    if v_room.status='choosing' and v_room.public_state->>'artist_id'=v_uid::text then
      select jsonb_build_object('role','artist','choices',to_jsonb(c.choices))
        into v_private
      from private.qq_party_draw_choices c
      where c.room_id=p_room_id and c.artist_id=v_uid and c.round_no=v_room.round_no;
    elsif v_room.status='playing' then
      select jsonb_build_object('role','artist','word',s.secret_word) into v_private
      from public.qq_party_secrets s
      where s.room_id=p_room_id and s.artist_id=v_uid;
    end if;
  end if;

  return jsonb_build_object(
    'room_id',v_room.id,'code',v_room.code,'game',v_room.game,'host_id',v_room.host_id,
    'player_limit',v_room.player_limit,'status',v_room.status,'round_no',v_room.round_no,
    'public_state',v_room.public_state,'players',v_players,
    'private',coalesce(v_private,'null'::jsonb),
    'draw_events','[]'::jsonb,'updated_at',v_room.updated_at
  );
end
$function$;

create or replace function public.qq_party_get_draw_events(
  p_room_id uuid,
  p_after_sequence bigint default 0
)
returns jsonb
language sql
set search_path = 'public','private','pg_temp'
as $function$
  select private.qq_party_get_draw_events(p_room_id,p_after_sequence)
$function$;

revoke all on function private.qq_party_get_draw_events(uuid,bigint) from public,anon;
grant execute on function private.qq_party_get_draw_events(uuid,bigint) to authenticated;
revoke all on function public.qq_party_get_draw_events(uuid,bigint) from public,anon;
grant execute on function public.qq_party_get_draw_events(uuid,bigint) to authenticated;
