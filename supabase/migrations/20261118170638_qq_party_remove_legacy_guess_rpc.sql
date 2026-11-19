
drop function if exists public.qq_party_team_guess(uuid,text,jsonb);
alter function public.qq_party_score_guess(text,text) set search_path=public,pg_temp;
revoke all on function public.qq_party_score_guess(text,text) from public,anon,authenticated;
