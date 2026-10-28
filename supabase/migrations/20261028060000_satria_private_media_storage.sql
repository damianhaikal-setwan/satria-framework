-- SATRIA NEXT 3.0.54: PRIVATE Storage assets (catalog images, signatures, stamps, letterheads, government logo).
-- Apply AFTER 20261028010000_satria_rup_bank_cloud_compat.sql on STAGING first.
-- Object path layout:
--   <org_uuid>/opd/<opd_id>/product/<fiscal_year>/<uuid>.<png|jpg|webp|gif>
--   <org_uuid>/opd/<opd_id>/<ttd|cap|kop>/<uuid>.<png|jpg|webp|gif>
--   <org_uuid>/shared/logo/<uuid>.<png|jpg|webp|gif>
-- No public URLs. No service role key in browser. No direct writes to storage.objects metadata.
BEGIN;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('satria-media','satria-media',false,1048576,ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=1048576,
  allowed_mime_types=ARRAY['image/png','image/jpeg','image/webp','image/gif'];

CREATE OR REPLACE FUNCTION public.satria_media_allowed(p_name text, p_write boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog,public,auth AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_opd text;
  v_kind text;
  v_year int;
  v_parts text[];
BEGIN
  IF v_actor IS NULL OR p_name IS NULL OR length(p_name)>512 THEN RETURN false; END IF;
  v_parts:=string_to_array(p_name,'/');
  IF array_length(v_parts,1) NOT IN (4,5,6,7) THEN RETURN false; END IF;
  IF v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
  v_org:=v_parts[1]::uuid;
  SELECT m.role INTO v_role FROM public.satria_memberships m
    WHERE m.organization_id=v_org AND m.user_id=v_actor AND m.active=true;
  IF NOT FOUND OR v_role NOT IN ('admin','operator','viewer') THEN RETURN false; END IF;
  IF p_write AND v_role='viewer' THEN RETURN false; END IF;
  -- Shared government logo: only admins upload; every active member can view.
  IF array_length(v_parts,1)=4 AND v_parts[2]='shared' AND v_parts[3]='logo' THEN
    IF v_parts[4] !~* '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$' THEN RETURN false; END IF;
    RETURN NOT p_write OR v_role='admin';
  END IF;
  IF v_parts[2]<>'opd' THEN RETURN false; END IF;
  v_opd:=v_parts[3];
  v_kind:=v_parts[4];
  IF v_opd !~ '^[a-zA-Z0-9_-]{1,128}$' THEN RETURN false; END IF;
  IF v_kind='product' AND array_length(v_parts,1)=6 THEN
    IF v_parts[5] !~ '^[0-9]{4}$' OR v_parts[6] !~* '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$' THEN RETURN false; END IF;
    v_year:=v_parts[5]::int;
    IF v_year<2000 OR v_year>2200 THEN RETURN false; END IF;
    IF v_role='admin' THEN RETURN true; END IF;
    -- An operator/viewer must be assigned to BOTH the OPD and fiscal year.
    RETURN EXISTS(SELECT 1 FROM public.satria_membership_opds mo
                    WHERE mo.organization_id=v_org AND mo.user_id=v_actor AND mo.opd_id=v_opd)
       AND EXISTS(SELECT 1 FROM public.satria_membership_years my
                    WHERE my.organization_id=v_org AND my.user_id=v_actor AND my.fiscal_year=v_year);
  END IF;
  IF v_kind IN ('ttd','cap','kop') AND array_length(v_parts,1)=5 THEN
    IF v_parts[5] !~* '^[0-9a-f-]{36}\.(png|jpg|webp|gif)$' THEN RETURN false; END IF;
    IF v_role='admin' THEN RETURN true; END IF;
    IF p_write THEN RETURN false; END IF;
    RETURN EXISTS(SELECT 1 FROM public.satria_membership_opds mo
                    WHERE mo.organization_id=v_org AND mo.user_id=v_actor AND mo.opd_id=v_opd);
  END IF;
  RETURN false;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.satria_media_allowed(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.satria_media_allowed(text,boolean) TO authenticated;

DROP POLICY IF EXISTS satria_media_private_select ON storage.objects;
CREATE POLICY satria_media_private_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='satria-media' AND public.satria_media_allowed(name,false));
DROP POLICY IF EXISTS satria_media_private_insert ON storage.objects;
CREATE POLICY satria_media_private_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='satria-media' AND public.satria_media_allowed(name,true));
-- No UPDATE/DELETE policy: immutable object names prevent accidental loss of a signed document image.
-- When a field is cleared, its reference disappears from SATRIA; an admin-led retention/cleanup job
-- should separately remove unreferenced objects through the Storage API after backups are verified.
COMMIT;
