"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand, primaryButton } from "./ui";

type NavigationLink = readonly [label: string, href: string];

const productLink = ["Product", "/product"] as const;
const applicationsLink = ["Applications", "/applications"] as const;
const solutionsLink = ["Solutions", "/solutions"] as const;
const productLinks = [productLink, applicationsLink, solutionsLink] as const;
const sharedLinks = [
  ["Documentation", "/docs"],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"],
] as const;

const navigation = {
  home: {
    links: [
      ["The product", "/product"],
      ["Solutions", "/solutions"],
      ["Our apps", "/applications"],
      ["How it works", "#how-it-works"],
    ],
    action: ["Meet NetSentry", "/product"],
  },
  product: {
    links: [
      ["Home", "/"],
      productLink,
      applicationsLink,
      ["Privacy & choice", "#product-privacy"],
      solutionsLink,
    ],
    action: ["Explore the features", "#product-features"],
  },
  applications: {
    links: [
      ["Home", "/"],
      productLink,
      applicationsLink,
      ["Getting started", "#applications-setup"],
      solutionsLink,
    ],
    action: ["Compare the apps", "#applications-compare"],
  },
  solutions: {
    links: [["Home", "/"], ...productLinks],
    action: ["Find your starting point", "#solutions-paths"],
  },
  pricing: {
    links: productLinks,
    action: ["Explore the plans", "#pricing-plans"],
  },
  contact: { links: productLinks, action: ["Get in touch", "#contact-form"] },
  privacy: {
    links: productLinks,
    action: ["Your privacy choices", "#privacy-choices"],
  },
  terms: { links: productLinks, action: ["Read the terms", "#terms-overview"] },
} satisfies Record<
  string,
  { links: readonly NavigationLink[]; action: NavigationLink }
>;

export function MarketingNavigation({
  page = "home",
}: {
  page?: keyof typeof navigation;
}) {
  const {
    links,
    action: [actionLabel, actionHref],
  } = navigation[page];
  const [open, setOpen] = useState(false);
  return (
    <header
      className="sticky top-3 z-30 mx-auto mt-4 w-[calc(100%-24px)] max-w-[1248px] rounded-xl border border-marketing-nav-border bg-white/95 backdrop-blur-xl md:top-4 md:w-[calc(100%-48px)]"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <div className="flex h-[68px] items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" aria-label="NetSentry home">
          <Brand />
        </Link>
        <nav
          aria-label="Main navigation"
          id={`main-navigation-${page}`}
          className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-[68px] flex-col gap-1 rounded-b-xl border border-marketing-nav-border bg-white p-4 text-xs text-[#75657f] xl:static xl:flex xl:flex-row xl:gap-5 xl:border-0 xl:bg-transparent xl:p-0`}
        >
          {[...links, ...sharedLinks].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={href === `/${page}` ? "page" : undefined}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 hover:bg-marketing-hover aria-[current=page]:font-semibold aria-[current=page]:text-[#604675] xl:px-0"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 md:gap-5">
          {page === "home" && (
            <Link
              href="/app"
              className="inline-flex min-h-11 items-center px-1 text-xs text-[#715d7f]"
            >
              Sign in
            </Link>
          )}
          <div className="hidden sm:block">
            <Link href={actionHref} className={primaryButton}>
              {actionLabel}
            </Link>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-[#705283] hover:bg-marketing-hover xl:hidden"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls={`main-navigation-${page}`}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
