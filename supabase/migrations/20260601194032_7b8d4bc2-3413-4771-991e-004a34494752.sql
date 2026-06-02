
-- 1) Protect script & source source_code at column level (anyone signing up is otherwise free)
REVOKE SELECT (source_code) ON public.scripts FROM anon, authenticated;
REVOKE SELECT (source_code) ON public.sources FROM anon, authenticated;

-- RPC: return script source_code only for non-premium or admins
CREATE OR REPLACE FUNCTION public.get_script_source(_script_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN s.source_code
    WHEN s.is_premium = false THEN s.source_code
    ELSE NULL
  END
  FROM public.scripts s WHERE s.id = _script_id
$$;

-- RPC: return source source_code only for free access or admins
CREATE OR REPLACE FUNCTION public.get_source_source(_source_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN s.source_code
    WHEN s.access_method = 'free'::public.access_method THEN s.source_code
    ELSE NULL
  END
  FROM public.sources s WHERE s.id = _source_id
$$;

-- Admin RPC to fetch source_code for editing (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_script_source(_script_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (SELECT source_code FROM public.scripts WHERE id = _script_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_source_source(_source_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (SELECT source_code FROM public.sources WHERE id = _source_id);
END $$;

REVOKE ALL ON FUNCTION public.get_script_source(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_source_source(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_script_source(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_source_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_script_source(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_source_source(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_script_source(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_source_source(uuid) TO authenticated;

-- 2) Hide sensitive site_settings fields from anonymous visitors
REVOKE SELECT ON public.site_settings FROM anon;
GRANT SELECT (id, discord_url, updated_at) ON public.site_settings TO anon;
-- authenticated keeps row-level read (used by admin); webhook_url is only fetched server-side via service_role.

-- 3) user_roles — add explicit admin-only write policies (currently no policy = deny, but be explicit)
CREATE POLICY "admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
