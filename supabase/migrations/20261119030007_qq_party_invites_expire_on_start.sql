-- Pending friend invites are no longer actionable once a room starts.
-- The trigger keeps the invitation inbox consistent for both games.
create or replace function private.qq_party_expire_invites_on_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status='waiting' and new.status<>'waiting' then
    update public.qq_party_invites
      set status='expired',responded_at=now()
      where room_id=new.id and status='pending';
  end if;
  return new;
end
$function$;

drop trigger if exists qq_party_expire_invites_on_start on public.qq_party_rooms;
create trigger qq_party_expire_invites_on_start
after update of status on public.qq_party_rooms
for each row
when (old.status='waiting' and new.status<>'waiting')
execute function private.qq_party_expire_invites_on_start();

revoke all on function private.qq_party_expire_invites_on_start() from public,anon,authenticated;
