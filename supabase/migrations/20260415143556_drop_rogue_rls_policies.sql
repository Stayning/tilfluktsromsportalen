-- Drop rogue/legacy RLS policies that grant unrestricted access.
-- These wide-open policies (qual = true) bypass the proper is_admin()/is_member()
-- checks defined in 20260401000000_access_control.sql, allowing any authenticated
-- (or even anonymous) user to read/write all data.

-- ============================================================
-- public.tilfluktsrom — the reported bug: new users see all shelters
-- Proper policies: "Admins can manage shelters", "Members can view their shelters"
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users"              ON public.tilfluktsrom;
DROP POLICY IF EXISTS "Authenticated users can view tilfluktsrom"     ON public.tilfluktsrom;
DROP POLICY IF EXISTS "Authenticated users can update tilfluktsrom"   ON public.tilfluktsrom;
DROP POLICY IF EXISTS "Allow authenticated users to delete tilfluktsrom" ON public.tilfluktsrom;
DROP POLICY IF EXISTS "Enable insert for authenticated users only"    ON public.tilfluktsrom;

-- ============================================================
-- public.vurdering — condition assessments
-- Proper policies: "Admins can manage vurderinger", "Members can view vurderinger for their shelters"
-- ============================================================
DROP POLICY IF EXISTS "Enable read for authenticated users"           ON public.vurdering;
DROP POLICY IF EXISTS "Enable update for authenticated users"         ON public.vurdering;
DROP POLICY IF EXISTS "Enable delete for authenticated users"         ON public.vurdering;
DROP POLICY IF EXISTS "Enable insert for authenticated users only"    ON public.vurdering;
DROP POLICY IF EXISTS "Enable insert for authenticated users"         ON public.vurdering;

-- ============================================================
-- public.avvik — deviations
-- Proper policies: "Admins can manage avvik", "Members can view avvik for their shelters"
-- ============================================================
DROP POLICY IF EXISTS "Enable all for development public.avvik"       ON public.avvik;

-- ============================================================
-- public.kunde — customers
-- Proper policy: "Admins can manage kunder"
-- ============================================================
DROP POLICY IF EXISTS "Enable read access for all users"              ON public.kunde;

-- ============================================================
-- public.profiles — legacy policies targeting {public} role
-- Proper policies from access_control.sql target {authenticated} role
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert profiles"                    ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles"                ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles"                    ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"                  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"                  ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"                    ON public.profiles;

-- ============================================================
-- public.kontaktpersoner + junction tables — no proper policies existed
-- Drop wide-open policies and add admin + member-based access
-- ============================================================
DROP POLICY IF EXISTS "Allow authenticated full access to kontaktpersoner"            ON public.kontaktpersoner;
DROP POLICY IF EXISTS "Allow authenticated full access to kontaktperson_kunde"        ON public.kontaktperson_kunde;
DROP POLICY IF EXISTS "Allow authenticated full access to kontaktperson_tilfluktsrom" ON public.kontaktperson_tilfluktsrom;

-- kontaktpersoner: admins can manage, members can view contacts linked to their shelters
CREATE POLICY "Admins can manage kontaktpersoner"
  ON public.kontaktpersoner FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Members can view kontaktpersoner for their shelters"
  ON public.kontaktpersoner FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kontaktperson_tilfluktsrom kt
      WHERE kt.kontaktperson_id = kontaktpersoner.id
        AND is_member(kt.tilfluktsrom_id)
    )
  );

-- kontaktperson_kunde: admins can manage, members can view for their shelters
CREATE POLICY "Admins can manage kontaktperson_kunde"
  ON public.kontaktperson_kunde FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Members can view kontaktperson_kunde"
  ON public.kontaktperson_kunde FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.kontaktperson_tilfluktsrom kt
      WHERE kt.kontaktperson_id = kontaktperson_kunde.kontaktperson_id
        AND is_member(kt.tilfluktsrom_id)
    )
  );

-- kontaktperson_tilfluktsrom: admins can manage, members can view their shelter links
CREATE POLICY "Admins can manage kontaktperson_tilfluktsrom"
  ON public.kontaktperson_tilfluktsrom FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Members can view kontaktperson_tilfluktsrom"
  ON public.kontaktperson_tilfluktsrom FOR SELECT
  TO authenticated
  USING (is_member(tilfluktsrom_id));

-- ============================================================
-- Other tables with wide-open dev policies (not core shelter app tables,
-- but still a security risk). Drop the rogue policies and add admin-only access.
-- ============================================================
DROP POLICY IF EXISTS "Enable all for development public.notater"          ON public.notater;
DROP POLICY IF EXISTS "Enable all for development public.observasjoner"    ON public.observasjoner;
DROP POLICY IF EXISTS "Enable all for development public.tilstand"         ON public.tilstand;
DROP POLICY IF EXISTS "Enable read access for authenticated users"         ON public.komponent;
DROP POLICY IF EXISTS "Enable update access for authenticated users"       ON public.komponent;
DROP POLICY IF EXISTS "Enable insert access for authenticated users"       ON public.komponent;
DROP POLICY IF EXISTS "Enable delete access for authenticated users"       ON public.komponent;
DROP POLICY IF EXISTS "Enable write access for authenticated users"        ON public.produkt;
DROP POLICY IF EXISTS "Enable read access for authenticated users"         ON public.produkt;
DROP POLICY IF EXISTS "Enable all operations for authenticated users on tilbud_produkt" ON public.tilbud_produkter;

-- Add admin-only policies for these tables so they remain accessible to admins
DO $$ BEGIN
  CREATE POLICY "Admins can manage notater"
    ON public.notater FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage observasjoner"
    ON public.observasjoner FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage tilstand"
    ON public.tilstand FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage komponent"
    ON public.komponent FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage produkt"
    ON public.produkt FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can manage tilbud_produkter"
    ON public.tilbud_produkter FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
