import adminHtml from "../admin/index.html";
import adminCss from "../admin/style.css";
import adminJs from "../admin/app.js.txt";
import {
  ApiError,
  fail,
  body,
  checkWrite,
  publicOrigin,
  rate,
  uuid,
} from "./security.js";
import {
  catalog,
  enquiry,
  checkout,
  viewOffer,
  acceptOffer,
} from "./commerce.js";
import { adminRoute } from "./admin-api.js";
import { pruneExpired } from "./retention.js";
function response(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}
function secure(result, request, env, isApi = false) {
  const headers = new Headers(result.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(request.url).protocol === "https:")
    headers.set("Strict-Transport-Security", "max-age=31536000");
  if (isApi) headers.set("Cache-Control", "no-store");
  const path = new URL(request.url).pathname;
  if (path.startsWith("/admin")) {
    headers.set("Cache-Control", "no-store");
    headers.set(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://oarts.cz; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
  }
  if (isApi && !path.startsWith("/api/admin")) {
    const origin = publicOrigin(request, env);
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, X-NFW-Request",
      );
      headers.set("Access-Control-Max-Age", "600");
    }
  }
  return new Response(result.body, { status: result.status, headers });
}
export default {
  async scheduled(event, env, ctx) {
    await pruneExpired(env);
  },
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    const isApi = path.startsWith("/api/");
    try {
      if (path === "/admin" || path === "/admin/")
        return secure(
          new Response(adminHtml, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
          request,
          env,
        );
      if (path === "/admin/style.css")
        return secure(
          new Response(adminCss, {
            headers: { "Content-Type": "text/css; charset=utf-8" },
          }),
          request,
          env,
        );
      if (path === "/admin/app.js")
        return secure(
          new Response(adminJs, {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          }),
          request,
          env,
        );
      if (path.startsWith("/admin/"))
        return secure(
          response(
            { error: { code: "NOT_FOUND", message: "Stránka neexistuje." } },
            404,
          ),
          request,
          env,
        );
      if (isApi) {
        if (request.method === "OPTIONS") {
          if (path.startsWith("/api/admin") || !publicOrigin(request, env))
            fail(403, "ORIGIN_DENIED", "Nepovolený přístup.");
          return secure(
            new Response(null, { status: 204 }),
            request,
            env,
            true,
          );
        }
        if (path.startsWith("/api/admin/")) {
          const result = await adminRoute(request, env, path);
          return secure(
            response(
              result.data,
              200,
              result.cookie ? { "Set-Cookie": result.cookie } : {},
            ),
            request,
            env,
            true,
          );
        }
        if (path === "/api/health" && request.method === "GET") {
          await env.DB.prepare("SELECT 1").first();
          return secure(
            response({ ok: true, service: "nfw-commerce" }),
            request,
            env,
            true,
          );
        }
        if (path === "/api/catalog" && request.method === "GET")
          return secure(response(await catalog(env)), request, env, true);
        if (request.method !== "POST")
          fail(404, "NOT_FOUND", "Požadovaná funkce neexistuje.");
        checkWrite(request, env);
        await rate(request, env, "public", 12, 600);
        const b = await body(request);
        let data;
        if (path === "/api/enquiries") data = await enquiry(env, b);
        else if (path === "/api/requests") {
          if (!["withdrawal", "complaint"].includes(b.kind))
            fail(422, "REQUEST_KIND", "Vyberte druh požadavku.");
          data = await enquiry(env, b, b.kind);
        } else if (path === "/api/checkout") data = await checkout(env, b);
        else if (path === "/api/offers/view")
          return secure(response(await viewOffer(env, b)), request, env, true);
        else if (path === "/api/offers/accept")
          data = await acceptOffer(env, b);
        else fail(404, "NOT_FOUND", "Požadovaná funkce neexistuje.");
        return secure(response(data, 201), request, env, true);
      }
      if (env.ASSETS) {
        if (path === "/" && ["GET", "HEAD"].includes(request.method))
          return env.ASSETS.fetch(
            new Request(new URL("/index.html", request.url), request),
          );
        return env.ASSETS.fetch(request);
      }
      if (["GET", "HEAD"].includes(request.method))
        return Response.redirect(env.SITE_URL || "https://oarts.cz", 302);
      return secure(
        response(
          { error: { code: "NOT_FOUND", message: "Stránka neexistuje." } },
          404,
        ),
        request,
        env,
      );
    } catch (error) {
      let status = 500,
        code = "INTERNAL",
        message = "Požadavek se nepodařilo dokončit. Zkuste to prosím znovu.";
      if (error instanceof ApiError) {
        status = error.status;
        code = error.code;
        message = error.message;
      } else if (
        /CHECK constraint|INVALID_ORDER_TRANSITION|UNIQUE constraint/.test(
          error?.message || "",
        )
      ) {
        status = 409;
        code = "CONFLICT";
        message =
          "Záznam se změnil nebo tuto změnu nelze provést. Obnovte data a zkontrolujte stav.";
      } else {
        console.error(
          JSON.stringify({
            event: "request_failed",
            requestId: uuid(),
            route: isApi ? "api" : "site",
            code: "INTERNAL",
          }),
        );
      }
      return secure(
        response({ error: { code, message } }, status),
        request,
        env,
        isApi,
      );
    }
  },
};
