-- Migration: Access Control
-- Adds app_admins, tilfluktsrom_members, tilfluktsrom_invites tables,
-- extends profiles, creates helper functions, triggers, RLS policies, and indexes.

-- ============================================================
-- TABLES
-- ============================================================

-- Global system administrators
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id   uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Viral access control: tracks which users have access to which shelters
CREATE TABLE IF NOT EXISTS public.tilfluktsrom_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id text NOT NULL REFERENCES public.tilfluktsrom(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES public.profiles(id),
  is_active  boolean NOT NULL DEFAULT true,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shelter_id, user_id)
);

-- Pending phone-based invitations (resolved when invitee completes onboarding)
CREATE TABLE IF NOT EXISTS public.tilfluktsrom_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id   text NOT NULL REFERENCES public.tilfluktsrom(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  invited_by   uuid REFERENCES public.profiles(id),
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shelter_id, phone_number)
);

-- ============================================================
-- PROFILE COLUMNS
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name     text,
  ADD COLUMN IF NOT EXISTS last_name      text,
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Check if current user has active membership in a shelter.
-- Parameter type is text to match tilfluktsrom.id type.
CREATE OR REPLACE FUNCTION public.is_member(shelter_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tilfluktsrom_members
    WHERE tilfluktsrom_members.shelter_id = $1
      AND tilfluktsrom_members.user_id    = auth.uid()
      AND tilfluktsrom_members.is_active  = true
  );
$$;

-- Auto-create a profile row when a new auth.users record is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, updated_at)
  VALUES (
    NEW.id,
    NEW.phone,
    NEW.raw_user_meta_data->>'full_name',
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$;

-- Generic updated_at setter — attach as a BEFORE UPDATE trigger.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- When a new invite is created, immediately grant membership if the invitee
-- has already completed onboarding (tos_accepted_at IS NOT NULL).
CREATE OR REPLACE FUNCTION public.handle_new_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE phone = NEW.phone_number
    AND tos_accepted_at IS NOT NULL
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    INSERT INTO public.tilfluktsrom_members (shelter_id, user_id, invited_by, is_active)
    VALUES (NEW.shelter_id, v_profile_id, NEW.invited_by, true)
    ON CONFLICT (shelter_id, user_id) DO UPDATE
      SET is_active = true;

    UPDATE public.tilfluktsrom_invites
    SET status = 'accepted'
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tilfluktsrom_updated_at ON public.tilfluktsrom;
CREATE TRIGGER tilfluktsrom_updated_at
  BEFORE UPDATE ON public.tilfluktsrom
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_invite_created ON public.tilfluktsrom_invites;
CREATE TRIGGER on_invite_created
  AFTER INSERT ON public.tilfluktsrom_invites
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_invite();

-- ============================================================
-- RLS — ENABLE
-- ============================================================

ALTER TABLE public.app_admins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tilfluktsrom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tilfluktsrom_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tilfluktsrom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vurdering    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avvik        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kunde        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS — POLICIES
-- ============================================================

-- profiles
DO $$ BEGIN
  CREATE POLICY "Profiles are viewable by owner"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Same shelter members can view profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.tilfluktsrom_members tm1
        JOIN public.tilfluktsrom_members tm2
          ON tm1.shelter_id = tm2.shelter_id
        WHERE tm1.user_id  = auth.uid()
          AND tm2.user_id  = profiles.id
          AND tm1.is_active = true
          AND tm2.is_active = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- app_admins
DO $$ BEGIN
  CREATE POLICY "Users can check own admin status"
    ON public.app_admins FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all admins"
    ON public.app_admins FOR SELECT
    TO authenticated
    USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tilfluktsrom
DO $$ BEGIN
  CREATE POLICY "Admins can manage shelters"
    ON public.tilfluktsrom FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view their shelters"
    ON public.tilfluktsrom FOR SELECT
    TO authenticated
    USING (is_member(id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tilfluktsrom_members
DO $$ BEGIN
  CREATE POLICY "Admins can manage members"
    ON public.tilfluktsrom_members FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view same-shelter members"
    ON public.tilfluktsrom_members FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.tilfluktsrom_members me
        WHERE me.shelter_id = tilfluktsrom_members.shelter_id
          AND me.user_id    = auth.uid()
          AND me.is_active  = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tilfluktsrom_invites
DO $$ BEGIN
  CREATE POLICY "Admins can manage invites"
    ON public.tilfluktsrom_invites FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view same-shelter invites"
    ON public.tilfluktsrom_invites FOR SELECT
    TO authenticated
    USING (is_member(shelter_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can create invites for their shelters"
    ON public.tilfluktsrom_invites FOR INSERT
    TO authenticated
    WITH CHECK (is_member(shelter_id) AND invited_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vurdering
DO $$ BEGIN
  CREATE POLICY "Admins can manage vurderinger"
    ON public.vurdering FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view vurderinger for their shelters"
    ON public.vurdering FOR SELECT
    TO authenticated
    USING (is_member(tilfluktsrom));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- avvik
DO $$ BEGIN
  CREATE POLICY "Admins can manage avvik"
    ON public.avvik FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view avvik for their shelters"
    ON public.avvik FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.vurdering v
        WHERE v.id = vurdering_id
          AND is_member(v.tilfluktsrom)
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- kunde
DO $$ BEGIN
  CREATE POLICY "Admins can manage kunder"
    ON public.kunde FOR ALL
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_invites_phone
  ON public.tilfluktsrom_invites(phone_number, status);
