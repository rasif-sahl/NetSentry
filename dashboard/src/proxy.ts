import { NextResponse, type NextRequest } from "next/server";
import { legacyWorkspaceHref } from "@/features/workspace/routes";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const view = url.searchParams.get("view");
  if (view === null) return NextResponse.next();
  url.pathname = legacyWorkspaceHref(view);
  url.searchParams.delete("view");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    { source: "/", has: [{ type: "query", key: "view" }] },
    { source: "/app", has: [{ type: "query", key: "view" }] },
  ],
};
