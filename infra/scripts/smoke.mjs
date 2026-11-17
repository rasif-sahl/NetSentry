import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function smokeHttps(origin, fetcher = fetch) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.origin !== origin ||
    url.username ||
    url.password
  )
    throw new Error("Exact HTTPS origin required.");
  const checks = [];
  for (const [path, kind] of [
    ["/api/v1/health", "liveness"],
    ["/api/v1/ready", "readiness"],
    ["/", "dashboard"],
  ]) {
    const started = Date.now();
    let response;
    try {
      response = await fetcher(origin + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error("TLS_OR_CONNECTION_FAILED");
    }
    if (response.status !== 200)
      throw new Error(kind.toUpperCase() + "_STATUS_FAILED");
    if (
      !response.headers.get("strict-transport-security") ||
      response.headers.get("x-content-type-options") !== "nosniff"
    )
      throw new Error(kind.toUpperCase() + "_HEADERS_FAILED");
    if (kind !== "dashboard") {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 4096) throw new Error("HEALTH_BODY_INVALID");
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      const value = JSON.parse(body);
      if (value.status !== (kind === "liveness" ? "ok" : "ready"))
        throw new Error("HEALTH_BODY_INVALID");
    } else await response.body?.cancel();
    checks.push({ kind, status: "ok", durationMs: Date.now() - started });
  }
  return { status: "ok", checks, physicalOrLiveAcceptance: false };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  try {
    console.log(JSON.stringify(await smokeHttps(process.argv[2])));
  } catch (error) {
    const codes = new Set([
      "TLS_OR_CONNECTION_FAILED",
      "LIVENESS_STATUS_FAILED",
      "READINESS_STATUS_FAILED",
      "DASHBOARD_STATUS_FAILED",
      "LIVENESS_HEADERS_FAILED",
      "READINESS_HEADERS_FAILED",
      "DASHBOARD_HEADERS_FAILED",
      "HEALTH_BODY_INVALID",
    ]);
    const code = codes.has(error.message) ? error.message : "CHECK_FAILED";
    console.error(
      "HTTPS smoke check failed: " +
        code +
        ". No URLs or response bodies are logged.",
    );
    process.exitCode = 1;
  }
}
