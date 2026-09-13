-- Fix infinite recursion in tilfluktsrom_members SELECT policy.
-- The old policy queried tilfluktsrom_members from within itself.
-- Replace with is_member() which is SECURITY DEFINER and bypasses RLS.

DROP POLICY IF EXISTS "Members can view same-shelter members" ON public.tilfluktsrom_members;

CREATE POLICY "Members can view same-shelter members"
  ON public.tilfluktsrom_members FOR SELECT
  TO authenticated
  USING (is_member(shelter_id));
