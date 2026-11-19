"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { BookOpen, Minus, Plus } from "lucide-react";
import { guideCategories, guides } from "./guides";

export function DocumentationSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <aside
      className="self-start min-[961px]:sticky min-[961px]:top-[118px] min-[961px]:max-h-[calc(100dvh-140px)] min-[961px]:overflow-y-auto min-[961px]:border-r min-[961px]:border-marketing-nav-border min-[961px]:pr-5"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={toggle}
        className="flex min-h-11 w-full items-center justify-between rounded-[10px] border border-marketing-nav-border bg-white px-4 py-3 text-[11px] text-[#715c80] min-[961px]:hidden"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Browse documentation
        {open ? (
          <Minus size={18} aria-hidden="true" className="text-[#a08aaf]" />
        ) : (
          <Plus size={18} aria-hidden="true" className="text-[#a08aaf]" />
        )}
      </button>
      <nav
        id={id}
        aria-label="Documentation topics"
        className={`${open ? "block" : "hidden"} max-h-[60dvh] overflow-y-auto rounded-b-[10px] border border-marketing-nav-border bg-white p-4 min-[961px]:block min-[961px]:max-h-none min-[961px]:overflow-visible min-[961px]:border-0 min-[961px]:bg-transparent min-[961px]:p-0`}
      >
        <Link
          href="/docs"
          onClick={() => setOpen(false)}
          aria-current={pathname === "/docs" ? "page" : undefined}
          className="flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[11px] text-[#715c80] hover:bg-[#f5f0f8] aria-[current=page]:bg-[#f0e9f5] aria-[current=page]:font-semibold"
        >
          <BookOpen size={17} strokeWidth={1.5} aria-hidden="true" />
          Documentation home
        </Link>
        {guideCategories.map((category) => (
          <div key={category} className="mt-6">
            <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-wider text-[#947da1]">
              {category}
            </p>
            {guides
              .filter((guide) => guide.category === category)
              .map((guide) => (
                <Link
                  key={guide.id}
                  href={`/docs/${guide.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={
                    pathname === `/docs/${guide.id}` ? "page" : undefined
                  }
                  className="block rounded-lg px-3 py-2 text-[11px] leading-relaxed text-marketing-copy hover:bg-[#f5f0f8] hover:text-[#604675] aria-[current=page]:bg-[#f0e9f5] aria-[current=page]:font-semibold aria-[current=page]:text-[#604675]"
                >
                  {guide.title}
                </Link>
              ))}
          </div>
        ))}
        <div className="mx-3 mt-6 border-t border-marketing-nav-border pt-5 text-[9px] leading-[1.9] text-[#a08aaf]">
          <p>Product in development</p>
          <Link
            href="/docs/availability"
            onClick={() => setOpen(false)}
            className="text-[#806193]"
          >
            Review platform availability
          </Link>
        </div>
      </nav>
    </aside>
  );
}
