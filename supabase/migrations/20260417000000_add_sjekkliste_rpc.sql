-- RPC function to fetch sjekkliste (checklist) items for a given forskrift year.
-- Returns flattened rows: group_id, group_title, item_id, item_title, forskrift_refs.
create or replace function public.get_sjekkliste(forskrift_year text)
returns table (
  group_id bigint,
  group_title text,
  item_id text,
  item_title text,
  forskrift_refs text[]
)
language plpgsql
security definer
stable
as $$
begin
  if forskrift_year = '1948' then
    return query
      select s.id, s.title,
             (item->>'id')::text,
             (item->>'title')::text,
             array(select jsonb_array_elements_text((item->'ref')::jsonb))
      from sjekkliste."1948" s,
           json_array_elements(s.items) as item
      order by s.id;
  elsif forskrift_year = '1966' then
    return query
      select s.id, s.title,
             (item->>'id')::text,
             (item->>'title')::text,
             array(select jsonb_array_elements_text((item->'ref')::jsonb))
      from sjekkliste."1966" s,
           json_array_elements(s.items) as item
      order by s.id;
  elsif forskrift_year = '1976' then
    return query
      select s.id, s.title,
             (item->>'id')::text,
             (item->>'title')::text,
             array(select jsonb_array_elements_text((item->'ref')::jsonb))
      from sjekkliste."1976" s,
           json_array_elements(s.items) as item
      order by s.id;
  elsif forskrift_year = '1995' then
    return query
      select s.id, s.title,
             (item->>'id')::text,
             (item->>'title')::text,
             array(select jsonb_array_elements_text((item->'ref')::jsonb))
      from sjekkliste."1995" s,
           json_array_elements(s.items) as item
      order by s.id;
  end if;
end;
$$;

-- RPC function to fetch forskrift content for given punkt references and year.
create or replace function public.get_forskrift_innhold(forskrift_year text, punkt_refs text[])
returns table (
  punkt text,
  innhold text
)
language plpgsql
security definer
stable
as $$
begin
  if forskrift_year = '1948' then
    return query select f.punkt, f.innhold from forskriftmv."1948" f where f.punkt = any(punkt_refs);
  elsif forskrift_year = '1966' then
    return query select f.punkt, f.innhold from forskriftmv."1966" f where f.punkt = any(punkt_refs);
  elsif forskrift_year = '1976' then
    return query select f.punkt, f.innhold from forskriftmv."1976" f where f.punkt = any(punkt_refs);
  elsif forskrift_year = '1995' then
    return query select f.punkt, f.innhold from forskriftmv."1995" f where f.punkt = any(punkt_refs);
  end if;
end;
$$;
