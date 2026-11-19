"use client";

import { useEffect, useState } from "react";

export function PolicyContents({
  sections,
  prefix = "privacy",
}: {
  sections: { id: string; title: string }[];
  prefix?: "privacy" | "terms";
}) {
  const [active, setActive] = useState(sections[0].id);
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1).replace(`${prefix}-`, "");
      setActive(
        sections.some((section) => section.id === id) ? id : sections[0].id,
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [sections, prefix]);
  function links() {
    return sections.map(({ id, title }, index) => (
      <a
        key={id}
        href={`#${prefix}-${id}`}
        aria-current={active === id ? "location" : undefined}
        onClick={() => setActive(id)}
        className="min-h-11 rounded-r-md border-l-2 border-transparent px-3 py-2 text-xs leading-relaxed text-marketing-copy hover:border-[#af90c2] hover:bg-[#f3edf8] aria-[current=location]:border-[#af90c2] aria-[current=location]:bg-[#f3edf8] aria-[current=location]:text-[#705183]"
      >
        {String(index + 1).padStart(2, "0")} · {title}
      </a>
    ));
  }
  return (
    <>
      <div className="hidden min-[651px]:block">
        <p className="mb-4 py-2 text-[10px] font-semibold uppercase tracking-[1.7px] text-[#9478a5]">
          On this page
        </p>
        <nav
          aria-label={prefix === "terms" ? "Terms contents" : "Policy contents"}
          className="flex flex-col gap-1"
        >
          {links()}
        </nav>
      </div>
      <details className="group rounded-lg border border-marketing-border bg-white px-4 py-3 min-[651px]:hidden">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[1.7px] text-[#9478a5] [&::-webkit-details-marker]:hidden">
          On this page
          <span
            aria-hidden="true"
            className="text-lg font-normal group-open:hidden"
          >
            +
          </span>
          <span
            aria-hidden="true"
            className="hidden text-lg font-normal group-open:inline"
          >
            −
          </span>
        </summary>
        <nav
          aria-label={
            prefix === "terms"
              ? "Mobile terms contents"
              : "Mobile policy contents"
          }
          className="mt-3 flex flex-col gap-1"
        >
          {links()}
        </nav>
      </details>
    </>
  );
}
