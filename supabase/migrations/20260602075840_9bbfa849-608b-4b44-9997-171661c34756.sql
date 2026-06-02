-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('user','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.script_status AS ENUM ('working','patched','updating');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.source_status AS ENUM ('ready','needs_modification');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.access_method AS ENUM ('free','sellauth','paypal','ltc','discord');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('sellauth','paypal','ltc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ UPDATED_AT FUNCTION ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  username text UNIQUE,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles readable by all" ON public.profiles;
CREATE POLICY "profiles readable by all" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

DROP POLICY IF EXISTS "users see own roles" ON public.user_roles;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admins see all roles" ON public.user_roles;
CREATE POLICY "admins see all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins insert roles" ON public.user_roles;
CREATE POLICY "admins insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins update roles" ON public.user_roles;
CREATE POLICY "admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins delete roles" ON public.user_roles;
CREATE POLICY "admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ ADMIN CODES ============
CREATE TABLE IF NOT EXISTS public.admin_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid,
  used_by uuid,
  used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_codes TO authenticated;
GRANT ALL ON public.admin_codes TO service_role;
ALTER TABLE public.admin_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage codes" ON public.admin_codes;
CREATE POLICY "admins manage codes" ON public.admin_codes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SCRIPTS ============
CREATE TABLE IF NOT EXISTS public.scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  features text[] NOT NULL DEFAULT '{}',
  screenshots text[] NOT NULL DEFAULT '{}',
  youtube_url text,
  discord_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status public.script_status NOT NULL DEFAULT 'working',
  source_code text NOT NULL DEFAULT '',
  is_premium boolean NOT NULL DEFAULT false,
  payment_method public.payment_method,
  sellauth_url text,
  paypal_url text,
  ltc_address text,
  verified_by_nalyy boolean NOT NULL DEFAULT false,
  badges text[] NOT NULL DEFAULT '{}',
  views integer NOT NULL DEFAULT 0,
  developer text DEFAULT 'Nalyy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scripts TO anon, authenticated;
GRANT ALL ON public.scripts TO service_role;
ALTER TABLE public.scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scripts public read" ON public.scripts;
CREATE POLICY "scripts public read" ON public.scripts FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage scripts" ON public.scripts;
CREATE POLICY "admins manage scripts" ON public.scripts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS scripts_updated_at ON public.scripts;
CREATE TRIGGER scripts_updated_at BEFORE UPDATE ON public.scripts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SOURCES ============
CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  screenshots text[] NOT NULL DEFAULT '{}',
  discord_url text,
  tags text[] NOT NULL DEFAULT '{}',
  status public.source_status NOT NULL DEFAULT 'ready',
  source_code text NOT NULL DEFAULT '',
  access_method public.access_method NOT NULL DEFAULT 'free',
  sellauth_url text,
  paypal_url text,
  ltc_address text,
  discord_redirect_url text,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sources TO anon, authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sources public read" ON public.sources;
CREATE POLICY "sources public read" ON public.sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage sources" ON public.sources;
CREATE POLICY "admins manage sources" ON public.sources FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS sources_updated_at ON public.sources;
CREATE TRIGGER sources_updated_at BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, script_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews public read" ON public.reviews;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "users create own review" ON public.reviews;
CREATE POLICY "users create own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users update own review" ON public.reviews;
CREATE POLICY "users update own review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users delete own review or admin" ON public.reviews;
CREATE POLICY "users delete own review or admin" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS reviews_updated_at ON public.reviews;
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ LIKES ============
CREATE TABLE IF NOT EXISTS public.likes (
  user_id uuid NOT NULL,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, script_id)
);
GRANT SELECT ON public.likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes public read" ON public.likes;
CREATE POLICY "likes public read" ON public.likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "users like" ON public.likes;
CREATE POLICY "users like" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users unlike" ON public.likes;
CREATE POLICY "users unlike" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ FAVORITES ============
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id uuid NOT NULL,
  script_id uuid NOT NULL REFERENCES public.scripts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, script_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users see own favs" ON public.favorites;
CREATE POLICY "users see own favs" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users add fav" ON public.favorites;
CREATE POLICY "users add fav" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "users remove fav" ON public.favorites;
CREATE POLICY "users remove fav" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ STORE PRODUCTS ============
CREATE TABLE IF NOT EXISTS public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  image text,
  payment_method public.payment_method,
  sellauth_url text,
  paypal_url text,
  ltc_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_products TO anon, authenticated;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store public read" ON public.store_products;
CREATE POLICY "store public read" ON public.store_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage store" ON public.store_products;
CREATE POLICY "admins manage store" ON public.store_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SITE SETTINGS ============
CREATE TABLE IF NOT EXISTS public.site_settings (
  id integer PRIMARY KEY DEFAULT 1,
  discord_url text DEFAULT 'https://discord.gg/pmshPYywDD',
  webhook_url text,
  default_ltc_address text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.site_settings TO authenticated;
GRANT SELECT (id, discord_url, updated_at) ON public.site_settings TO anon;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings public read" ON public.site_settings;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins update settings" ON public.site_settings;
CREATE POLICY "admins update settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
DROP TRIGGER IF EXISTS site_settings_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SOURCE CODE RPCS ============
REVOKE SELECT (source_code) ON public.scripts FROM anon, authenticated;
REVOKE SELECT (source_code) ON public.sources FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_script_source(_script_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN s.source_code
    WHEN s.is_premium = false THEN s.source_code
    ELSE NULL
  END
  FROM public.scripts s
  WHERE s.id = _script_id
$$;

CREATE OR REPLACE FUNCTION public.get_source_source(_source_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN s.source_code
    WHEN s.access_method = 'free'::public.access_method THEN s.source_code
    ELSE NULL
  END
  FROM public.sources s
  WHERE s.id = _source_id
$$;

CREATE OR REPLACE FUNCTION public.admin_get_script_source(_script_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (SELECT source_code FROM public.scripts WHERE id = _script_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_source_source(_source_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (SELECT source_code FROM public.sources WHERE id = _source_id);
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_script_source(uuid) FROM public;
REVOKE ALL ON FUNCTION public.get_source_source(uuid) FROM public;
REVOKE ALL ON FUNCTION public.admin_get_script_source(uuid) FROM public;
REVOKE ALL ON FUNCTION public.admin_get_source_source(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_script_source(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_source_source(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_script_source(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_source_source(uuid) TO authenticated;