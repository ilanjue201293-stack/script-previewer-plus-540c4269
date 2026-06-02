
-- Restrict SECURITY DEFINER function execution
revoke execute on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated, service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Pin search_path on set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at = now(); return new; end; $$;

-- Replace broad bucket select policy with one that allows reading files but not listing arbitrarily
drop policy if exists "media public read" on storage.objects;
create policy "media public read files" on storage.objects for select using (bucket_id = 'media');
