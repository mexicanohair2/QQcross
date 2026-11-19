-- Retry-safe drawing event append: recognize a committed duplicate before stroke-state checks.
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

  -- A network retry may arrive after the same stroke has already ended.
  -- Compare its full payload before rejecting a state transition as duplicated.
  select * into v_existing from public.qq_party_draw_events e
    where e.room_id=p_room_id and e.round_no=v_room.round_no and e.sequence_no=v_sequence;
  if found then
    if v_existing.actor_id=v_uid and v_existing.event_type=v_event_type
       and v_existing.stroke_id=v_stroke_id and v_existing.payload=p_stroke then
      return jsonb_build_object('ok',true,'duplicate',true,'sequence',v_sequence);
    end if;
    raise exception 'DRAW_SEQUENCE_CONFLICT';
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

revoke all on function private.qq_party_add_stroke(uuid,jsonb) from public,anon;
grant execute on function private.qq_party_add_stroke(uuid,jsonb) to authenticated;
revoke all on function public.qq_party_add_stroke(uuid,jsonb) from public,anon;
grant execute on function public.qq_party_add_stroke(uuid,jsonb) to authenticated;
