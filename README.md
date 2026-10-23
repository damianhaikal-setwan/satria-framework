# SATRIA Framework 3.0 (public development repository)

A single-file HTML prototype for SATRIA Framework. The deployed demo uses synthetic placeholder data only. It contains no production Supabase URL/key and no real government official or supplier records.

## Cloudflare Pages

Connect this repository to Cloudflare Pages with production branch `main`, no build command, and build output directory `public`. The public output contains only `public/index.html`; the SQL bootstrap is stored under `supabase/` and is not copied into the Pages output directory.

## Supabase setup

Review and run `supabase/satria-supabase-staging-bootstrap.sql` only in a staging project first. Create an Auth user and an organization/membership according to the SQL comments. Do not commit a service-role/secret key. The anon/publishable key is public by design and must be protected by tested RLS.

## Limitations

The current integration is a transitional JSON snapshot per organization, not a normalized production schema. All active organization members can read the entire snapshot; per-OPD data isolation is not implemented. Do not use this bridge for sensitive production records until normalized tables, granular RLS, private Storage and audit controls are implemented and tested. The local demo user/role selector is not authentication; Supabase Auth membership is required for cloud access.
