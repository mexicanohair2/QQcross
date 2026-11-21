-- QQCross player identity, avatar frames and friend profile RPCs.
-- Idempotent migration matching the schema used by the application.
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists active_frame text not null default 'standard',
  add column if not exists owned_frames text[] not null default array['standard']::text[],
  add column if not exists active_title text not null default 'Новичок';

alter table public.profiles alter column active_frame set default 'standard';
alter table public.profiles alter column owned_frames set default array['standard']::text[];
alter table public.profiles alter column active_title set default 'Новичок';


update public.profiles set active_frame='standard'
where active_frame is null or active_frame not in ('standard','ruby','amethyst','royal','astral');
update public.profiles set active_title='Новичок'
where active_title is null or char_length(active_title)<1 or char_length(active_title)>64;
update public.profiles set avatar_url=null
where avatar_url is not null and avatar_url !~ '^https://lzpkronttfzbubbfggsb\.supabase\.co/storage/v1/object/public/avatars/[A-Za-z0-9_/-]+\.webp$';
update public.profiles
set owned_frames=array(
  select frame from unnest(coalesce(owned_frames,array[]::text[])) with ordinality as owned(frame,ord)
  where frame in ('standard','ruby','amethyst','royal','astral')
  order by ord
)
where owned_frames is null
   or cardinality(owned_frames)=0
   or not ('standard'=any(owned_frames))
   or exists(select 1 from unnest(owned_frames) as owned(frame) where frame not in ('standard','ruby','amethyst','royal','astral'));
update public.profiles set owned_frames=array_prepend('standard',owned_frames)
where not ('standard'=any(owned_frames));

alter table public.profiles drop constraint if exists profiles_active_frame_check;
alter table public.profiles drop constraint if exists profiles_active_frame_qqcross_check;
alter table public.profiles add constraint profiles_active_frame_qqcross_check
  check (active_frame in ('standard','ruby','amethyst','royal','astral'));
alter table public.profiles drop constraint if exists profiles_active_title_qqcross_check;
alter table public.profiles add constraint profiles_active_title_qqcross_check
  check (char_length(active_title)>=1 and char_length(active_title)<=64);
alter table public.profiles drop constraint if exists profiles_avatar_url_qqcross_check;
alter table public.profiles add constraint profiles_avatar_url_qqcross_check
  check (avatar_url is null or avatar_url ~ '^https://lzpkronttfzbubbfggsb\.supabase\.co/storage/v1/object/public/avatars/[A-Za-z0-9_/-]+\.webp$');
alter table public.profiles drop constraint if exists profiles_owned_frames_qqcross_check;
alter table public.profiles add constraint profiles_owned_frames_qqcross_check
  check (owned_frames @> array['standard']::text[]
    and owned_frames <@ array['standard','ruby','amethyst','royal','astral']::text[]);

create or replace function private.equip_qqcross_frame(target_frame_id text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if target_frame_id not in ('standard','ruby','amethyst','royal','astral') then
    raise exception 'Неизвестная рамка';
  end if;
  select * into v_profile from public.profiles where id=v_uid for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if not target_frame_id=any(v_profile.owned_frames) then
    raise exception 'Эта рамка ещё не куплена';
  end if;
  update public.profiles set active_frame=target_frame_id where id=v_uid returning * into v_profile;
  return jsonb_build_object('ok',true,'coins',v_profile.coins,
    'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
end;
$function$;

create or replace function private.purchase_qqcross_frame(target_frame_id text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_price integer;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Необходимо войти в аккаунт'; end if;
  v_price := case target_frame_id when 'ruby' then 160 when 'amethyst' then 260
    when 'royal' then 420 when 'astral' then 620 else null end;
  if v_price is null then raise exception 'Неизвестная рамка'; end if;
  select * into v_profile from public.profiles where id=v_uid for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if target_frame_id=any(v_profile.owned_frames) then
    return jsonb_build_object('ok',true,'already_owned',true,'coins',v_profile.coins,
      'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
  end if;
  if v_profile.coins < v_price then raise exception 'Недостаточно монет'; end if;
  update public.profiles
    set coins=coins-v_price, owned_frames=array_append(owned_frames,target_frame_id), active_frame=target_frame_id
    where id=v_uid returning * into v_profile;
  return jsonb_build_object('ok',true,'already_owned',false,'coins',v_profile.coins,
    'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
end;
$function$;

create or replace function private.get_qqcross_player_profile(target_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if target_user_id is null then raise exception 'Игрок не найден'; end if;
  select jsonb_build_object(
    'id',p.id,'username',p.username,'avatar',p.avatar,'avatar_url',p.avatar_url,
    'active_frame',p.active_frame,'active_title',p.active_title,
    'wins',p.wins,'games',p.games,'points',p.points,
    'coins',case when p.id=auth.uid() then p.coins else null end,
    'owned_frames',case when p.id=auth.uid() then to_jsonb(p.owned_frames) else '[]'::jsonb end,
    'stats',coalesce(progress.progress->'stats','{}'::jsonb),
    'daily',jsonb_build_object(
      'currentStreak',coalesce(progress.progress#>'{daily,currentStreak}','0'::jsonb),
      'bestStreak',coalesce(progress.progress#>'{daily,bestStreak}','0'::jsonb)),
    'created_at',p.created_at)
  into v_result
  from public.profiles p
  left join public.qqcross_player_progress progress on progress.user_id=p.id
  where p.id=target_user_id;
  if v_result is null then raise exception 'Игрок не найден'; end if;
  return v_result;
end;
$function$;

create or replace function public.equip_qqcross_frame(target_frame_id text)
returns jsonb language sql set search_path=''
as $function$ select private.equip_qqcross_frame($1) $function$;
create or replace function public.purchase_qqcross_frame(target_frame_id text)
returns jsonb language sql set search_path=''
as $function$ select private.purchase_qqcross_frame($1) $function$;
create or replace function public.get_qqcross_player_profile(target_user_id uuid)
returns jsonb language sql stable set search_path=''
as $function$ select private.get_qqcross_player_profile($1) $function$;

revoke all on function private.equip_qqcross_frame(text) from public,anon;
revoke all on function private.purchase_qqcross_frame(text) from public,anon;
revoke all on function private.get_qqcross_player_profile(uuid) from public,anon;
grant execute on function private.equip_qqcross_frame(text) to authenticated;
grant execute on function private.purchase_qqcross_frame(text) to authenticated;
grant execute on function private.get_qqcross_player_profile(uuid) to authenticated;
revoke all on function public.equip_qqcross_frame(text) from public,anon;
revoke all on function public.purchase_qqcross_frame(text) from public,anon;
revoke all on function public.get_qqcross_player_profile(uuid) from public,anon;
grant execute on function public.equip_qqcross_frame(text) to authenticated;
grant execute on function public.purchase_qqcross_frame(text) to authenticated;
grant execute on function public.get_qqcross_player_profile(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,8388608,array['image/webp'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/webp'];

drop policy if exists "QQCross avatar upload owner folder" on storage.objects;
create policy "QQCross avatar upload owner folder" on storage.objects
for insert to authenticated with check (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "QQCross avatar delete owner folder" on storage.objects;
create policy "QQCross avatar delete owner folder" on storage.objects
for delete to authenticated using (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
;
update public.profiles
set owned_frames=array(
  select frame from unnest(coalesce(owned_frames,array[]::text[])) with ordinality as owned(frame,position)
  where frame in ('standard','ruby','amethyst','royal','astral')
  order by position
)
where owned_frames is null
   or cardinality(owned_frames)=0
   or not ('standard'=any(owned_frames))
   or exists(select 1 from unnest(owned_frames) as owned(frame) where frame not in ('standard','ruby','amethyst','royal','astral'));
update public.profiles set owned_frames=array_prepend('standard',owned_frames)
where not ('standard'=any(owned_frames));

alter table public.profiles drop constraint if exists profiles_active_frame_check;
alter table public.profiles drop constraint if exists profiles_active_frame_qqcross_check;
alter table public.profiles add constraint profiles_active_frame_qqcross_check
  check (active_frame in ('standard','ruby','amethyst','royal','astral'));
alter table public.profiles drop constraint if exists profiles_active_title_qqcross_check;
alter table public.profiles add constraint profiles_active_title_qqcross_check
  check (char_length(active_title)>=1 and char_length(active_title)<=64);
alter table public.profiles drop constraint if exists profiles_avatar_url_qqcross_check;
alter table public.profiles add constraint profiles_avatar_url_qqcross_check
  check (avatar_url is null or avatar_url ~ '^https://lzpkronttfzbubbfggsb\.supabase\.co/storage/v1/object/public/avatars/[A-Za-z0-9_/-]+\.webp

create or replace function private.equip_qqcross_frame(target_frame_id text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if target_frame_id not in ('standard','ruby','amethyst','royal','astral') then
    raise exception 'Неизвестная рамка';
  end if;
  select * into v_profile from public.profiles where id=v_uid for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if not target_frame_id=any(v_profile.owned_frames) then
    raise exception 'Эта рамка ещё не куплена';
  end if;
  update public.profiles set active_frame=target_frame_id where id=v_uid returning * into v_profile;
  return jsonb_build_object('ok',true,'coins',v_profile.coins,
    'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
end;
$function$;

create or replace function private.purchase_qqcross_frame(target_frame_id text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_price integer;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Необходимо войти в аккаунт'; end if;
  v_price := case target_frame_id when 'ruby' then 160 when 'amethyst' then 260
    when 'royal' then 420 when 'astral' then 620 else null end;
  if v_price is null then raise exception 'Неизвестная рамка'; end if;
  select * into v_profile from public.profiles where id=v_uid for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if target_frame_id=any(v_profile.owned_frames) then
    return jsonb_build_object('ok',true,'already_owned',true,'coins',v_profile.coins,
      'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
  end if;
  if v_profile.coins < v_price then raise exception 'Недостаточно монет'; end if;
  update public.profiles
    set coins=coins-v_price, owned_frames=array_append(owned_frames,target_frame_id), active_frame=target_frame_id
    where id=v_uid returning * into v_profile;
  return jsonb_build_object('ok',true,'already_owned',false,'coins',v_profile.coins,
    'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
end;
$function$;

create or replace function private.get_qqcross_player_profile(target_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if target_user_id is null then raise exception 'Игрок не найден'; end if;
  select jsonb_build_object(
    'id',p.id,'username',p.username,'avatar',p.avatar,'avatar_url',p.avatar_url,
    'active_frame',p.active_frame,'active_title',p.active_title,
    'wins',p.wins,'games',p.games,'points',p.points,
    'coins',case when p.id=auth.uid() then p.coins else null end,
    'owned_frames',case when p.id=auth.uid() then to_jsonb(p.owned_frames) else '[]'::jsonb end,
    'stats',coalesce(progress.progress->'stats','{}'::jsonb),
    'daily',jsonb_build_object(
      'currentStreak',coalesce(progress.progress#>'{daily,currentStreak}','0'::jsonb),
      'bestStreak',coalesce(progress.progress#>'{daily,bestStreak}','0'::jsonb)),
    'created_at',p.created_at)
  into v_result
  from public.profiles p
  left join public.qqcross_player_progress progress on progress.user_id=p.id
  where p.id=target_user_id;
  if v_result is null then raise exception 'Игрок не найден'; end if;
  return v_result;
end;
$function$;

create or replace function public.equip_qqcross_frame(target_frame_id text)
returns jsonb language sql set search_path=''
as $function$ select private.equip_qqcross_frame($1) $function$;
create or replace function public.purchase_qqcross_frame(target_frame_id text)
returns jsonb language sql set search_path=''
as $function$ select private.purchase_qqcross_frame($1) $function$;
create or replace function public.get_qqcross_player_profile(target_user_id uuid)
returns jsonb language sql stable set search_path=''
as $function$ select private.get_qqcross_player_profile($1) $function$;

revoke all on function private.equip_qqcross_frame(text) from public,anon;
revoke all on function private.purchase_qqcross_frame(text) from public,anon;
revoke all on function private.get_qqcross_player_profile(uuid) from public,anon;
grant execute on function private.equip_qqcross_frame(text) to authenticated;
grant execute on function private.purchase_qqcross_frame(text) to authenticated;
grant execute on function private.get_qqcross_player_profile(uuid) to authenticated;
revoke all on function public.equip_qqcross_frame(text) from public,anon;
revoke all on function public.purchase_qqcross_frame(text) from public,anon;
revoke all on function public.get_qqcross_player_profile(uuid) from public,anon;
grant execute on function public.equip_qqcross_frame(text) to authenticated;
grant execute on function public.purchase_qqcross_frame(text) to authenticated;
grant execute on function public.get_qqcross_player_profile(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,8388608,array['image/webp'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/webp'];

drop policy if exists "QQCross avatar upload owner folder" on storage.objects;
create policy "QQCross avatar upload owner folder" on storage.objects
for insert to authenticated with check (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "QQCross avatar delete owner folder" on storage.objects;
create policy "QQCross avatar delete owner folder" on storage.objects
for delete to authenticated using (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
);
alter table public.profiles drop constraint if exists profiles_owned_frames_qqcross_check;
alter table public.profiles add constraint profiles_owned_frames_qqcross_check
  check (owned_frames @> array['standard']::text[]
    and owned_frames <@ array['standard','ruby','amethyst','royal','astral']::text[]);

create or replace function private.equip_qqcross_frame(target_frame_id text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if target_frame_id not in ('standard','ruby','amethyst','royal','astral') then
    raise exception 'Неизвестная рамка';
  end if;
  select * into v_profile from public.profiles where id=v_uid for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if not target_frame_id=any(v_profile.owned_frames) then
    raise exception 'Эта рамка ещё не куплена';
  end if;
  update public.profiles set active_frame=target_frame_id where id=v_uid returning * into v_profile;
  return jsonb_build_object('ok',true,'coins',v_profile.coins,
    'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
end;
$function$;

create or replace function private.purchase_qqcross_frame(target_frame_id text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid := auth.uid();
  v_price integer;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Необходимо войти в аккаунт'; end if;
  v_price := case target_frame_id when 'ruby' then 160 when 'amethyst' then 260
    when 'royal' then 420 when 'astral' then 620 else null end;
  if v_price is null then raise exception 'Неизвестная рамка'; end if;
  select * into v_profile from public.profiles where id=v_uid for update;
  if not found then raise exception 'Профиль не найден'; end if;
  if target_frame_id=any(v_profile.owned_frames) then
    return jsonb_build_object('ok',true,'already_owned',true,'coins',v_profile.coins,
      'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
  end if;
  if v_profile.coins < v_price then raise exception 'Недостаточно монет'; end if;
  update public.profiles
    set coins=coins-v_price, owned_frames=array_append(owned_frames,target_frame_id), active_frame=target_frame_id
    where id=v_uid returning * into v_profile;
  return jsonb_build_object('ok',true,'already_owned',false,'coins',v_profile.coins,
    'owned_frames',to_jsonb(v_profile.owned_frames),'active_frame',v_profile.active_frame);
end;
$function$;

create or replace function private.get_qqcross_player_profile(target_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Необходимо войти в аккаунт'; end if;
  if target_user_id is null then raise exception 'Игрок не найден'; end if;
  select jsonb_build_object(
    'id',p.id,'username',p.username,'avatar',p.avatar,'avatar_url',p.avatar_url,
    'active_frame',p.active_frame,'active_title',p.active_title,
    'wins',p.wins,'games',p.games,'points',p.points,
    'coins',case when p.id=auth.uid() then p.coins else null end,
    'owned_frames',case when p.id=auth.uid() then to_jsonb(p.owned_frames) else '[]'::jsonb end,
    'stats',coalesce(progress.progress->'stats','{}'::jsonb),
    'daily',jsonb_build_object(
      'currentStreak',coalesce(progress.progress#>'{daily,currentStreak}','0'::jsonb),
      'bestStreak',coalesce(progress.progress#>'{daily,bestStreak}','0'::jsonb)),
    'created_at',p.created_at)
  into v_result
  from public.profiles p
  left join public.qqcross_player_progress progress on progress.user_id=p.id
  where p.id=target_user_id;
  if v_result is null then raise exception 'Игрок не найден'; end if;
  return v_result;
end;
$function$;

create or replace function public.equip_qqcross_frame(target_frame_id text)
returns jsonb language sql set search_path=''
as $function$ select private.equip_qqcross_frame($1) $function$;
create or replace function public.purchase_qqcross_frame(target_frame_id text)
returns jsonb language sql set search_path=''
as $function$ select private.purchase_qqcross_frame($1) $function$;
create or replace function public.get_qqcross_player_profile(target_user_id uuid)
returns jsonb language sql stable set search_path=''
as $function$ select private.get_qqcross_player_profile($1) $function$;

revoke all on function private.equip_qqcross_frame(text) from public,anon;
revoke all on function private.purchase_qqcross_frame(text) from public,anon;
revoke all on function private.get_qqcross_player_profile(uuid) from public,anon;
grant execute on function private.equip_qqcross_frame(text) to authenticated;
grant execute on function private.purchase_qqcross_frame(text) to authenticated;
grant execute on function private.get_qqcross_player_profile(uuid) to authenticated;
revoke all on function public.equip_qqcross_frame(text) from public,anon;
revoke all on function public.purchase_qqcross_frame(text) from public,anon;
revoke all on function public.get_qqcross_player_profile(uuid) from public,anon;
grant execute on function public.equip_qqcross_frame(text) to authenticated;
grant execute on function public.purchase_qqcross_frame(text) to authenticated;
grant execute on function public.get_qqcross_player_profile(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,8388608,array['image/webp'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/webp'];

drop policy if exists "QQCross avatar upload owner folder" on storage.objects;
create policy "QQCross avatar upload owner folder" on storage.objects
for insert to authenticated with check (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "QQCross avatar delete owner folder" on storage.objects;
create policy "QQCross avatar delete owner folder" on storage.objects
for delete to authenticated using (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
