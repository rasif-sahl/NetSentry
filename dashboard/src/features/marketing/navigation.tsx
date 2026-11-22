"use client";

import Link from "@/features/marketing/public-link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useRef, useState } from "react";
import { Brand, primaryButton } from "./ui";

const links = [
  ["Home", "/"],
  ["Product", "/product"],
  ["Applications", "/applications"],
  ["Solutions", "/solutions"],
  ["Documentation", "/docs"],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"],
] as const;

const contentIds: Record<string, string> = {
  home: "main",
  docs: "documentation-main",
};

export function MarketingNavigation() {
  const segments = useSelectedLayoutSegments();
  const segment = segments[0];
  const activeHref = segment ? `/${segment}` : "/";
  const contentId = contentIds[segment ?? "home"] ?? `${segment}-main`;

  return (
    <>
      <a
        href={`#${contentId}`}
        className="fixed left-4 top-4 z-50 -translate-y-32 rounded-lg bg-[#7e6094] px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <NavigationBar
        key={segments.join("/")}
        activeHref={activeHref}
        nested={segments.length > 1}
      />
    </>
  );
}

function NavigationBar({
  activeHref,
  nested,
}: {
  activeHref: string;
  nested: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="sticky top-3 z-30 mx-auto mt-4 flex h-[68px] w-[calc(100%-24px)] max-w-[1248px] items-center justify-between gap-2 rounded-xl border border-marketing-nav-border bg-white/95 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 md:top-4 md:w-[calc(100%-48px)] md:px-6"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <Link
        href="/"
        aria-label="NetSentry home"
        className="shrink-0"
        onClick={() => setOpen(false)}
      >
        <Brand />
      </Link>
      <button
        ref={toggle}
        type="button"
        className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-lg text-[#705283] hover:bg-marketing-hover xl:hidden"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="public-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav
        aria-label="Main navigation"
        id="public-navigation"
        className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full max-h-[calc(100dvh-6rem)] flex-col gap-1 overflow-y-auto rounded-b-xl border border-marketing-nav-border bg-white p-4 text-sm font-medium text-[#584562] xl:static xl:flex xl:max-h-none xl:flex-row xl:gap-4 xl:overflow-visible xl:border-0 xl:bg-transparent xl:p-0`}
      >
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              href === activeHref ? (nested ? "location" : "page") : undefined
            }
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-3 hover:bg-marketing-hover aria-[current]:font-semibold aria-[current]:text-[#604675]"
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link
        href="/app"
        className={`${primaryButton} shrink-0 max-sm:px-3`}
        onClick={() => setOpen(false)}
      >
        Sign in
      </Link>
    </header>
  );
}
