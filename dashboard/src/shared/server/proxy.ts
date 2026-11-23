import "server-only";
import { NextRequest, NextResponse } from "next/server";
import contract from "../../../../contracts/openapi/api.v1.json";

function sessionCookies(url: URL) {
  const prefix = url.protocol === "https:" ? "__Host-" : "";
  return {
    accessCookie: prefix + "netsentry_access",
    refreshCookie: prefix + "netsentry_refresh",
  };
}
const sessionPaths = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
]);
const publicPaths = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/password/forgot",
  "/auth/password/reset",
  "/auth/verification/confirm",
  "/privacy/disclosures",
]);
const forbidden = new Set([
  "/billing/events",
  "/devices/enrol",
  "/agents/enrol",
  "/workspaces/devices",
]);
const operations = Object.entries(contract.paths).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(
      ([, operation]) =>
        !(
          "security" in operation &&
          (JSON.stringify(operation.security).includes("deviceTokenAuth") ||
            JSON.stringify(operation.security).includes("agentTokenAuth"))
        ) && !forbidden.has(path),
    )
    .map(([method]) => ({
      method: method.toUpperCase(),
      pattern: new RegExp(
        "^" + path.replace(/\{[^}]+\}/g, "[a-fA-F0-9-]{36}") + "$",
      ),
    })),
);
function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}
function failure(status: number, message: string, code?: string) {
  return response(
    { statusCode: status, message, ...(code ? { code } : {}) },
    status,
  );
}
function origin(request: NextRequest) {
  const configured = process.env.DASHBOARD_ORIGIN;
  const url = new URL(configured ?? request.nextUrl.origin);
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new Error("Invalid dashboard origin");
  if (
    process.env.NODE_ENV === "production" &&
    (!configured ||
      (url.protocol !== "https:" &&
        !["127.0.0.1", "localhost"].includes(url.hostname)))
  )
    throw new Error("Configure a secure dashboard origin");
  return url;
}
export function sameOrigin(request: NextRequest) {
  return (
    request.headers.get("origin") === origin(request).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export function clearSession(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return failure(403, "This action must come from this dashboard.");
    const { accessCookie, refreshCookie } = sessionCookies(origin(request));
    const result = response({ cleared: true });
    for (const name of [accessCookie, refreshCookie])
      result.cookies.set(name, "", {
        httpOnly: true,
        sameSite: "strict",
        secure: origin(request).protocol === "https:",
        path: "/",
        maxAge: 0,
      });
    return result;
  } catch {
    return failure(503, "The dashboard connection is not configured.");
  }
}
class SizeLimitError extends Error {}
async function boundedText(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
) {
  const reader = body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new SizeLimitError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function boundedJSON(upstream: Response) {
  return JSON.parse(await boundedText(upstream.body, 16 * 1024 * 1024));
}
export async function proxy(request: NextRequest, segments: string[]) {
  const path = "/" + segments.join("/");
  if (
    !operations.some(
      (op) => op.method === request.method && op.pattern.test(path),
    )
  )
    return failure(404, "This dashboard action is unavailable.");
  try {
    const expected = origin(request);
    const { accessCookie, refreshCookie } = sessionCookies(expected);
    if (request.method !== "GET" && !sameOrigin(request))
      return failure(403, "This action must come from this dashboard.");
    const base = new URL(
      process.env.NETSENTRY_API_URL ?? "http://127.0.0.1:3000/api/v1",
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.hash ||
      base.search ||
      (process.env.NODE_ENV === "production" &&
        base.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(base.hostname))
    )
      return failure(503, "The dashboard connection is not configured.");
    const refresh = request.cookies.get(refreshCookie)?.value;
    const access = request.cookies.get(accessCookie)?.value;
    const refreshLogout = path === "/auth/logout/refresh";
    const usesRefresh = path === "/auth/refresh" || refreshLogout;
    const credential = usesRefresh ? refresh : access;
    if (!publicPaths.has(path) && !credential)
      return failure(401, "Sign in to continue.");
    if (!publicPaths.has(path) && path !== "/auth/refresh") {
      const actor = request.headers.get("x-netsentry-user");
      if (request.method !== "GET" && !actor)
        return failure(
          400,
          "Refresh your account context before making changes.",
        );
      if (actor) {
        let subject: unknown;
        try {
          subject = JSON.parse(
            Buffer.from(credential!.split(".")[1], "base64url").toString(
              "utf8",
            ),
          ).sub;
        } catch {
          return failure(401, "Sign in to continue.");
        }
        // This is an identity fence, not JWT verification. The backend still validates signature/session/permissions.
        if (actor !== subject)
          return failure(
            409,
            "Your account changed in another tab. Reload before continuing.",
            "SESSION_CHANGED",
          );
      }
    }
    let body: string | undefined;
    if (request.method !== "GET") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return failure(415, "Use a JSON request.");
      let raw: string;
      try {
        raw = await boundedText(request.body, 65536);
      } catch (error) {
        if (error instanceof SizeLimitError)
          return failure(413, "This request is too large.");
        throw error;
      }
      try {
        body = JSON.stringify(
          usesRefresh ? { refreshToken: refresh } : JSON.parse(raw || "{}"),
        );
      } catch {
        return failure(400, "This request contains invalid JSON.");
      }
    }
    const target =
      base.toString().replace(/\/$/, "") + path + request.nextUrl.search;
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        "user-agent":
          request.headers.get("user-agent") ?? "NetSentry dashboard",
        ...(access && !usesRefresh
          ? { authorization: `Bearer ${access}` }
          : {}),
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const data = await boundedJSON(upstream);
    if (!upstream.ok) {
      // Only forward the structured API error, never arbitrary upstream payloads or headers.
      const result = response(
        {
          statusCode: upstream.status,
          message:
            typeof data.message === "string"
              ? data.message
              : "This request could not be completed.",
          ...(typeof data.requestId === "string"
            ? { requestId: data.requestId }
            : {}),
          ...(Array.isArray(data.details) ? { details: data.details } : {}),
        },
        upstream.status,
      );
      const retry = upstream.headers.get("retry-after");
      if (retry && /^\d{1,5}$/.test(retry))
        result.headers.set("retry-after", retry);
      return result;
    }
    if (sessionPaths.has(path)) {
      if (
        typeof data.accessToken !== "string" ||
        typeof data.refreshToken !== "string" ||
        !data.user
      )
        return failure(502, "The account service returned an invalid session.");
      const result = response({ user: data.user }, upstream.status);
      for (const [name, token] of [
        [accessCookie, data.accessToken],
        [refreshCookie, data.refreshToken],
      ]) {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
        );
        if (!Number.isFinite(payload.exp))
          throw new Error("Invalid session expiry");
        result.cookies.set(name, token, {
          httpOnly: true,
          secure: expected.protocol === "https:",
          sameSite: "strict",
          path: "/",
          maxAge: Math.max(
            0,
            Math.min(30 * 86400, payload.exp - Math.floor(Date.now() / 1000)),
          ),
        });
      }
      return result;
    }
    const result = response(data, upstream.status);
    if (
      path === "/auth/logout" ||
      refreshLogout ||
      path === "/privacy/account" ||
      path === "/auth/password/reset"
    )
      for (const name of [accessCookie, refreshCookie])
        result.cookies.set(name, "", {
          httpOnly: true,
          secure: expected.protocol === "https:",
          sameSite: "strict",
          path: "/",
          maxAge: 0,
        });
    return result;
  } catch (error) {
    if (error instanceof SizeLimitError)
      return failure(
        502,
        "This response exceeds the 16 MiB browser download limit. Narrow the report or contact your administrator for a larger export.",
      );
    return failure(
      503,
      "Cannot reach NetSentry right now. Check the dashboard connection and try again.",
    );
  }
}
