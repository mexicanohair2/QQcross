-- Add the authoritative round-start timestamp used by the Team Word reveal clock.
alter table public.qq_party_rooms
  add column if not exists started_at timestamptz;

update public.qq_party_rooms
  set started_at=updated_at
  where status='playing' and started_at is null;

create index if not exists qq_party_draw_choices_artist_idx
  on private.qq_party_draw_choices(artist_id);
