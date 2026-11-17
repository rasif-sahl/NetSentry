"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand, primaryButton } from "./ui";

const links = [
  ["The product", "/product"],
  ["Solutions", "/solutions"],
  ["Our apps", "/applications"],
  ["How it works", "#how-it-works"],
];

const productLinks = [
  ["Home", "/"],
  ["Product", "/product"],
  ["Applications", "/applications"],
  ["Privacy & choice", "#product-privacy"],
  ["Solutions", "/solutions"],
];

const applicationLinks = [
  ["Home", "/"],
  ["Product", "/product"],
  ["Applications", "/applications"],
  ["Getting started", "#applications-setup"],
  ["Solutions", "/solutions"],
];
const solutionLinks = [
  ["Home", "/"],
  ["Product", "/product"],
  ["Applications", "/applications"],
  ["Solutions", "/solutions"],
];
const pricingLinks = [
  ["Product", "/product"],
  ["Applications", "/applications"],
  ["Solutions", "/solutions"],
];
const navigation = {
  home: links,
  product: productLinks,
  applications: applicationLinks,
  solutions: solutionLinks,
  pricing: pricingLinks,
};

export function MarketingNavigation({
  page = "home",
}: {
  page?: "home" | "product" | "applications" | "solutions" | "pricing";
}) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className="sticky top-3 z-30 mx-auto mt-4 w-[calc(100%-24px)] max-w-[1248px] rounded-xl border border-[#e8e0ed] bg-white/95 backdrop-blur-xl md:top-4 md:w-[calc(100%-48px)]"
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
          className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-[68px] flex-col gap-1 rounded-b-xl border border-[#e8e0ed] bg-white p-4 text-xs text-[#75657f] xl:static xl:flex xl:flex-row xl:gap-7 xl:border-0 xl:bg-transparent xl:p-0`}
        >
          {[
            ...navigation[page],
            ["Documentation", "/docs"],
            ["Pricing", "/pricing"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (page === "product" && href === "/product") ||
                (page === "applications" && href === "/applications") ||
                (page === "solutions" && href === "/solutions") ||
                (page === "pricing" && href === "/pricing")
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 hover:bg-[#f4eff8] aria-[current=page]:font-semibold aria-[current=page]:text-[#604675] xl:px-0"
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
            <Link
              href={
                page === "pricing"
                  ? "#pricing-plans"
                  : page === "solutions"
                    ? "#solutions-paths"
                    : page === "applications"
                      ? "#applications-compare"
                      : page === "product"
                        ? "#product-features"
                        : "/product"
              }
              className={primaryButton}
            >
              {page === "pricing"
                ? "Explore the plans"
                : page === "solutions"
                  ? "Find your starting point"
                  : page === "applications"
                    ? "Compare the apps"
                    : page === "product"
                      ? "Explore the features"
                      : "Meet NetSentry"}
            </Link>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-lg text-[#705283] hover:bg-[#f4eff8] xl:hidden"
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
