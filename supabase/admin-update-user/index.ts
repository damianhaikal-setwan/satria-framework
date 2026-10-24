import { createClient } from "npm:@supabase/supabase-js@2";

type UpdateUserBody = {
  organization_id: string;
  user_id: string;
  opd_ids: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 32_768;
const MAX_OPD_ASSIGNMENTS = 100;

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

function response(request: Request, status: number, payload: Record<string, unknown>, allowedOrigins: Set<string>): Response {
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
    return response(request, 403, { error: "Origin tidak diizinkan.", request_id: requestId }, config.allowedOrigins);
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

  let organizationId = "";
  let targetUserId = "";
  let opdIds: string[];
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body must be an object");
    const candidate = parsed as Record<string, unknown>;
    const allowedFields = new Set(["organization_id", "user_id", "opd_ids"]);
    if (Object.keys(candidate).some((key) => !allowedFields.has(key))) throw new Error("unexpected field");
    organizationId = typeof candidate.organization_id === "string" ? candidate.organization_id.trim() : "";
    targetUserId = typeof candidate.user_id === "string" ? candidate.user_id.trim() : "";
    if (!UUID_RE.test(organizationId) || !UUID_RE.test(targetUserId)) throw new Error("UUID tidak valid");
    opdIds = normalizeOpdIds(candidate.opd_ids);
  } catch (error) {
    const message = error instanceof Error && error.message !== "unexpected field" && error.message !== "body must be an object"
      ? error.message
      : "JSON tidak valid atau berisi properti yang tidak didukung.";
    return response(request, 400, { error: message, request_id: requestId }, config.allowedOrigins);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return response(request, 401, { error: "Sesi login admin diperlukan.", request_id: requestId }, config.allowedOrigins);

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

  const { data: membership, error: membershipError } = await adminClient
    .from("satria_memberships")
    .select("role,active")
    .eq("organization_id", organizationId)
    .eq("user_id", actor.id)
    .maybeSingle();
  if (membershipError) {
    console.error(JSON.stringify({ event: "membership_lookup_error", requestId, actorId: actor.id, organizationId }));
    return response(request, 500, { error: "Tidak dapat memverifikasi hak admin.", request_id: requestId }, config.allowedOrigins);
  }
  if (!membership || membership.role !== "admin" || membership.active !== true) {
    return response(request, 403, { error: "Hanya admin aktif organisasi yang dapat mengubah assignment OPD.", request_id: requestId }, config.allowedOrigins);
  }

  const { data: target, error: targetError } = await adminClient
    .from("satria_memberships")
    .select("role,active")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (targetError) {
    console.error(JSON.stringify({ event: "target_membership_lookup_error", requestId, actorId: actor.id, organizationId, targetUserId }));
    return response(request, 500, { error: "Membership pengguna target tidak dapat diperiksa.", request_id: requestId }, config.allowedOrigins);
  }
  if (!target || target.role !== "operator" || target.active !== true) {
    return response(request, 404, { error: "User operator aktif tidak ditemukan pada organisasi ini.", request_id: requestId }, config.allowedOrigins);
  }

  const { data: savedCount, error: assignmentError } = await adminClient.rpc("satria_admin_set_membership_opds", {
    p_organization_id: organizationId,
    p_actor_user_id: actor.id,
    p_target_user_id: targetUserId,
    p_opd_ids: opdIds,
  });
  if (assignmentError) {
    console.error(JSON.stringify({ event: "opd_assignment_update_error", requestId, actorId: actor.id, organizationId, targetUserId, code: assignmentError.code ?? "unknown" }));
    return response(request, 400, { error: "Assignment OPD tidak dapat disimpan. Pastikan katalog OPD sudah diperbarui dan migrasi assignment telah dijalankan.", request_id: requestId }, config.allowedOrigins);
  }

  const { error: auditError } = await adminClient.from("satria_admin_audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: actor.id,
    target_user_id: targetUserId,
    action: "user_opd_assignment_updated",
    details: { opd_ids: opdIds, assignment_count: Number(savedCount) || opdIds.length },
  });
  if (auditError) {
    console.error(JSON.stringify({ event: "opd_assignment_audit_error", requestId, actorId: actor.id, organizationId, targetUserId }));
  }

  console.info(JSON.stringify({ event: "opd_assignment_updated", requestId, actorId: actor.id, organizationId, targetUserId, assignmentCount: opdIds.length }));
  return response(request, 200, {
    ok: true,
    user_id: targetUserId,
    opd_ids: opdIds,
    assignment_count: Number(savedCount) || opdIds.length,
    audit_recorded: !auditError,
    request_id: requestId,
  }, config.allowedOrigins);
});
