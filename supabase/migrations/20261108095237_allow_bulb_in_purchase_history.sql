alter table public.purchases drop constraint if exists purchases_item_type_check;
alter table public.purchases add constraint purchases_item_type_check
  check (item_type = any (array['magnifier','clock','trash','bulb']::text[]));