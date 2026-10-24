import { createClient } from "npm:@supabase/supabase-js@2";

type ListUsersBody = {
  organization_id: string;
  page?: number;
  page_size?: number;
  action?: "list" | "sync_local_catalog";
  expected_version?: number;
  opds?: unknown;
};

type MembershipRow = {
  user_id: string;
  role: "admin" | "operator" | "viewer";
  active: boolean;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1_000_000;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 2_000;
const AUTH_LOOKUP_CONCURRENCY = 8;

function defaultKey(mapEnv: string, singularEnv: string, legacyEnv: string): string {
  const mapped = Deno.env.get(mapEnv);
  if (mapped) {
    try {
      const keys = JSON.parse(mapped) as Record<string, unknown>;
      if (typeof keys.default === "string" && keys.default.length > 0) return keys.default;
    } catch {
      throw new Error(`Invalid JSON in ${mapEnv}`);
    }
  }
  return Deno.env.get(singularEnv) ?? Deno.env.get(legacyEnv) ?? "";
}

function getConfig() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = defaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  const secretKey = defaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const allowedOrigins = new Set(
    (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!url || !publishableKey || !secretKey) throw new Error("Missing Supabase runtime configuration");
  if (allowedOrigins.size === 0) throw new Error("ALLOWED_ORIGINS must contain at least one exact origin");
  return { url, publishableKey, secretKey, allowedOrigins };
}

function jsonResponse(
  request: Request,
  status: number,
  payload: Record<string, unknown>,
  allowedOrigins: Set<string>,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, x-client-info, content-type, x-supabase-api-version");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(
  request: Request,
  status: number,
  error: string,
  requestId: string,
  allowedOrigins: Set<string>,
): Response {
  return jsonResponse(request, status, { error, request_id: requestId }, allowedOrigins);
}

function cleanDisplayName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
  return cleaned || fallback;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  let config: ReturnType<typeof getConfig>;
  try {
    config = getConfig();
  } catch (error) {
    console.error(JSON.stringify({ event: "config_error", requestId, type: error instanceof Error ? error.name : "unknown" }));
    return new Response(JSON.stringify({ error: "Fungsi belum dikonfigurasi dengan benar.", request_id: requestId }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }

  const origin = request.headers.get("Origin");
  if (origin && !config.allowedOrigins.has(origin)) {
    return errorResponse(request, 403, "Origin tidak diizinkan.", requestId, config.allowedOrigins);
  }
  if (request.method === "OPTIONS") {
    const headers = new Headers({ "Vary": "Origin", "Cache-Control": "no-store" });
    if (origin && config.allowedOrigins.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Headers", "authorization, apikey, x-client-info, content-type, x-supabase-api-version");
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      headers.set("Access-Control-Max-Age", "86400");
    }
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return errorResponse(request, 405, "Gunakan POST.", requestId, config.allowedOrigins);
  }
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    return errorResponse(request, 415, "Content-Type harus application/json.", requestId, config.allowedOrigins);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return errorResponse(request, 413, "Isi permintaan terlalu besar.", requestId, config.allowedOrigins);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorResponse(request, 413, "Isi permintaan terlalu besar.", requestId, config.allowedOrigins);
  }

  let body: ListUsersBody;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body must be an object");
    const candidate = parsed as Record<string, unknown>;
    const allowedFields = new Set(["organization_id", "page", "page_size", "action", "expected_version", "opds"]);
    if (Object.keys(candidate).some((key) => !allowedFields.has(key))) throw new Error("unexpected field");
    body = candidate as ListUsersBody;
  } catch {
    return errorResponse(request, 400, "JSON tidak valid atau berisi properti yang tidak didukung.", requestId, config.allowedOrigins);
  }

  const organizationId = typeof body.organization_id === "string" ? body.organization_id.trim() : "";
  const action = body.action ?? "list";
  const page = body.page ?? 1;
  const pageSize = body.page_size ?? MAX_PAGE_SIZE;
  if (!UUID_RE.test(organizationId)) {
    return errorResponse(request, 400, "Organization UUID tidak valid.", requestId, config.allowedOrigins);
  }
  if (action !== "list" && action !== "sync_local_catalog") {
    return errorResponse(request, 400, "Action tidak didukung.", requestId, config.allowedOrigins);
  }
  if (action === "list" && (!Number.isInteger(page) || page < 1 || page > MAX_PAGE)) {
    return errorResponse(request, 400, `Nomor halaman harus bilangan bulat 1–${MAX_PAGE}.`, requestId, config.allowedOrigins);
  }
  if (action === "list" && (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)) {
    return errorResponse(request, 400, `Ukuran halaman harus bilangan bulat 1–${MAX_PAGE_SIZE}.`, requestId, config.allowedOrigins);
  }
  if (action === "sync_local_catalog") {
    if (!Number.isInteger(body.expected_version) || (body.expected_version ?? -1) < 1) {
      return errorResponse(request, 400, "Versi snapshot tidak valid. Klik Muat ulang sebelum sinkronisasi.", requestId, config.allowedOrigins);
    }
    if (!Array.isArray(body.opds) || body.opds.length < 1 || body.opds.length > 1_000) {
      return errorResponse(request, 400, "Kirim 1–1.000 baris OPD dari Data Master.", requestId, config.allowedOrigins);
    }
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) {
    return errorResponse(request, 401, "Sesi login admin diperlukan.", requestId, config.allowedOrigins);
  }

  const authClient = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(tokenMatch[1]);
  if (authError || !authData.user) {
    return errorResponse(request, 401, "Sesi tidak valid atau sudah kedaluwarsa.", requestId, config.allowedOrigins);
  }
  const actor = authData.user;

  const adminClient = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: membership, error: membershipError } = await adminClient
    .from("satria_memberships")
    .select("role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", actor.id)
    .maybeSingle();

  if (membershipError) {
    console.error(JSON.stringify({ event: "membership_lookup_error", requestId, actorId: actor.id, organizationId }));
    return errorResponse(request, 500, "Tidak dapat memverifikasi hak admin.", requestId, config.allowedOrigins);
  }
  if (!membership || membership.role !== "admin" || membership.active !== true) {
    return errorResponse(request, 403, "Hanya admin aktif pada organisasi ini yang dapat melihat daftar pengguna.", requestId, config.allowedOrigins);
  }

  // Explicitly sync only the OPD master from the authenticated admin's current Data Master.
  // All other snapshot fields remain untouched; optimistic version check prevents overwriting a newer cloud state.
  let catalogSyncCount = 0;
  if (action === "sync_local_catalog") {
    const { data: currentState, error: currentStateError } = await adminClient
      .from("satria_state")
      .select("payload,version")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (currentStateError) {
      console.error(JSON.stringify({ event: "local_opd_sync_state_read_error", requestId, actorId: actor.id, organizationId }));
      return errorResponse(request, 500, "Snapshot cloud tidak dapat dibaca untuk sinkronisasi OPD.", requestId, config.allowedOrigins);
    }
    if (!currentState || !currentState.payload || typeof currentState.payload !== "object" || Array.isArray(currentState.payload)) {
      return errorResponse(request, 409, "Snapshot cloud belum tersedia. Kirim snapshot awal SATRIA terlebih dahulu setelah membuat backup.", requestId, config.allowedOrigins);
    }
    const currentVersion = Number(currentState.version);
    if (!Number.isInteger(currentVersion) || currentVersion !== body.expected_version) {
      return errorResponse(request, 409, "Versi snapshot cloud sudah berubah. Tarik snapshot terbaru dan periksa perbedaan sebelum sinkronisasi.", requestId, config.allowedOrigins);
    }

    const incoming = body.opds as unknown[];
    const oldPayload = currentState.payload as Record<string, unknown>;
    const priorRows = Array.isArray(oldPayload.opd) ? oldPayload.opd : [];
    const priorById = new Map<string, Record<string, unknown>>();
    for (const item of priorRows) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" || typeof row.id === "number" ? String(row.id).trim() : "";
      if (id) priorById.set(id, row);
    }

    const seenIds = new Set<string>();
    const normalizedLocal: Record<string, unknown>[] = [];
    for (const item of incoming) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return errorResponse(request, 400, "Data OPD berisi baris yang tidak valid.", requestId, config.allowedOrigins);
      }
      const row = item as Record<string, unknown>;
      const idValue = row.id ?? row.opd_id;
      const id = typeof idValue === "string" || typeof idValue === "number" ? String(idValue).trim() : "";
      const nameValue = row.nama ?? row.name;
      const name = typeof nameValue === "string" ? nameValue.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) : "";
      const shortValue = row.singkat ?? row.code;
      const shortName = typeof shortValue === "string" ? shortValue.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) : "";
      if (!id || id.length > 128 || !name) {
        return errorResponse(request, 400, "Setiap OPD harus memiliki ID dan nama yang valid. Perbaiki Data Master dahulu.", requestId, config.allowedOrigins);
      }
      if (seenIds.has(id)) {
        return errorResponse(request, 409, "ID OPD duplikat pada Data Master. Perbaiki sebelum sinkronisasi.", requestId, config.allowedOrigins);
      }
      seenIds.add(id);
      const prior = priorById.get(id) ?? {};
      const textField = (field: string, previous: unknown) => {
        const value = row[field];
        return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 500) : (typeof previous === "string" ? previous : "");
      };
      normalizedLocal.push({
        ...prior,
        id,
        nama: name,
        singkat: shortName || (typeof prior.singkat === "string" ? prior.singkat : ""),
        alamat: textField("alamat", prior.alamat),
        kontak: textField("kontak", prior.kontak),
        tempat: textField("tempat", prior.tempat),
      });
    }

    // Retain valid cloud OPDs omitted from the local list during this catalog-only action.
    // This prevents an incomplete local view from deleting an OPD referenced by existing records.
    const retainedCloudRows: Record<string, unknown>[] = [];
    for (const item of priorRows) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const idValue = row.id ?? row.opd_id;
      const id = typeof idValue === "string" || typeof idValue === "number" ? String(idValue).trim() : "";
      const nameValue = row.nama ?? row.name ?? row.singkat ?? row.code;
      const name = typeof nameValue === "string" ? nameValue.trim() : "";
      if (id && name && !seenIds.has(id)) {
        retainedCloudRows.push(row);
        seenIds.add(id);
      }
    }
    const nextPayload = { ...oldPayload, opd: [...normalizedLocal, ...retainedCloudRows] };
    const { data: updatedState, error: updateStateError } = await adminClient
      .from("satria_state")
      .update({ payload: nextPayload, version: currentVersion + 1, updated_at: new Date().toISOString(), updated_by: actor.id })
      .eq("organization_id", organizationId)
      .eq("version", currentVersion)
      .select("version")
      .maybeSingle();
    if (updateStateError) {
      console.error(JSON.stringify({ event: "local_opd_sync_state_update_error", requestId, actorId: actor.id, organizationId }));
      return errorResponse(request, 500, "Master OPD tidak dapat disimpan ke snapshot cloud.", requestId, config.allowedOrigins);
    }
    if (!updatedState) {
      return errorResponse(request, 409, "Snapshot cloud berubah selama sinkronisasi. Muat ulang lalu coba lagi.", requestId, config.allowedOrigins);
    }
    catalogSyncCount = normalizedLocal.length;
  }

  // The normal list path derives its OPD catalog from the organization snapshot.
  // Browser-supplied OPD labels are accepted only in the explicit sync_local_catalog action
  // above, after verifying an active admin, input bounds, unique IDs, and snapshot version.
  const { data: stateRow, error: stateError } = await adminClient
    .from("satria_state")
    .select("payload,version")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (stateError) {
    console.error(JSON.stringify({ event: "opd_snapshot_lookup_error", requestId, actorId: actor.id, organizationId }));
    return errorResponse(request, 500, "Snapshot OPD organisasi tidak dapat dibaca.", requestId, config.allowedOrigins);
  }

  const snapshotPayload = stateRow?.payload as Record<string, unknown> | null;
  const rawOpds = snapshotPayload?.opd;
  if (Array.isArray(rawOpds)) {
    const parsed = rawOpds.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const source = item as Record<string, unknown>;
      const opdId = typeof source.id === "string" || typeof source.id === "number" ? String(source.id).trim() : "";
      const shortName = typeof source.singkat === "string" ? source.singkat.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) : "";
      const nameRaw = typeof source.nama === "string" ? source.nama : shortName;
      const name = nameRaw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
      if (!opdId || opdId.length > 128 || !name) return null;
      return { organization_id: organizationId, opd_id: opdId, name, code: shortName || null, active: true };
    }).filter((item): item is { organization_id: string; opd_id: string; name: string; code: string | null; active: boolean } => item !== null);

    // The catalog has a unique (organization, code) constraint. Suppress
    // ambiguous codes rather than making the whole directory sync fail.
    const codeCounts = new Map<string, number>();
    for (const item of parsed) if (item.code) codeCounts.set(item.code, (codeCounts.get(item.code) ?? 0) + 1);
    const normalized = parsed.map((item) => ({
      ...item,
      code: item.code && codeCounts.get(item.code) === 1 ? item.code : null,
    }));
    if (new Set(normalized.map((item) => item.opd_id)).size !== normalized.length) {
      console.error(JSON.stringify({ event: "opd_catalog_duplicate_id", requestId, actorId: actor.id, organizationId }));
      return errorResponse(request, 409, "Data master OPD memiliki ID duplikat. Perbaiki data sebelum mengatur hak akses pengguna.", requestId, config.allowedOrigins);
    }
    if (rawOpds.length > 0 && normalized.length === 0) {
      console.error(JSON.stringify({ event: "opd_catalog_no_valid_rows", requestId, actorId: actor.id, organizationId }));
      return errorResponse(request, 409, "Tidak ada baris OPD yang valid pada snapshot. Perbaiki master OPD sebelum mengatur hak akses.", requestId, config.allowedOrigins);
    }

    const { data: existingCatalog, error: existingCatalogError } = await adminClient
      .from("satria_opds")
      .select("opd_id,active")
      .eq("organization_id", organizationId);
    if (existingCatalogError) {
      console.error(JSON.stringify({ event: "opd_catalog_read_error", requestId, actorId: actor.id, organizationId }));
      return errorResponse(request, 500, "Katalog OPD tidak dapat dimuat.", requestId, config.allowedOrigins);
    }
    const activeSnapshotIds = new Set(normalized.map((item) => item.opd_id));
    for (const old of existingCatalog ?? []) {
      if (old.active && !activeSnapshotIds.has(old.opd_id)) {
        // Clear a potentially reused code before the partial unique index is
        // checked by upsert, while retaining the old assignment history.
        const { error: deactivateError } = await adminClient
          .from("satria_opds")
          .update({ active: false, code: null })
          .eq("organization_id", organizationId)
          .eq("opd_id", old.opd_id);
        if (deactivateError) {
          console.error(JSON.stringify({ event: "opd_catalog_deactivate_error", requestId, actorId: actor.id, organizationId }));
          return errorResponse(request, 500, "Katalog OPD lama tidak dapat dinonaktifkan dengan aman.", requestId, config.allowedOrigins);
        }
      }
    }

    if (normalized.length) {
      const { error: upsertError } = await adminClient
        .from("satria_opds")
        .upsert(normalized, { onConflict: "organization_id,opd_id" });
      if (upsertError) {
        console.error(JSON.stringify({ event: "opd_catalog_upsert_error", requestId, actorId: actor.id, organizationId, code: upsertError.code ?? "unknown" }));
        return errorResponse(request, 500, "Katalog OPD belum dapat disiapkan. Periksa migrasi dan data master OPD.", requestId, config.allowedOrigins);
      }
    }
  }

  const { data: opds, error: opdsError } = await adminClient
    .from("satria_opds")
    .select("opd_id,name,code")
    .eq("organization_id", organizationId)
    .eq("active", true)
    .order("name", { ascending: true });
  if (opdsError) {
    console.error(JSON.stringify({ event: "opd_catalog_list_error", requestId, actorId: actor.id, organizationId }));
    return errorResponse(request, 500, "Katalog OPD tidak dapat dimuat. Jalankan migrasi assignment OPD.", requestId, config.allowedOrigins);
  }
  const opdNameById = new Map((opds ?? []).map((opd) => [opd.opd_id, opd.name]));

  const offset = (page - 1) * pageSize;
  const { data: memberships, error: listError, count } = await adminClient
    .from("satria_memberships")
    .select("user_id, role, active, created_at", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("user_id", { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (listError) {
    console.error(JSON.stringify({ event: "membership_list_error", requestId, actorId: actor.id, organizationId }));
    return errorResponse(request, 500, "Daftar anggota organisasi tidak dapat dimuat.", requestId, config.allowedOrigins);
  }

  try {
    const membershipRows = (memberships ?? []) as MembershipRow[];
    const assignmentByUser = new Map<string, string[]>();
    if (membershipRows.length) {
      const { data: assignmentRows, error: assignmentError } = await adminClient
        .from("satria_membership_opds")
        .select("user_id,opd_id")
        .eq("organization_id", organizationId)
        .in("user_id", membershipRows.map((row) => row.user_id));
      if (assignmentError) throw new Error("OPD assignments could not be loaded");
      for (const assignment of assignmentRows ?? []) {
        const ids = assignmentByUser.get(assignment.user_id) ?? [];
        ids.push(assignment.opd_id);
        assignmentByUser.set(assignment.user_id, ids);
      }
    }

    const users = await mapWithConcurrency(membershipRows, AUTH_LOOKUP_CONCURRENCY, async (row) => {
      const { data, error } = await adminClient.auth.admin.getUserById(row.user_id);
      if (error || !data.user) throw new Error("Auth user lookup failed");
      const user = data.user;
      const email = typeof user.email === "string" ? user.email : "";
      const fallbackName = email || "Pengguna tanpa nama";
      return {
        id: user.id,
        email,
        display_name: cleanDisplayName(user.user_metadata?.full_name, fallbackName),
        role: row.role,
        active: row.active,
        membership_created_at: row.created_at,
        auth_created_at: user.created_at,
        opd_ids: (assignmentByUser.get(row.user_id) ?? []).sort(),
        opd_names: (assignmentByUser.get(row.user_id) ?? []).map((id) => opdNameById.get(id)).filter((name): name is string => !!name),
      };
    });

    console.info(JSON.stringify({ event: "admin_user_listed", requestId, actorId: actor.id, organizationId, page, returned: users.length }));
    return jsonResponse(request, 200, {
      ok: true,
      api_version: "satria-admin-users-v2",
      organization_id: organizationId,
      page,
      page_size: pageSize,
      total: count ?? 0,
      users,
      opds: (opds ?? []).map((opd) => ({ id: opd.opd_id, name: opd.name, code: opd.code })),
      snapshot_version: Number(stateRow?.version) || null,
      ...(action === "sync_local_catalog" ? { catalog_sync: { synced: true, count: catalogSyncCount } } : {}),
      request_id: requestId,
    }, config.allowedOrigins);
  } catch {
    console.error(JSON.stringify({ event: "auth_user_lookup_error", requestId, actorId: actor.id, organizationId }));
    return errorResponse(request, 503, "Data Auth sebagian tidak dapat diverifikasi; daftar tidak ditampilkan. Coba lagi.", requestId, config.allowedOrigins);
  }
});
