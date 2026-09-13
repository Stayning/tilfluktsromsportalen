-- Fix infinite recursion on profiles.
-- "Same shelter members can view profiles" queried tilfluktsrom_members,
-- which triggered its own RLS chain back through profiles.
-- Solution: use a SECURITY DEFINER function that bypasses RLS entirely.

CREATE OR REPLACE FUNCTION public.shares_shelter_with(other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tilfluktsrom_members tm1
    JOIN public.tilfluktsrom_members tm2
      ON tm1.shelter_id = tm2.shelter_id
    WHERE tm1.user_id   = auth.uid()
      AND tm2.user_id   = other_user_id
      AND tm1.is_active = true
      AND tm2.is_active = true
  );
$$;

DROP POLICY IF EXISTS "Same shelter members can view profiles" ON public.profiles;

CREATE POLICY "Same shelter members can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (shares_shelter_with(id));
