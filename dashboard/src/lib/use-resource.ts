"use client";
import { useEffect, useReducer, useState } from "react";
import { api, ApiError } from "./api";
export function useResource<T>(path: string | null, poll = false) {
  const [revision, reload] = useReducer((n) => n + 1, 0);
  const [state, setState] = useState<{
    path: string;
    data?: T;
    error?: unknown;
    updatedAt?: string;
  }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let running = false;
    async function load() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const data = await api<T>(path!, "GET", undefined, controller.signal);
        if (!controller.signal.aborted)
          setState({ path: path!, data, updatedAt: new Date().toISOString() });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState((previous) => ({
            ...(previous?.path === path &&
            !(error instanceof ApiError && [401, 403].includes(error.status))
              ? previous
              : {}),
            path: path!,
            error,
          }));
          if (error instanceof ApiError && error.status === 401)
            window.dispatchEvent(new Event("netsentry:expired"));
        }
      } finally {
        running = false;
      }
    }
    void load();
    const manual = () => void load();
    window.addEventListener("netsentry:refresh", manual);
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void load();
    };
    const timer = poll ? window.setInterval(check, 30000) : undefined;
    if (poll) {
      window.addEventListener("online", check);
      document.addEventListener("visibilitychange", check);
    }
    return () => {
      controller.abort();
      window.removeEventListener("netsentry:refresh", manual);
      clearInterval(timer);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [path, revision, poll]);
  const current = state?.path === path ? state : undefined;
  return {
    data: current?.data,
    error: current?.error,
    updatedAt: current?.updatedAt,
    loading: !!path && !current,
    reload,
  };
}
