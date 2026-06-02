-- ============ ENUMS ============
create type public.app_role as enum ('user','admin');
create type public.script_status as enum ('working','patched','updating');
create type public.source_status as enum ('ready','needs_modification');
create type public.access_method as enum ('free','sellauth','paypal','ltc','discord');
create type public.payment_method as enum ('sellauth','paypal','ltc');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid()=id);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "users see own roles" on public.user_roles for select to authenticated using (auth.uid()=user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create policy "admins see all roles" on public.user_roles for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id, username) values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
    on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
    on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at = now(); return new; end; $$;

-- ============ ADMIN CODES ============
create table public.admin_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
grant all on public.admin_codes to authenticated, service_role;
alter table public.admin_codes enable row level security;
create policy "admins manage codes" on public.admin_codes for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ SCRIPTS ============
create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  features text[] not null default '{}',
  screenshots text[] not null default '{}',
  youtube_url text,
  discord_url text,
  tags text[] not null default '{}',
  status script_status not null default 'working',
  source_code text not null default '',
  is_premium boolean not null default false,
  payment_method payment_method,
  sellauth_url text,
  paypal_url text,
  ltc_address text,
  verified_by_nalyy boolean not null default false,
  badges text[] not null default '{}',
  views integer not null default 0,
  developer text default 'Nalyy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.scripts to anon, authenticated;
grant all on public.scripts to service_role;
alter table public.scripts enable row level security;
create policy "scripts public read" on public.scripts for select using (true);
create policy "admins manage scripts" on public.scripts for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger scripts_updated_at before update on public.scripts
  for each row execute function public.set_updated_at();

-- ============ SOURCES ============
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  screenshots text[] not null default '{}',
  discord_url text,
  tags text[] not null default '{}',
  status source_status not null default 'ready',
  source_code text not null default '',
  access_method access_method not null default 'free',
  sellauth_url text,
  paypal_url text,
  ltc_address text,
  discord_redirect_url text,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.sources to anon, authenticated;
grant all on public.sources to service_role;
alter table public.sources enable row level security;
create policy "sources public read" on public.sources for select using (true);
create policy "admins manage sources" on public.sources for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

-- ============ REVIEWS ============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, script_id)
);
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public read" on public.reviews for select using (true);
create policy "users create own review" on public.reviews for insert to authenticated with check (auth.uid()=user_id);
create policy "users update own review" on public.reviews for update to authenticated using (auth.uid()=user_id);
create policy "users delete own review or admin" on public.reviews for delete to authenticated using (auth.uid()=user_id or public.has_role(auth.uid(),'admin'));
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- ============ LIKES ============
create table public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, script_id)
);
grant select on public.likes to anon, authenticated;
grant insert, delete on public.likes to authenticated;
grant all on public.likes to service_role;
alter table public.likes enable row level security;
create policy "likes public read" on public.likes for select using (true);
create policy "users like" on public.likes for insert to authenticated with check (auth.uid()=user_id);
create policy "users unlike" on public.likes for delete to authenticated using (auth.uid()=user_id);

-- ============ FAVORITES ============
create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid not null references public.scripts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, script_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "users see own favs" on public.favorites for select to authenticated using (auth.uid()=user_id);
create policy "users add fav" on public.favorites for insert to authenticated with check (auth.uid()=user_id);
create policy "users remove fav" on public.favorites for delete to authenticated using (auth.uid()=user_id);

-- ============ STORE PRODUCTS ============
create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  image text,
  payment_method payment_method,
  sellauth_url text,
  paypal_url text,
  ltc_address text,
  created_at timestamptz not null default now()
);
grant select on public.store_products to anon, authenticated;
grant all on public.store_products to service_role;
alter table public.store_products enable row level security;
create policy "store public read" on public.store_products for select using (true);
create policy "admins manage store" on public.store_products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ SITE SETTINGS ============
create table public.site_settings (
  id int primary key default 1,
  discord_url text default 'https://discord.gg/pmshPYywDD',
  webhook_url text,
  default_ltc_address text,
  updated_at timestamptz not null default now(),
  constraint singleton check (id = 1)
);
grant select (id, discord_url, updated_at) on public.site_settings to anon;
grant select on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select using (true);
create policy "admins update settings" on public.site_settings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.site_settings (id) values (1);

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict do nothing;
create policy "media public read files" on storage.objects for select using (bucket_id = 'media');
create policy "auth upload media" on storage.objects for insert to authenticated with check (bucket_id='media');
create policy "owners update media" on storage.objects for update to authenticated using (bucket_id='media' and owner = auth.uid());
create policy "owners delete media" on storage.objects for delete to authenticated using (bucket_id='media' and owner = auth.uid());

-- ============ FUNCTION HARDENING ============
revoke execute on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ============ COLUMN-LEVEL CODE PROTECTION ============
REVOKE SELECT (source_code) ON public.scripts FROM anon, authenticated;
REVOKE SELECT (source_code) ON public.sources FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_script_source(_script_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN s.source_code
    WHEN s.is_premium = false THEN s.source_code
    ELSE NULL
  END FROM public.scripts s WHERE s.id = _script_id
$$;

CREATE OR REPLACE FUNCTION public.get_source_source(_source_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN s.source_code
    WHEN s.access_method = 'free'::public.access_method THEN s.source_code
    ELSE NULL
  END FROM public.sources s WHERE s.id = _source_id
$$;

CREATE OR REPLACE FUNCTION public.admin_get_script_source(_script_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (SELECT source_code FROM public.scripts WHERE id = _script_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_source_source(_source_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
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

CREATE POLICY "admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));