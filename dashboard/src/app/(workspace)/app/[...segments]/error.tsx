"use client";

import { Notice } from "@/shared/ui/common";

export default function SectionError({ retry }: { retry: () => void }) {
  return (
    <div className="page-stack">
      <Notice tone="error">This section couldn’t load. Try again.</Notice>
      <div className="button-row align-end">
        <button type="button" className="button accent" onClick={retry}>
          Try again
        </button>
      </div>
    </div>
  );
}
