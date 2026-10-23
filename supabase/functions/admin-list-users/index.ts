import { createClient } from "npm:@supabase/supabase-js@2";

type ListUsersBody = {
  organization_id: string;
  page: number;
  page_size: number;
};

type MembershipRow = {
  user_id: string;
  role: "admin" | "operator" | "viewer";
  active: boolean;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8_192;
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
    const allowedFields = new Set(["organization_id", "page", "page_size"]);
    if (Object.keys(candidate).some((key) => !allowedFields.has(key))) throw new Error("unexpected field");
    body = candidate as ListUsersBody;
  } catch {
    return errorResponse(request, 400, "JSON tidak valid atau berisi properti yang tidak didukung.", requestId, config.allowedOrigins);
  }

  const organizationId = typeof body.organization_id === "string" ? body.organization_id.trim() : "";
  const page = body.page;
  const pageSize = body.page_size;
  if (!UUID_RE.test(organizationId)) {
    return errorResponse(request, 400, "Organization UUID tidak valid.", requestId, config.allowedOrigins);
  }
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
    return errorResponse(request, 400, `Nomor halaman harus bilangan bulat 1–${MAX_PAGE}.`, requestId, config.allowedOrigins);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    return errorResponse(request, 400, `Ukuran halaman harus bilangan bulat 1–${MAX_PAGE_SIZE}.`, requestId, config.allowedOrigins);
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
    const users = await mapWithConcurrency(memberships as MembershipRow[], AUTH_LOOKUP_CONCURRENCY, async (row) => {
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
      };
    });

    console.info(JSON.stringify({ event: "admin_user_listed", requestId, actorId: actor.id, organizationId, page, returned: users.length }));
    return jsonResponse(request, 200, {
      ok: true,
      organization_id: organizationId,
      page,
      page_size: pageSize,
      total: count ?? 0,
      users,
      request_id: requestId,
    }, config.allowedOrigins);
  } catch {
    console.error(JSON.stringify({ event: "auth_user_lookup_error", requestId, actorId: actor.id, organizationId }));
    return errorResponse(request, 503, "Data Auth sebagian tidak dapat diverifikasi; daftar tidak ditampilkan. Coba lagi.", requestId, config.allowedOrigins);
  }
});
