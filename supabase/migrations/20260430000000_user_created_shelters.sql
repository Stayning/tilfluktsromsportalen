-- Migration: User-created shelters
-- Adds created_by column, auto-membership trigger, immutability trigger,
-- and replaces the admin FOR ALL policy with split policies.

-- ============================================================
-- SCHEMA CHANGE
-- ============================================================

ALTER TABLE public.tilfluktsrom
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-grant membership to the shelter creator on INSERT.
CREATE OR REPLACE FUNCTION public.handle_new_shelter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip when admins insert legacy-style rows with no creator
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotent: if creator is already a member, do nothing
  INSERT INTO public.tilfluktsrom_members (shelter_id, user_id, invited_by, is_active)
  VALUES (NEW.id, NEW.created_by, NEW.created_by, true)
  ON CONFLICT (shelter_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Prevent non-admins from changing created_by after insert (defense in depth).
CREATE OR REPLACE FUNCTION public.protect_shelter_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by AND NOT public.is_admin() THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_shelter_created ON public.tilfluktsrom;
CREATE TRIGGER on_shelter_created
  AFTER INSERT ON public.tilfluktsrom
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_shelter();

DROP TRIGGER IF EXISTS tilfluktsrom_protect_created_by ON public.tilfluktsrom;
CREATE TRIGGER tilfluktsrom_protect_created_by
  BEFORE UPDATE ON public.tilfluktsrom
  FOR EACH ROW EXECUTE FUNCTION public.protect_shelter_created_by();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Drop the old FOR ALL admin policy (covered the INSERT/UPDATE/DELETE we now split)
DROP POLICY IF EXISTS "Admins can manage shelters" ON public.tilfluktsrom;

-- SELECT: explicit admin policy (replaces the FOR ALL policy's implicit SELECT coverage)
CREATE POLICY "Admins can view all shelters"
  ON public.tilfluktsrom FOR SELECT
  TO authenticated
  USING (is_admin());

-- INSERT: any authenticated user, but must set themselves as creator (admins may omit)
CREATE POLICY "Authenticated users can create shelters"
  ON public.tilfluktsrom FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR is_admin());

-- UPDATE: admins OR the creator
CREATE POLICY "Creators and admins can update shelters"
  ON public.tilfluktsrom FOR UPDATE
  TO authenticated
  USING (is_admin() OR created_by = auth.uid())
  WITH CHECK (is_admin() OR created_by = auth.uid());

-- DELETE: admins only (creators cannot delete)
CREATE POLICY "Admins can delete shelters"
  ON public.tilfluktsrom FOR DELETE
  TO authenticated
  USING (is_admin());
