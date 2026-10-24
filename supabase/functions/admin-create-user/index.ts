import { createClient } from "npm:@supabase/supabase-js@2";

type NewRole = "admin" | "operator";
type CreateUserBody = {
  organization_id: string;
  email: string;
  role: NewRole;
  initial_password: string;
  display_name?: string;
  opd_ids?: unknown;
  year_ids?: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 32_768;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const MAX_OPD_ASSIGNMENTS = 100;
const MAX_YEAR_ASSIGNMENTS = 40;

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

function response(
  request: Request,
  status: number,
  payload: Record<string, unknown>,
  allowedOrigins?: Set<string>,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  const origin = request.headers.get("Origin");
  if (origin && allowedOrigins?.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, apikey, x-client-info, content-type, x-supabase-api-version");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function normalizeDisplayName(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("display_name must be text");
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned.length < 2 || cleaned.length > 100) throw new Error("display_name must be 2–100 characters");
  return cleaned;
}

function normalizeOpdIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_OPD_ASSIGNMENTS) {
    throw new Error("Pilih minimal satu OPD dan maksimal 100 OPD.");
  }
  const ids = value.map((item) => {
    if (typeof item !== "string") throw new Error("Identitas OPD tidak valid.");
    const id = item.trim();
    if (!id || id.length > 128) throw new Error("Identitas OPD tidak valid.");
    return id;
  });
  if (new Set(ids).size !== ids.length) throw new Error("Terdapat pilihan OPD yang duplikat.");
  return ids;
}

function normalizeYears(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_YEAR_ASSIGNMENTS) {
    throw new Error("Pilih minimal satu tahun anggaran dan maksimal 40 tahun.");
  }
  const years = value.map((item) => {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 2000 || item > 2200) {
      throw new Error("Tahun anggaran harus berupa angka bulat antara 2000 dan 2200.");
    }
    return item;
  });
  if (new Set(years).size !== years.length) throw new Error("Terdapat tahun anggaran yang duplikat.");
  return years.sort((a, b) => a - b);
}

Deno.serve(async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID();
  let config: ReturnType<typeof getConfig>;
  try {
    config = getConfig();
  } catch (error) {
    console.error(JSON.stringify({ event: "config_error", requestId, type: error instanceof Error ? error.name : "unknown" }));
    return response(request, 500, { error: "Fungsi belum dikonfigurasi dengan benar.", request_id: requestId });
  }

  const origin = request.headers.get("Origin");
  if (origin && !config.allowedOrigins.has(origin)) {
    return response(request, 403, { error: "Origin tidak diizinkan.", request_id: requestId }, config.allowedOrigins);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: origin && config.allowedOrigins.has(origin)
        ? new Headers({
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        })
        : new Headers({ "Vary": "Origin" }),
    });
  }
  if (request.method !== "POST") {
    return response(request, 405, { error: "Gunakan POST.", request_id: requestId }, config.allowedOrigins);
  }
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) {
    return response(request, 415, { error: "Content-Type harus application/json.", request_id: requestId }, config.allowedOrigins);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return response(request, 413, { error: "Isi permintaan terlalu besar.", request_id: requestId }, config.allowedOrigins);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return response(request, 413, { error: "Isi permintaan terlalu besar.", request_id: requestId }, config.allowedOrigins);
  }

  let body: CreateUserBody;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body must be an object");
    const candidate = parsed as Record<string, unknown>;
    const allowedFields = new Set(["organization_id", "email", "role", "initial_password", "display_name", "opd_ids", "year_ids"]);
    if (Object.keys(candidate).some((key) => !allowedFields.has(key))) throw new Error("unexpected field");
    body = candidate as CreateUserBody;
  } catch {
    return response(request, 400, { error: "JSON tidak valid atau berisi properti yang tidak didukung.", request_id: requestId }, config.allowedOrigins);
  }

  const organizationId = typeof body.organization_id === "string" ? body.organization_id.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role;
  const initialPassword = typeof body.initial_password === "string" ? body.initial_password : "";
  let displayName: string | undefined;
  try {
    displayName = normalizeDisplayName(body.display_name);
  } catch {
    return response(request, 400, { error: "Nama tampilan tidak valid.", request_id: requestId }, config.allowedOrigins);
  }

  if (!UUID_RE.test(organizationId)) {
    return response(request, 400, { error: "Organization UUID tidak valid.", request_id: requestId }, config.allowedOrigins);
  }
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return response(request, 400, { error: "Alamat email tidak valid.", request_id: requestId }, config.allowedOrigins);
  }
  if (initialPassword.length < MIN_PASSWORD_LENGTH || initialPassword.length > MAX_PASSWORD_LENGTH) {
    return response(request, 400, { error: `Password awal harus ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} karakter.`, request_id: requestId }, config.allowedOrigins);
  }
  if (role !== "operator" && role !== "admin") {
    return response(request, 400, { error: "Role harus admin atau operator.", request_id: requestId }, config.allowedOrigins);
  }
  if (role === "admin" && Deno.env.get("ALLOW_ADMIN_CREATION") !== "true") {
    return response(request, 403, { error: "Pembuatan admin baru belum diaktifkan.", request_id: requestId }, config.allowedOrigins);
  }

  let opdIds: string[] = [];
  if (role === "operator") {
    try {
      opdIds = normalizeOpdIds(body.opd_ids);
    } catch (error) {
      return response(request, 400, { error: error instanceof Error ? error.message : "Penetapan OPD tidak valid.", request_id: requestId }, config.allowedOrigins);
    }
  } else if (body.opd_ids !== undefined && (!Array.isArray(body.opd_ids) || body.opd_ids.length > 0)) {
    return response(request, 400, { error: "Admin memiliki akses organisasi; assignment OPD tidak perlu dikirim.", request_id: requestId }, config.allowedOrigins);
  }

  let yearIds: number[] = [];
  if (role === "operator") {
    try {
      yearIds = normalizeYears(body.year_ids);
    } catch (error) {
      return response(request, 400, { error: error instanceof Error ? error.message : "Penetapan tahun tidak valid.", request_id: requestId }, config.allowedOrigins);
    }
  } else if (body.year_ids !== undefined && (!Array.isArray(body.year_ids) || body.year_ids.length > 0)) {
    return response(request, 400, { error: "Admin memiliki akses seluruh tahun; assignment tahun tidak perlu dikirim.", request_id: requestId }, config.allowedOrigins);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return response(request, 401, { error: "Sesi login admin diperlukan.", request_id: requestId }, config.allowedOrigins);
  }

  const authClient = createClient(config.url, config.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(match[1]);
  if (authError || !authData.user) {
    return response(request, 401, { error: "Sesi tidak valid atau sudah kedaluwarsa.", request_id: requestId }, config.allowedOrigins);
  }
  const actor = authData.user;

  const adminClient = createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: membership, error: membershipLookupError } = await adminClient
    .from("satria_memberships")
    .select("role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", actor.id)
    .maybeSingle();

  if (membershipLookupError) {
    console.error(JSON.stringify({ event: "membership_lookup_error", requestId, actorId: actor.id, organizationId }));
    return response(request, 500, { error: "Tidak dapat memverifikasi hak admin.", request_id: requestId }, config.allowedOrigins);
  }
  if (!membership || membership.role !== "admin" || membership.active !== true) {
    return response(request, 403, { error: "Hanya admin aktif pada organisasi ini yang dapat membuat pengguna.", request_id: requestId }, config.allowedOrigins);
  }

  const { data: withinLimit, error: rateLimitError } = await adminClient.rpc(
    "satria_consume_user_creation_rate_limit",
    { p_actor_user_id: actor.id, p_organization_id: organizationId },
  );
  if (rateLimitError) {
    console.error(JSON.stringify({ event: "rate_limit_error", requestId, actorId: actor.id, organizationId }));
    return response(request, 503, { error: "Kontrol laju pembuatan pengguna belum siap; permintaan ditolak.", request_id: requestId }, config.allowedOrigins);
  }
  if (withinLimit !== true) {
    return response(request, 429, { error: "Batas pembuatan pengguna tercapai. Coba lagi beberapa saat.", request_id: requestId }, config.allowedOrigins);
  }

  // Password awal hanya digunakan pada request ini. Jangan pernah mencatat atau mengembalikannya.
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    ...(displayName ? { user_metadata: { full_name: displayName } } : {}),
  });
  const createdUser = createData?.user;
  if (createError || !createdUser) {
    console.error(JSON.stringify({ event: "auth_user_create_error", requestId, actorId: actor.id, organizationId, status: createError?.status ?? 0 }));
    return response(request, 409, { error: "Akun tidak dapat dibuat. Pastikan email unik dan memenuhi format Auth.", request_id: requestId }, config.allowedOrigins);
  }

  const { error: insertMembershipError } = await adminClient
    .from("satria_memberships")
    .insert({ organization_id: organizationId, user_id: createdUser.id, role, active: true, login_email: email, display_name: displayName });

  if (insertMembershipError) {
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdUser.id);
    console.error(JSON.stringify({
      event: "membership_insert_failed",
      requestId,
      actorId: actor.id,
      organizationId,
      targetUserId: createdUser.id,
      insertCode: insertMembershipError.code ?? "unknown",
      rollbackSucceeded: !rollbackError,
    }));
    return response(request, 500, {
      error: rollbackError
        ? "Membership gagal dibuat dan akun perlu diperiksa admin proyek."
        : "Membership gagal dibuat; akun yang baru dibuat sudah dibatalkan.",
      request_id: requestId,
    }, config.allowedOrigins);
  }

  if (role === "operator") {
    const { error: assignmentError } = await adminClient.rpc("satria_admin_set_membership_opds", {
      p_organization_id: organizationId,
      p_actor_user_id: actor.id,
      p_target_user_id: createdUser.id,
      p_opd_ids: opdIds,
    });
    if (assignmentError) {
      const { error: membershipRollbackError } = await adminClient
        .from("satria_memberships")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", createdUser.id);
      const { error: authRollbackError } = await adminClient.auth.admin.deleteUser(createdUser.id);
      console.error(JSON.stringify({
        event: "opd_assignment_failed",
        requestId,
        actorId: actor.id,
        organizationId,
        targetUserId: createdUser.id,
        assignmentCode: assignmentError.code ?? "unknown",
        rollbackSucceeded: !membershipRollbackError && !authRollbackError,
      }));
      return response(request, 400, {
        error: membershipRollbackError || authRollbackError
          ? "Penetapan OPD gagal; pembersihan akun tidak tuntas. Admin proyek perlu memeriksa akun tersebut."
          : "Penetapan OPD gagal. Akun baru sudah dibatalkan; periksa katalog OPD dan jalankan migrasi assignment.",
        request_id: requestId,
      }, config.allowedOrigins);
    }
  }

  if (role === "operator") {
    const { error: yearAssignmentError } = await adminClient.rpc("satria_admin_set_membership_years", {
      p_organization_id: organizationId,
      p_actor_user_id: actor.id,
      p_target_user_id: createdUser.id,
      p_years: yearIds,
    });
    if (yearAssignmentError) {
      const { error: membershipRollbackError } = await adminClient
        .from("satria_memberships")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", createdUser.id);
      const { error: authRollbackError } = await adminClient.auth.admin.deleteUser(createdUser.id);
      console.error(JSON.stringify({
        event: "year_assignment_failed",
        requestId,
        actorId: actor.id,
        organizationId,
        targetUserId: createdUser.id,
        assignmentCode: yearAssignmentError.code ?? "unknown",
        rollbackSucceeded: !membershipRollbackError && !authRollbackError,
      }));
      return response(request, 400, {
        error: membershipRollbackError || authRollbackError
          ? "Penetapan tahun gagal; pembersihan akun tidak tuntas. Admin proyek perlu memeriksa akun tersebut."
          : "Penetapan tahun gagal. Akun baru sudah dibatalkan; terapkan migrasi scope OPD/tahun terbaru.",
        request_id: requestId,
      }, config.allowedOrigins);
    }
  }

  const { error: auditError } = await adminClient.from("satria_admin_audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: actor.id,
    target_user_id: createdUser.id,
    action: "user_created",
    details: { role, email_confirmed: true, opd_ids: role === "operator" ? opdIds : [], year_ids: role === "operator" ? yearIds : [] },
  });
  if (auditError) {
    console.error(JSON.stringify({ event: "audit_insert_failed", requestId, actorId: actor.id, organizationId, targetUserId: createdUser.id }));
  }

  console.info(JSON.stringify({ event: "user_created", requestId, actorId: actor.id, organizationId, targetUserId: createdUser.id, role }));
  return response(request, 201, {
    ok: true,
    user: { id: createdUser.id, email: createdUser.email },
    role,
    opd_ids: role === "operator" ? opdIds : [],
    year_ids: role === "operator" ? yearIds : [],
    email_confirmed: true,
    email_sent: false,
    audit_recorded: !auditError,
    request_id: requestId,
  }, config.allowedOrigins);
});
