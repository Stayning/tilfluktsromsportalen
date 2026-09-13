-- Fix: grant creators explicit SELECT on their own shelter.
-- Without this, the INSERT ... .select().single() in useCreateShelter could
-- fail RLS on the returned row because the auto-membership trigger (AFTER INSERT)
-- may not yet be visible to the SELECT check that PostgREST performs when
-- returning the representation. created_by = auth.uid() makes the row
-- immediately selectable by the creator regardless of trigger timing.
CREATE POLICY "Creators can view their own shelters"
  ON public.tilfluktsrom FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
