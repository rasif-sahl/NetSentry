import type { NextRequest } from "next/server";
import { clearSession } from "@/lib/server/proxy";
export function POST(request: NextRequest) {
  return clearSession(request);
}
