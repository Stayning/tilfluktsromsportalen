-- is_admin() was missing from migrations (used in policies but never defined).
-- Must be SECURITY DEFINER so it bypasses RLS when querying app_admins,
-- preventing infinite recursion chains through profiles.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins
    WHERE user_id = auth.uid()
  );
$$;
