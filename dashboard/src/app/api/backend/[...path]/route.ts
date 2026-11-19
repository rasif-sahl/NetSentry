import type { NextRequest } from "next/server";
import { proxy } from "@/shared/server/proxy";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, (await context.params).path);
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
