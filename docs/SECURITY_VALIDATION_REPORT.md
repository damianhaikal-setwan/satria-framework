# SATRIA Framework 3.0 — Validation report for OPD/year hardening

Release: Stage 1–3 security hardening
Migration: `supabase/migrations/20261024053200_satria_scoped_access_and_years.sql`

## Static checks executed in the build workspace

- 24/24 repository-specific static security assertions passed.
- All 8 inline JavaScript blocks in `index.html` passed `node --check`.
- HTML document parsed successfully with Python's HTML parser.
- Edge Function TypeScript for `admin-list-users`, `admin-create-user`, and `admin-update-user` passed TypeScript transpilation diagnostics.
- Migration framing checks found a `BEGIN`, a trailing `COMMIT`, and balanced dollar-quote delimiters.
- ZIP integrity is checked on the final release archive.

## What these checks do not establish

The migration was not executed against a PostgreSQL/Supabase instance in this workspace. The checks above are static validation; they do not prove the live schema, deployed function versions, RLS behavior, network configuration, or real multi-user concurrency on your Supabase project. The database assertion script at `supabase/tests/security_hardening_assertions.sql` must be run after deployment, followed by the live negative test matrix in `docs/SECURITY_SCOPE_HARDENING.md`.

## Required before production

1. Backup the live database and a SATRIA business-data JSON export.
2. Apply the migrations in the exact order documented in `docs/SECURITY_SCOPE_HARDENING.md` on a staging project first.
3. Deploy `admin-list-users` and `admin-create-user` from this release.
4. Assign both OPD and fiscal years to all existing non-admin accounts. Missing assignment is intentionally fail-closed.
5. Run `supabase/tests/security_hardening_assertions.sql` and all live negative tests using separate Operator/Viewer accounts with different OPD/year assignments.
6. Confirm application reports, print outputs, CSV and JSON exports contain only assigned data. Do not approve go-live until unauthorized direct SQL/API requests are also denied.

## Scope and remaining architecture work

This release hardens the current JSON snapshot architecture through allowlisted read and scoped merge RPCs. The snapshot still contains multiple business arrays. A longer-term migration to normalized business tables with foreign keys and RLS at each record is recommended to reduce concurrency contention and make access control easier to reason about.
