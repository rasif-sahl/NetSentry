"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";
import { PublicLoading } from "@/shared/ui/loading";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  return pending ? createPortal(<PublicLoading />, document.body) : null;
}

export default function PublicLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingNavigation />
    </Link>
  );
}
