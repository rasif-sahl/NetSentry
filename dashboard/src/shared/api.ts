export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public details?: string[],
    public code?: string,
  ) {
    super(message);
  }
}
let refresh: Promise<void> | undefined;
let epoch = 0;
let closing = false;
let actorId: string | undefined;
export function adoptActor(id: string | undefined) {
  actorId = id;
}
let tabId: string | undefined;
function currentTab() {
  return (tabId ??= crypto.randomUUID());
}
export function announceSession(type: "changed" | "ended") {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel("netsentry-session-events");
  channel.postMessage({ type, tabId: currentTab() });
  channel.close();
}
export function listenForSessionChanges(
  onChange: (type: "changed" | "ended") => void,
) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel("netsentry-session-events");
  channel.onmessage = (event) => {
    if (
      event.data?.tabId !== currentTab() &&
      ["changed", "ended"].includes(event.data?.type)
    )
      onChange(event.data.type);
  };
  return () => channel.close();
}
export function beginSession(id: string) {
  actorId = id;
  closing = false;
  epoch++;
  announceSession("changed");
}
async function send(
  path: string,
  method: string,
  body?: unknown,
  signal?: AbortSignal,
  actor = actorId,
) {
  const response = await fetch(`/api/backend${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(actor ? { "x-netsentry-user": actor } : {}),
    },
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
      data.code,
    );
  return data;
}
async function sessionLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("netsentry-session", work);
  return work();
}
async function renewSession() {
  await sessionLock(async () => {
    try {
      await send("/auth/me", "GET");
      return;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    await send("/auth/refresh", "POST", {});
  });
  epoch++;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const started = epoch;
  const actor = actorId;
  try {
    const mutation =
      [
        "/auth/login",
        "/auth/register",
        "/auth/password/reset",
        "/privacy/account",
      ].includes(path) && method !== "GET";
    const result = (await (mutation
      ? sessionLock(() => send(path, method, body, signal, actor))
      : send(path, method, body, signal, actor))) as T;
    if (path === "/auth/password/reset" && method === "POST")
      announceSession("ended");
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.code === "SESSION_CHANGED") {
      window.location.reload();
      throw error;
    }
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
      refresh ??= renewSession().finally(() => {
        refresh = undefined;
      });
      await refresh;
    }
    return (await sessionLock(() =>
      send(path, method, body, signal, actor),
    )) as T;
  }
}
export async function signOut() {
  closing = true;
  await refresh?.catch(() => undefined);
  return sessionLock(async () => {
    let revoked = true;
    try {
      await send("/auth/logout", "POST", {}).catch((error) => {
        if (error instanceof ApiError && error.status === 401)
          return send("/auth/logout/refresh", "POST", {});
        throw error;
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "SESSION_CHANGED") {
        closing = false;
        window.location.reload();
        throw error;
      }
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
    actorId = undefined;
    announceSession("ended");
    return revoked;
  });
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
