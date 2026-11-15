
create policy "No direct client access to match reward ledger"
on public.match_rewards
for all to authenticated
using (false)
with check (false);

create or replace function public.list_qqcross_my_matches()
returns table(match_id uuid,host_username text,status text,player_limit integer,current_turn_user_id uuid,state_version integer,created_at timestamptz)
language sql stable security definer set search_path = ''
as $function$
  select m.id,p.username,m.status,m.player_limit,m.current_turn_user_id,m.state_version,m.created_at
  from public.matches m join public.match_players mp on mp.match_id=m.id
  join public.profiles p on p.id=m.host_id
  where mp.user_id=auth.uid() and mp.status in ('accepted','playing','finished')
    and m.status in ('waiting','active','finished')
    and (m.finished_at is null or m.finished_at>now()-interval '14 days')
  order by m.created_at desc;
$function$;
