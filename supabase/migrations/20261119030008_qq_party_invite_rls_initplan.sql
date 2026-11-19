-- Cache auth.uid() once per statement inside the invitation RLS policy.
drop policy if exists qq_party_invites_participant_read on public.qq_party_invites;
create policy qq_party_invites_participant_read
  on public.qq_party_invites
  for select
  to authenticated
  using (
    sender_id=(select auth.uid())
    or recipient_id=(select auth.uid())
  );
