import "server-only";
import { NextRequest, NextResponse } from "next/server";
import contract from "../../../../contracts/openapi/api.v1.json";

const accessCookie = "netsentry_access";
const refreshCookie = "netsentry_refresh";
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
const forbidden = new Set(["/devices/enrol", "/workspaces/devices"]);
const operations = Object.entries(contract.paths).flatMap(([path, methods]) =>
  Object.entries(methods)
    .filter(
      ([, operation]) =>
        !(
          "security" in operation &&
          JSON.stringify(operation.security).includes("deviceTokenAuth")
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
function failure(status: number, message: string) {
  return response({ statusCode: status, message }, status);
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
async function boundedJSON(upstream: Response) {
  const reader = upstream.body?.getReader();
  if (!reader) throw new Error("Missing response");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
    if (path === "/auth/refresh" && !refresh)
      return failure(401, "Sign in to continue.");
    if (!publicPaths.has(path) && path !== "/auth/refresh" && !access)
      return failure(401, "Sign in to continue.");
    let body: string | undefined;
    if (request.method !== "GET") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return failure(415, "Use a JSON request.");
      const raw = await request.text();
      if (raw.length > 65536) return failure(413, "This request is too large.");
      try {
        body = JSON.stringify(
          path === "/auth/refresh"
            ? { refreshToken: refresh }
            : JSON.parse(raw || "{}"),
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
        ...(access ? { authorization: `Bearer ${access}` } : {}),
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
  } catch {
    return failure(
      503,
      "Cannot reach NetSentry right now. Check the dashboard connection and try again.",
    );
  }
}
