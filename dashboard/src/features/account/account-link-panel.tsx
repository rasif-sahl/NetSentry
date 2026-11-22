"use client";

import { useRouter } from "next/navigation";
import { AuthPanel } from "./auth-panel";

export function AccountLinkPanel({ mode }: { mode: "reset" | "verify" }) {
  const router = useRouter();
  return (
    <AuthPanel initialMode={mode} onSignedIn={() => router.push("/app")} />
  );
}
