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
    const started = Date.now(),
      response = await fetcher(origin + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
    if (
      response.status !== 200 ||
      !response.headers.get("strict-transport-security") ||
      response.headers.get("x-content-type-options") !== "nosniff"
    )
      throw new Error("HTTPS readiness/security check failed.");
    if (kind !== "dashboard") {
      const body = await response.text();
      if (body.length > 4096) throw new Error("Unexpected health response.");
      const value = JSON.parse(body);
      if (value.status !== (kind === "liveness" ? "ok" : "ready"))
        throw new Error("Dependency check failed.");
    } else await response.body?.cancel();
    checks.push({ kind, status: "ok", durationMs: Date.now() - started });
  }
  return { status: "ok", checks, physicalOrLiveAcceptance: false };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  try {
    console.log(JSON.stringify(await smokeHttps(process.argv[2])));
  } catch {
    console.error(
      "HTTPS smoke check failed. Verify certificate trust, ingress headers, readiness and dashboard. No URLs or response bodies are logged.",
    );
    process.exitCode = 1;
  }
}
