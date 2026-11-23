"use client";

import { useRouter } from "next/navigation";
import { AuthPanel } from "./auth-panel";

export function AccountLinkPanel({
  mode,
}: {
  mode: "register" | "reset" | "verify";
}) {
  const router = useRouter();
  return (
    <AuthPanel
      initialMode={mode}
      onSignedIn={() => {
        if (mode === "register") window.location.replace("/app");
        else router.push("/app");
      }}
    />
  );
}
