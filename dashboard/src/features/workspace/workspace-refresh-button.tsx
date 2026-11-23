"use client";

import { RefreshCw } from "lucide-react";

export function WorkspaceRefreshButton({
  className = "",
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={`button ${iconOnly ? "size-11 shrink-0 px-0!" : ""} ${className}`}
      aria-label="Refresh workspace"
      onClick={() => window.dispatchEvent(new Event("netsentry:refresh"))}
    >
      {!iconOnly && <span className="refresh-label">Refresh workspace</span>}
      <RefreshCw
        className={iconOnly ? undefined : "refresh-icon"}
        size={18}
        aria-hidden="true"
      />
    </button>
  );
}
