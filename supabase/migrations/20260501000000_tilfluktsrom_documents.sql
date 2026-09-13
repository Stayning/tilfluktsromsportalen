-- ============================================================
-- ENUM + TABLE
-- ============================================================

create type document_type as enum (
  'drifts_og_klargjoringsinstruks',
  'betjeningsinstruks_ventilasjon'
);

create table if not exists tilfluktsrom_documents (
  id              uuid primary key default gen_random_uuid(),
  tilfluktsrom_id text not null references tilfluktsrom(id) on delete cascade,
  document_type   document_type not null,
  file_path       text not null,
  file_name       text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists tilfluktsrom_documents_shelter_idx
  on tilfluktsrom_documents (tilfluktsrom_id);

alter table tilfluktsrom_documents enable row level security;

-- ============================================================
-- BUCKET (idempotent + server-side guardrails)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tilfluktsrom-documents',
  'tilfluktsrom-documents',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do nothing;

-- ============================================================
-- ROW POLICIES (split per-action)
-- ============================================================

drop policy if exists "documents_select" on tilfluktsrom_documents;
create policy "documents_select" on tilfluktsrom_documents
  for select to authenticated
  using (is_admin() or is_member(tilfluktsrom_id));
-- Creators are auto-added as members by on_shelter_created, so is_member covers them.

drop policy if exists "documents_insert" on tilfluktsrom_documents;
create policy "documents_insert" on tilfluktsrom_documents
  for insert to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from tilfluktsrom t
      where t.id = tilfluktsrom_documents.tilfluktsrom_id
        and t.created_by = auth.uid()
    )
  );

drop policy if exists "documents_update" on tilfluktsrom_documents;
create policy "documents_update" on tilfluktsrom_documents
  for update to authenticated
  using (
    is_admin()
    or exists (
      select 1 from tilfluktsrom t
      where t.id = tilfluktsrom_documents.tilfluktsrom_id
        and t.created_by = auth.uid()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from tilfluktsrom t
      where t.id = tilfluktsrom_documents.tilfluktsrom_id
        and t.created_by = auth.uid()
    )
  );

drop policy if exists "documents_delete" on tilfluktsrom_documents;
create policy "documents_delete" on tilfluktsrom_documents
  for delete to authenticated
  using (
    is_admin()
    or exists (
      select 1 from tilfluktsrom t
      where t.id = tilfluktsrom_documents.tilfluktsrom_id
        and t.created_by = auth.uid()
    )
  );

-- ============================================================
-- STORAGE POLICIES (mirror — admin OR creator for write, members for read)
-- ============================================================

drop policy if exists "doc_storage_select" on storage.objects;
create policy "doc_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tilfluktsrom-documents'
    and (is_admin() or is_member((storage.foldername(name))[1]))
  );

drop policy if exists "doc_storage_insert" on storage.objects;
create policy "doc_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tilfluktsrom-documents'
    and (
      is_admin()
      or exists (
        select 1 from tilfluktsrom t
        where t.id = (storage.foldername(name))[1]
          and t.created_by = auth.uid()
      )
    )
  );

drop policy if exists "doc_storage_update" on storage.objects;
create policy "doc_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tilfluktsrom-documents'
    and (
      is_admin()
      or exists (
        select 1 from tilfluktsrom t
        where t.id = (storage.foldername(name))[1]
          and t.created_by = auth.uid()
      )
    )
  )
  with check (
    bucket_id = 'tilfluktsrom-documents'
    and (
      is_admin()
      or exists (
        select 1 from tilfluktsrom t
        where t.id = (storage.foldername(name))[1]
          and t.created_by = auth.uid()
      )
    )
  );

drop policy if exists "doc_storage_delete" on storage.objects;
create policy "doc_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tilfluktsrom-documents'
    and (
      is_admin()
      or exists (
        select 1 from tilfluktsrom t
        where t.id = (storage.foldername(name))[1]
          and t.created_by = auth.uid()
      )
    )
  );
