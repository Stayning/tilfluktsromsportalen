update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = null
where id = 'tilfluktsrom-documents';

create or replace function enforce_shelter_documents_cap()
returns trigger language plpgsql as $$
begin
  if (
    select count(*) from tilfluktsrom_documents
    where tilfluktsrom_id = NEW.tilfluktsrom_id
  ) >= 40 then
    raise exception 'Maks 40 dokumenter per tilfluktsrom'
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

drop trigger if exists tilfluktsrom_documents_cap on tilfluktsrom_documents;
create trigger tilfluktsrom_documents_cap
before insert on tilfluktsrom_documents
for each row execute function enforce_shelter_documents_cap();
