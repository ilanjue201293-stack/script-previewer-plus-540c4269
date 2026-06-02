DROP FUNCTION IF EXISTS public.get_script_source(uuid);
DROP FUNCTION IF EXISTS public.get_source_source(uuid);
DROP FUNCTION IF EXISTS public.admin_get_script_source(uuid);
DROP FUNCTION IF EXISTS public.admin_get_source_source(uuid);

DROP POLICY IF EXISTS "media public read" ON storage.objects;
DROP POLICY IF EXISTS "media public read files" ON storage.objects;
DROP POLICY IF EXISTS "auth upload media" ON storage.objects;
DROP POLICY IF EXISTS "owners update media" ON storage.objects;
DROP POLICY IF EXISTS "owners delete media" ON storage.objects;

CREATE POLICY "media files are readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "signed in users upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

CREATE POLICY "users update own media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid())
WITH CHECK (bucket_id = 'media' AND owner = auth.uid());

CREATE POLICY "users delete own media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND owner = auth.uid());