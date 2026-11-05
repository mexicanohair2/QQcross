-- QQcross: расширяем выбор аватаров до 102 флагов.
-- Существующие пользователи сохраняют выбранный индекс.

alter table public.profiles
  drop constraint if exists profiles_avatar_check;

alter table public.profiles
  add constraint profiles_avatar_check check (avatar between 0 and 101);

create or replace function public.create_qqcross_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted_name text;
  avatar_text text;
  wanted_avatar integer := 0;
begin
  wanted_name := new.raw_user_meta_data ->> 'username';
  avatar_text := new.raw_user_meta_data ->> 'avatar';

  if wanted_name is null
     or wanted_name !~ '^[A-Za-z0-9_]{3,16}$'
     or exists (
       select 1 from public.profiles p
       where p.username_lower = lower(wanted_name)
     ) then
    wanted_name := 'player_' || left(replace(new.id::text, '-', ''), 8);
  end if;

  if avatar_text ~ '^[0-9]{1,3}$' then
    wanted_avatar := least(avatar_text::integer, 101);
  end if;

  insert into public.profiles (id, username, avatar)
  values (new.id, wanted_name, wanted_avatar);

  insert into public.inventory (user_id, item_type, quantity)
  values
    (new.id, 'magnifier', 5),
    (new.id, 'clock', 5),
    (new.id, 'trash', 5)
  on conflict (user_id, item_type) do nothing;

  return new;
end;
$$;
