# SATRIA 3.0 — Security hardening: OPD + fiscal-year scope

## Scope of this release

This release addresses three stages in one change set:

1. **Close the full-snapshot path for non-admins.** All old `SELECT`/`ALL` RLS policies on `satria_state` are dropped; direct snapshot reads are admin-only; direct table writes are revoked; and `satria_save_state` requires an active admin. Operator/Viewer clients use `satria_get_scoped_state` only.
2. **Enforce scope at the server.** New `satria_membership_years` records explicit year assignments. A non-admin must have at least one active OPD assignment and at least one year assignment. The scoped read RPC emits an allowlisted projection. The scoped write RPC validates the authenticated role, assigned OPDs and years, package/master references, and optimistically merges only scoped package records and assigned-OPD unit/official rows into the canonical snapshot. Records outside that scope are preserved.
3. **Keep derived functions on the scoped view.** The frontend for a non-admin is hydrated only from the filtered RPC result. Dashboard, reports, print views, CSV and JSON backup use the in-memory scoped projection. Full backup import, reset and organization-global master edits are blocked for non-admins. The previous full local cache is not rendered while cloud configuration is active; after a successful scoped pull, the scope is persisted (if IndexedDB mode is on).

This is a security hardening bridge for the current JSON snapshot architecture, not a substitute for the long-term normalized business schema. The security boundary is the database RPC; browser-side filters are only presentation.

## Deployment order

Back up the production database and take a separate SATRIA JSON backup as an admin before deployment. Run on staging first.

1. Ensure the bootstrap and existing migrations are installed, in this order:
   - `supabase/satria-supabase-staging-bootstrap.sql` (only for a new project; review before executing)
   - `supabase/migrations/20261024_satria_user_creation_security.sql`
   - `supabase/migrations/20261024052900_satria_opd_assignments_rls.sql`
   - `supabase/migrations/20261024053000_satria_user_opd_assignment_api.sql`
   - `supabase/migrations/20261024053100_satria_catalog_and_assignment_repair.sql`
   - `supabase/migrations/20261024053200_satria_scoped_access_and_years.sql`
2. Deploy the updated Edge Functions:
   ```bash
   supabase functions deploy admin-list-users
   supabase functions deploy admin-create-user
   ```
   `admin-update-user` is unchanged by this scope release. Keep its existing deployment if already in use.
3. Publish the included `index.html` only after the migration is successful.
4. Sign in as an admin. On **Pengguna dan Hak Akses**, set each existing Operator/Viewer's OPD assignment and fiscal-year assignment using **Atur OPD** and **Atur TA**. Year assignment is deliberately **not auto-filled** for existing non-admins: until both dimensions are assigned, access is denied (fail closed).
5. Create any new Operator through the updated form, selecting at least one OPD and one year. The Edge Function validates both assignments before returning success.
6. Sign in as two test users with different OPD/year scopes and perform the test matrix below before production rollout.

## Mandatory staging test matrix

Use real, non-production accounts and clearly distinguish the fixture data by OPD and year.

| Test | Expected result |
|---|---|
| Non-admin calls `satria_state` table `SELECT` directly | RLS returns no row / denies access; no full payload is returned |
| Non-admin calls `satria_save_state` directly | `42501` permission error |
| Operator calls `satria_get_scoped_state` without OPD assignment | `42501` |
| Operator calls scoped read without year assignment | `42501` |
| Operator requests a package from an unassigned OPD or year | Not present in scoped response |
| Operator calls `satria_save_scoped_state` with another OPD/year | `42501`; canonical snapshot unchanged |
| Operator submits a package whose unit/official belongs to another OPD | `42501`; canonical snapshot unchanged |
| Operator submits an unknown supplier reference | `42501`; canonical snapshot unchanged |
| Operator changes a record in assigned OPD/year | Allowed if all references are valid; out-of-scope records remain byte-for-byte unaffected at the array-row level |
| Viewer calls `satria_save_scoped_state` | `42501` |
| Operator attempts JSON full-backup import or global OPD/year/master edit in UI | Blocked by UI; server remains the authority regardless |
| User from organization A supplies organization B UUID | No membership, so denied |
| Assigned-year selector/CSV/print/backup | Only the allowed OPDs and years appear |
| Concurrency: two clients edit after the same snapshot version | One save conflicts with SQLSTATE `40001`; user must pull and reconcile |
| Deactivate a user, then reuse their existing session | Scoped read/write is denied once membership is inactive |

This matrix requires runtime execution against the target Supabase project; static code checks do not replace it.

## Data-model and operational caveats

- `akun`, `kode`, and organization metadata in this transitional snapshot are shared reference/settings data. They are included read-only for scoped clients. If any such collection contains personal or OPD-confidential records in your actual dataset, remove it from `satria_get_scoped_state` or normalize and scope it too before go-live.
- Units and officials are scoped by OPD; packages are scoped by both OPD and year. A unit/official referenced by an out-of-scope-year package cannot be changed or deleted by an Operator who lacks that year assignment. Supplier rows are exposed only when referenced by a package in scope. A supplier shared with out-of-scope packages cannot be mutated through the scoped write path.
- Full snapshot replacement remains available for active admins only. It replaces the whole snapshot and can overwrite concurrent edits; make an explicit backup and pull the latest version first.
- The implementation was not deployed to your live Supabase project from this workspace. Applying migrations and deploying the Edge Functions is required before runtime access controls change.
