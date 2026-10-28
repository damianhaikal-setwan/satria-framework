-- SATRIA NEXT 3.0.59 — Smart Survey PRO / private user drafts.
-- REQUIRED for cloud draft autosave, device restore and optimistic concurrency.
-- Apply AFTER 20261024053200_satria_scoped_access_and_years.sql.
-- No change to SATRIA core state RPCs, Bank RUP or existing Storage RLS.
-- Safe to re-run: CREATE IF NOT EXISTS / CREATE OR REPLACE and policy replacement.
BEGIN;
CREATE TABLE IF NOT EXISTS public.satria_survey_drafts (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  opd_id text NOT NULL,
  fiscal_year integer NOT NULL CHECK(fiscal_year BETWEEN 2000 AND 2200),
  paket_id text NOT NULL,
  penawaran_id text NOT NULL,
  item_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(payload)='object'),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, paket_id, penawaran_id, item_id)
);
CREATE INDEX IF NOT EXISTS satria_survey_drafts_scope_idx
  ON public.satria_survey_drafts (organization_id, user_id, updated_at DESC);
ALTER TABLE public.satria_survey_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satria_survey_drafts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.satria_survey_drafts TO authenticated;
DROP POLICY IF EXISTS satria_survey_drafts_read_own ON public.satria_survey_drafts;
CREATE POLICY satria_survey_drafts_read_own ON public.satria_survey_drafts FOR SELECT
  TO authenticated
  USING (
    user_id=auth.uid()
    AND public.satria_user_can_access_scope(organization_id,opd_id,fiscal_year)
  );
-- Writes are ONLY through RPC: client cannot fabricate user_id / bypass CAS.
CREATE OR REPLACE FUNCTION public.satria_survey_save_draft(
  p_organization_id uuid,
  p_opd_id text,
  p_fiscal_year integer,
  p_paket_id text,
  p_penawaran_id text,
  p_item_id text,
  p_expected_version bigint,
  p_payload jsonb
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $$
DECLARE
  v_version bigint;
  v_uid uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL OR p_organization_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT public.satria_user_can_access_scope(p_organization_id,p_opd_id,p_fiscal_year) THEN
    RAISE EXCEPTION 'No permission for this OPD/year' USING ERRCODE='42501';
  END IF;
  SELECT role INTO v_role FROM public.satria_memberships
    WHERE organization_id=p_organization_id AND user_id=v_uid AND active=true;
  IF v_role IS DISTINCT FROM 'admin' AND v_role IS DISTINCT FROM 'operator' THEN
    RAISE EXCEPTION 'Viewers cannot save drafts' USING ERRCODE='42501';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'Expected version must be >= 0' USING ERRCODE='22023';
  END IF;
  IF p_opd_id IS NULL OR length(p_opd_id)>128 OR p_paket_id IS NULL OR length(p_paket_id) NOT BETWEEN 1 AND 128
    OR p_penawaran_id IS NULL OR length(p_penawaran_id) NOT BETWEEN 1 AND 128
    OR p_item_id IS NULL OR length(p_item_id) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid survey draft identifiers' USING ERRCODE='22023';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object'
    OR octet_length(p_payload::text)>24000
    OR NOT (p_payload ? 'fields') OR NOT (p_payload ? 'meta') THEN
    RAISE EXCEPTION 'Invalid/oversized draft; upload images to Storage instead' USING ERRCODE='22023';
  END IF;
  -- New draft: expected version 0. Concurrent create is detected without overwrite.
  IF p_expected_version=0 THEN
    INSERT INTO public.satria_survey_drafts
      (organization_id,user_id,opd_id,fiscal_year,paket_id,penawaran_id,item_id,payload,version)
    VALUES
      (p_organization_id,v_uid,p_opd_id,p_fiscal_year,p_paket_id,p_penawaran_id,p_item_id,p_payload,1)
    ON CONFLICT DO NOTHING RETURNING version INTO v_version;
    IF FOUND THEN RETURN v_version; END IF;
    RAISE EXCEPTION 'SATRIA_DRAFT_CONFLICT: draft exists on another device' USING ERRCODE='P0001';
  END IF;
  UPDATE public.satria_survey_drafts
     SET payload=p_payload,version=version+1,updated_at=now()
   WHERE organization_id=p_organization_id AND user_id=v_uid
     AND paket_id=p_paket_id AND penawaran_id=p_penawaran_id AND item_id=p_item_id
     AND opd_id=p_opd_id AND fiscal_year=p_fiscal_year
     AND version=p_expected_version
   RETURNING version INTO v_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SATRIA_DRAFT_CONFLICT: version changed on another device' USING ERRCODE='P0001';
  END IF;
  RETURN v_version;
END;
$$;
REVOKE ALL ON FUNCTION public.satria_survey_save_draft(uuid,text,integer,text,text,text,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.satria_survey_save_draft(uuid,text,integer,text,text,text,bigint,jsonb) TO authenticated;
COMMIT;
