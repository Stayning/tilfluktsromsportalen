-- Follow-up to 20260501000000_tilfluktsrom_documents.
--
-- 1. Default uploaded_by to auth.uid() and enforce it on insert so the uploader
--    column cannot be spoofed and existing client code (which omits the column)
--    records the correct user.
-- 2. Extend the select policies (table + storage) so a shelter creator whose
--    membership has is_active=false can still list and open their own documents,
--    matching the creator branch already present in the write policies.

-- ============================================================
-- 1. uploaded_by: server-side default + spoof-proof insert policy
-- ============================================================

alter table tilfluktsrom_documents
  alter column uploaded_by set default auth.uid();

drop policy if exists "documents_insert" on tilfluktsrom_documents;
create policy "documents_insert" on tilfluktsrom_documents
  for insert to authenticated
  with check (
    (uploaded_by = auth.uid() or is_admin())
    and (
      is_admin()
      or exists (
        select 1 from tilfluktsrom t
        where t.id = tilfluktsrom_documents.tilfluktsrom_id
          and t.created_by = auth.uid()
      )
    )
  );

-- ============================================================
-- 2. Select policies: add creator branch (parallel to write policies)
-- ============================================================

drop policy if exists "documents_select" on tilfluktsrom_documents;
create policy "documents_select" on tilfluktsrom_documents
  for select to authenticated
  using (
    is_admin()
    or is_member(tilfluktsrom_id)
    or exists (
      select 1 from tilfluktsrom t
      where t.id = tilfluktsrom_documents.tilfluktsrom_id
        and t.created_by = auth.uid()
    )
  );

drop policy if exists "doc_storage_select" on storage.objects;
create policy "doc_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tilfluktsrom-documents'
    and (
      is_admin()
      or is_member((storage.foldername(name))[1])
      or exists (
        select 1 from tilfluktsrom t
        where t.id = (storage.foldername(name))[1]
          and t.created_by = auth.uid()
      )
    )
  );
