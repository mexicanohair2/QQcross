-- QQCross public player identity and cosmetic inventory.
-- Apply this migration before enabling cloud avatar uploads and cosmetic purchases.
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists frame_id text not null default 'classic',
  add column if not exists active_title text not null default 'Новичок';

alter table public.profiles
  drop constraint if exists profiles_frame_id_check;
alter table public.profiles
  add constraint profiles_frame_id_check
  check (frame_id in ('classic','amethyst','royal','sakura','obsidian'));

grant select (id, username, avatar, avatar_url, frame_id, active_title, wins, games, points, created_at)
  on public.profiles to authenticated;
grant update (avatar_url, active_title)
  on public.profiles to authenticated;

create table if not exists public.qqcross_player_cosmetics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  cosmetic_id text not null check (cosmetic_id in ('amethyst','royal','sakura','obsidian')),
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);
alter table public.qqcross_player_cosmetics enable row level security;
drop policy if exists qqcross_cosmetics_read_own on public.qqcross_player_cosmetics;
create policy qqcross_cosmetics_read_own on public.qqcross_player_cosmetics
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.qqcross_player_cosmetics from public, anon, authenticated;
grant select on public.qqcross_player_cosmetics to authenticated;

create or replace function public.equip_qqcross_frame(p_frame_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_frame_id not in ('classic','amethyst','royal','sakura','obsidian') then
    raise exception 'INVALID_FRAME';
  end if;
  if p_frame_id<>'classic' and not exists(
    select 1 from public.qqcross_player_cosmetics
    where user_id=v_uid and cosmetic_id=p_frame_id
  ) then raise exception 'FRAME_NOT_OWNED'; end if;
  update public.profiles set frame_id=p_frame_id where id=v_uid;
  return jsonb_build_object('equipped',true,'frame_id',p_frame_id);
end
$function$;
revoke all on function public.equip_qqcross_frame(text) from public, anon;
grant execute on function public.equip_qqcross_frame(text) to authenticated;

create or replace function public.purchase_qqcross_cosmetic(p_cosmetic_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_cost integer;
  v_coins integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_cost := case p_cosmetic_id
    when 'amethyst' then 350
    when 'royal' then 550
    when 'sakura' then 300
    when 'obsidian' then 450
    else null end;
  if v_cost is null then raise exception 'INVALID_COSMETIC'; end if;
  if exists(select 1 from public.qqcross_player_cosmetics where user_id=v_uid and cosmetic_id=p_cosmetic_id) then
    select coins into v_coins from public.profiles where id=v_uid;
    return jsonb_build_object('owned',true,'coins',v_coins,'cosmetic_id',p_cosmetic_id);
  end if;
  update public.profiles set coins=coins-v_cost
    where id=v_uid and coins>=v_cost
    returning coins into v_coins;
  if v_coins is null then raise exception 'NOT_ENOUGH_COINS'; end if;
  insert into public.qqcross_player_cosmetics(user_id,cosmetic_id)
    values(v_uid,p_cosmetic_id);
  return jsonb_build_object('owned',true,'coins',v_coins,'cosmetic_id',p_cosmetic_id);
end
$function$;
revoke all on function public.purchase_qqcross_cosmetic(text) from public, anon;
grant execute on function public.purchase_qqcross_cosmetic(text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('qqcross-avatars','qqcross-avatars',true,8388608,array['image/webp','image/png','image/jpeg'])
on conflict (id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/webp','image/png','image/jpeg'];

drop policy if exists qqcross_avatar_public_read on storage.objects;
create policy qqcross_avatar_public_read on storage.objects
  for select to public using (bucket_id='qqcross-avatars');
drop policy if exists qqcross_avatar_owner_insert on storage.objects;
create policy qqcross_avatar_owner_insert on storage.objects
  for insert to authenticated with check (bucket_id='qqcross-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists qqcross_avatar_owner_update on storage.objects;
create policy qqcross_avatar_owner_update on storage.objects
  for update to authenticated using (bucket_id='qqcross-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='qqcross-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
