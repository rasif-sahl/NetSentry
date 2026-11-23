"use client";
import { useState } from "react";
import { useResource } from "./use-resource";

type Page<T> = { items: T[]; nextCursor: string | null };

export function usePage<T>(path: string | null, poll = false) {
  const [navigation, setNavigation] = useState<{
    path: string | null;
    cursors: string[];
  }>({ path, cursors: [] });
  if (navigation.path !== path) setNavigation({ path, cursors: [] });
  const cursors = navigation.path === path ? navigation.cursors : [];
  const cursor = cursors.at(-1);
  const resource = useResource<Page<T>>(
    path && cursor
      ? `${path}${path.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
      : path,
    poll,
  );
  const nextCursor = resource.data?.nextCursor;
  return {
    ...resource,
    data: resource.data?.items,
    pageNumber: cursors.length + 1,
    hasNext: !!nextCursor,
    reset: () => setNavigation({ path, cursors: [] }),
    previous: () => setNavigation({ path, cursors: cursors.slice(0, -1) }),
    next: () => {
      if (nextCursor)
        setNavigation({ path, cursors: [...cursors, nextCursor] });
    },
  };
}
