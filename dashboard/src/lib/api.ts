export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public details?: string[],
  ) {
    super(message);
  }
}
let refresh: Promise<void> | undefined;
let epoch = 0;
let closing = false;
export function beginSession() {
  closing = false;
  epoch++;
}
async function send(
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/backend${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.message ?? "This request could not be completed.",
      data.requestId,
      data.details,
    );
  return data;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const started = epoch;
  try {
    return (await send(path, method, body, signal)) as T;
  } catch (error) {
    const isPublic =
      /^(\/auth\/(login|register|password\/|verification\/confirm)|\/privacy\/disclosures)/.test(
        path,
      );
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      isPublic ||
      path === "/auth/refresh" ||
      closing ||
      signal?.aborted
    )
      throw error;
    if (started === epoch) {
      refresh ??= send("/auth/refresh", "POST", {})
        .then(() => {
          epoch++;
        })
        .finally(() => {
          refresh = undefined;
        });
      await refresh;
    }
    return (await send(path, method, body, signal)) as T;
  }
}
export async function signOut() {
  closing = true;
  await refresh?.catch(() => undefined);
  let revoked = true;
  try {
    await send("/auth/logout", "POST", {});
  } catch {
    revoked = false;
  }
  const cleared = await fetch("/api/session/clear", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (!cleared.ok)
    throw new ApiError(
      cleared.status,
      "Could not clear this browser session. Please try again.",
    );
  epoch++;
  return revoked;
}
export function download(
  content: string,
  fileName: string,
  contentType: string,
) {
  const url = URL.createObjectURL(new Blob([content], { type: contentType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
