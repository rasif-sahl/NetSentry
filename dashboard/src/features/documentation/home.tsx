"use client";

import motion from "@/features/marketing/public-motion.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  Code2,
  Search,
  Smartphone,
  UsersRound,
} from "lucide-react";
import { guideCategories, guides } from "./guides";
import { button, primaryButton } from "@/features/marketing/ui";

const icons = [
  BookOpen,
  Smartphone,
  ChartNoAxesColumnIncreasing,
  UsersRound,
  Code2,
  CircleHelp,
];
export function DocumentationHomeQuery() {
  const query = useSearchParams().get("q") ?? "";
  return <DocumentationHome key={query} initialQuery={query} />;
}

export function DocumentationHome({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const resultId = useId();
  const needle = query.trim().toLocaleLowerCase();
  const matches = guides.filter((guide) =>
    `${guide.title} ${guide.summary} ${guide.category}`
      .toLocaleLowerCase()
      .includes(needle),
  );
  const categories = guideCategories.filter((category) =>
    matches.some((guide) => guide.category === category),
  );
  function clear() {
    setQuery("");
    input.current?.focus();
  }
  return (
    <>
      <section className="pb-7 min-[961px]:pt-2">
        <p className="mb-4 text-[9px] font-semibold uppercase tracking-[1.7px] text-[#947da1]">
          NetSentry documentation
        </p>
        <h1
          className={`${motion.intro} font-[inherit] text-[36px] font-semibold leading-[1.2] tracking-[-.035em] sm:text-[45px]`}
        >
          A little guidance.
          <br />
          <span className="text-[#7e6094]">A clearer way forward.</span>
        </h1>
        <p className="mt-5 max-w-[650px] text-xs leading-[1.9] text-marketing-copy sm:text-sm">
          Learn how to set up your workspace, understand your reports and manage
          your choices. Start with a guide or find the topic you need.
        </p>
        <form
          role="search"
          className="mt-7 flex min-h-14 max-w-[690px] items-center gap-3 rounded-xl border border-[#ded2e7] bg-white px-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <Search
            size={19}
            strokeWidth={1.5}
            aria-hidden="true"
            className="shrink-0 text-[#a08aaf]"
          />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search documentation"
            aria-describedby={resultId}
            placeholder="Search guides, permissions, reports…"
            autoComplete="off"
            className="h-[52px] min-w-0 w-full bg-transparent text-xs text-[#2c2437] outline-offset-2 placeholder:text-[#a18dad]"
          />
          {needle && (
            <button
              type="button"
              className="min-h-9 rounded-md bg-[#f0e9f5] px-3 py-2 text-[10px] text-[#806193]"
              onClick={clear}
            >
              Clear
            </button>
          )}
        </form>
        <p className="mt-3 text-[10px] text-[#9a87a5]">
          Search the documentation guides. No account required.
        </p>
      </section>
      {!needle && (
        <section
          className={`${motion.reading} mb-10 grid gap-5 rounded-[14px] border border-[#e8dfee] bg-marketing-hover p-6 sm:grid-cols-[1.1fr_1fr] sm:gap-10 sm:p-7`}
        >
          <div>
            <p className="mb-3 text-[8px] font-semibold uppercase tracking-[1.7px] text-[#947da1]">
              New to NetSentry?
            </p>
            <h2 className="font-[inherit] text-[25px] font-semibold leading-tight tracking-[-.035em]">
              Start with your workspace.
            </h2>
            <p className="mb-5 mt-4 text-xs leading-[1.8] text-marketing-copy">
              Get a clear view of the account, workspace and permission choices
              that come first.
            </p>
            <Link href="/docs/workspace" className={primaryButton}>
              Read the getting-started guide
            </Link>
          </div>
          <ol className="self-center">
            {[
              "Set up your account",
              "Choose your workspace",
              "Review your device and permissions",
            ].map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-4 border-b border-[#e4d8ec] py-4 text-[11px] text-[#715c80] last:border-0"
              >
                <span className="text-xl text-[#b095c1]">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section aria-label="Documentation guides">
        <div
          className={`${motion.reading} mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end`}
        >
          <div>
            <p className="mb-3 text-[8px] font-semibold uppercase tracking-[1.7px] text-[#947da1]">
              Find your next answer
            </p>
            <h2 className="font-[inherit] text-[26px] font-semibold leading-tight tracking-[-.035em]">
              Guides for the everyday.
            </h2>
          </div>
          <p
            id={resultId}
            role="status"
            aria-live="polite"
            className="text-[10px] text-[#9a87a5]"
          >
            {matches.length} {matches.length === 1 ? "guide" : "guides"} across{" "}
            {categories.length} {categories.length === 1 ? "topic" : "topics"}
          </p>
        </div>
        <div className={`${motion.stagger} grid gap-[18px] sm:grid-cols-2`}>
          {categories.map((category) => {
            const Icon = icons[guideCategories.indexOf(category)];
            return (
              <article
                key={category}
                className="rounded-xl border border-marketing-nav-border bg-white p-6"
              >
                <span className="mb-4 inline-flex rounded-[9px] bg-[#f0e9f5] p-2.5 text-[#9a7bac]">
                  <Icon size={19} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <h3 className="font-[inherit] text-lg font-semibold leading-tight tracking-[-.035em]">
                  {category}
                </h3>
                <div className="mt-4">
                  {matches
                    .filter((guide) => guide.category === category)
                    .map((guide) => (
                      <Link
                        key={guide.id}
                        href={`/docs/${guide.id}`}
                        className="group block border-t border-marketing-nav-border py-4 last:pb-0"
                      >
                        <span className="block text-xs font-semibold leading-relaxed text-[#715c80] group-hover:underline group-hover:underline-offset-4">
                          {guide.title}
                        </span>
                        <span className="mt-1 block text-[11px] leading-[1.8] text-marketing-caption">
                          {guide.summary}
                        </span>
                      </Link>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
        {!matches.length && (
          <div className="rounded-xl border border-dashed border-[#d8c7e3] bg-[#faf8fc] p-8">
            <h3 className="font-[inherit] text-lg font-semibold">
              No matching guides.
            </h3>
            <p className="mb-6 mt-4 text-xs leading-[1.8] text-marketing-copy">
              Try “permissions”, “sharing” or “reports”. You can also clear your
              search to browse every topic.
            </p>
            <button className={button} onClick={clear}>
              Show all guides
            </button>
          </div>
        )}
      </section>
      <section
        className={`${motion.reading} mt-8 flex items-start gap-5 rounded-xl border border-marketing-nav-border bg-[#faf8fc] p-6`}
      >
        <CircleHelp
          size={21}
          strokeWidth={1.5}
          aria-hidden="true"
          className="mt-1 shrink-0 text-[#9a7bac]"
        />
        <div>
          <h2 className="font-[inherit] text-[17px] font-semibold leading-tight tracking-[-.035em]">
            Know what is supported before you begin.
          </h2>
          <p className="mt-3 text-[11px] leading-[1.9] text-marketing-copy">
            Native build, signing and physical-device checks are still in
            progress. Features depend on platform, permissions and supported
            sources.
          </p>
          <Link
            href="/docs/availability"
            className="mt-4 inline-block border-b border-[#d3bedf] pb-1 text-[11px] text-[#806193]"
          >
            Read the availability guide
          </Link>
        </div>
      </section>
    </>
  );
}
