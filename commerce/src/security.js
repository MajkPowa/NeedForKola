export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const fail = (status, code, message) => {
  throw new ApiError(status, code, message);
};
export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export async function hash(value) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export function text(value, max = 500, required = false) {
  if (value === undefined || value === null) value = "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail(422, "INVALID_INPUT", "Zkontrolujte vyplněné údaje.");
  value = value.trim();
  if (required && !value)
    fail(422, "REQUIRED", "Vyplňte všechna povinná pole.");
  return value;
}
export function integer(value, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    fail(422, "INVALID_NUMBER", "Neplatná číselná hodnota.");
  return value;
}
export function email(value) {
  value = text(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    fail(422, "INVALID_EMAIL", "Zadejte platný e-mail.");
  return value;
}
export async function body(request, max = 32768) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    fail(415, "JSON_REQUIRED", "Požadavek musí používat JSON.");
  if (Number(request.headers.get("content-length")) > max)
    fail(413, "TOO_LARGE", "Požadavek je příliš dlouhý.");
  const reader = request.body?.getReader();
  if (!reader) fail(400, "EMPTY", "Chybí údaje.");
  let length = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      fail(413, "TOO_LARGE", "Požadavek je příliš dlouhý.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let result;
  try {
    result = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(400, "INVALID_JSON", "Neplatný požadavek.");
  }
  if (!result || Array.isArray(result) || typeof result !== "object")
    fail(400, "INVALID_JSON", "Neplatný požadavek.");
  return result;
}
export function publicOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const own = new URL(request.url).origin;
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((x) => x.trim());
  if (env.ENVIRONMENT === "test" || env.ENVIRONMENT === "development")
    allowed.push("http://127.0.0.1:8765", "http://localhost:8765");
  return origin === own || allowed.includes(origin) ? origin : null;
}
export function checkWrite(request, env, admin = false) {
  const origin = request.headers.get("Origin");
  const allowed = admin
    ? origin === new URL(request.url).origin
    : !!publicOrigin(request, env);
  if (!allowed || request.headers.get("X-NFW-Request") !== "1")
    fail(
      403,
      "ORIGIN_DENIED",
      "Tento požadavek nelze přijmout. Obnovte stránku.",
    );
}
export async function rate(request, env, scope, limit = 10, seconds = 600) {
  if (!env.SECURITY_SECRET)
    fail(503, "NOT_CONFIGURED", "Služba ještě není připravena.");
  const epoch = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(epoch / seconds);
  const key = await hash(
    env.SECURITY_SECRET +
      "|" +
      scope +
      "|" +
      (request.headers.get("CF-Connecting-IP") || "local") +
      "|" +
      bucket,
  );
  const row = await env.DB.prepare(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key, epoch + seconds)
    .first();
  if (row.count > limit)
    fail(429, "RATE_LIMIT", "Příliš mnoho pokusů. Zkuste to prosím později.");
}
export function cookie(request) {
  return (
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("__Host-nfw_admin="))
      ?.slice(17) || ""
  );
}
export async function session(request, env, write = false) {
  const raw = cookie(request);
  if (!/^[a-f0-9]{64}$/.test(raw))
    fail(401, "UNAUTHENTICATED", "Přihlaste se do administrace.");
  const row = await env.DB.prepare(
    "SELECT s.admin_id,s.csrf,s.expires_at,a.label FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.hash=? AND s.expires_at>? AND a.enabled=1",
  )
    .bind(await hash(raw), Math.floor(Date.now() / 1000))
    .first();
  if (!row) fail(401, "UNAUTHENTICATED", "Přihlášení vypršelo.");
  if (write) {
    checkWrite(request, env, true);
    const supplied = request.headers.get("X-CSRF-Token") || "";
    const [a, b] = await Promise.all([hash(supplied), hash(row.csrf)]);
    if (
      !crypto.subtle.timingSafeEqual(
        new TextEncoder().encode(a),
        new TextEncoder().encode(b),
      )
    )
      fail(403, "CSRF", "Obnovte přihlášení a zkuste to znovu.");
  }
  return row;
}
export const adminCookie = (token) =>
  "__Host-nfw_admin=" +
  token +
  "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800";
export const clearCookie =
  "__Host-nfw_admin=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0";
export const stmt = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
export function audit(env, actor, action, type, id, details = {}) {
  return stmt(
    env,
    "INSERT INTO audit(id,actor,action,entity_type,entity_id,details,created_at) VALUES(?,?,?,?,?,?,?)",
    uuid(),
    actor,
    action,
    type,
    id,
    JSON.stringify(details),
    now(),
  );
}
export function assertStatement(env, sql, ...args) {
  return stmt(
    env,
    "INSERT INTO assertions(ok) SELECT CASE WHEN (" +
      sql +
      ") THEN 1 ELSE 0 END",
    ...args,
  );
}
