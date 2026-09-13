-- Restore the missing UPDATE policy on public.profiles.
-- The legacy `{public}` policy was dropped by 20260415143556_drop_rogue_rls_policies.sql,
-- but the proper `{authenticated}` policy in 20260401000000_access_control.sql had been
-- silently skipped (EXCEPTION WHEN duplicate_object) because the legacy one existed at
-- that time. Result: no UPDATE policy on profiles, breaking onboarding upsert with
-- "new row violates row-level security policy (USING expression) for table profiles".

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
