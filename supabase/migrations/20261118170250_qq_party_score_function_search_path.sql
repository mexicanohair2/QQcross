create or replace function public.qq_party_score_guess(p_guess text,p_target text)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare
  v_g text[]:=regexp_split_to_array(lower(replace(p_guess,'ё','е')),'');
  v_t text[]:=regexp_split_to_array(lower(replace(p_target,'ё','е')),'');
  v_result text[]; v_remaining jsonb:='{}'::jsonb; v_i int; v_n int; v_c text; v_left int;
begin
  v_n:=cardinality(v_t);
  if cardinality(v_g)<>v_n then raise exception 'INVALID_WORD_LENGTH'; end if;
  v_result:=array_fill('miss'::text,array[v_n]);
  for v_i in 1..v_n loop
    if v_g[v_i]=v_t[v_i] then v_result[v_i]:='green';
    else v_c:=v_t[v_i]; v_remaining:=jsonb_set(v_remaining,array[v_c],to_jsonb(coalesce((v_remaining->>v_c)::int,0)+1),true); end if;
  end loop;
  for v_i in 1..v_n loop
    if v_result[v_i]<>'green' then
      v_c:=v_g[v_i]; v_left:=coalesce((v_remaining->>v_c)::int,0);
      if v_left>0 then v_result[v_i]:='yellow'; v_remaining:=jsonb_set(v_remaining,array[v_c],to_jsonb(v_left-1),true); end if;
    end if;
  end loop;
  return to_jsonb(v_result);
end $$;
revoke all on function public.qq_party_score_guess(text,text) from public,anon,authenticated;