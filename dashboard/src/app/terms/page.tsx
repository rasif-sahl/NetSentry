import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { CopyrightYear } from "@/components/marketing/copyright-year";
import { MarketingNavigation } from "@/components/marketing/navigation";
import { PolicyContents } from "@/components/marketing/policy-contents";
import { button, Chapter } from "@/components/marketing/ui";
import { termsSections } from "@/lib/terms/terms";

export const metadata: Metadata = {
  title: "NetSentry — Terms and Conditions (Draft)",
  description:
    "Read NetSentry’s draft Terms and Conditions: accounts, authorized use, features, plans and responsibilities. Final terms and effective date are still being confirmed.",
};
const container =
  "mx-auto w-[calc(100%-40px)] max-w-[1060px] md:w-[calc(100%-80px)]";
const paragraph = "text-[13px] leading-[1.95] text-marketing-copy";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#30283c] selection:bg-[#e7dcef]">
      <a
        href="#terms-main"
        className="fixed left-4 top-4 z-50 -translate-y-32 rounded-lg bg-[#7e6094] px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNavigation page="terms" />
      <main id="terms-main" className={container}>
        <section
          id="terms-top"
          className="scroll-mt-28 pb-8 pt-12 text-center md:pb-10 md:pt-16"
        >
          <Chapter>Clear expectations. Thoughtful use.</Chapter>
          <h1 className="font-[inherit] text-[38px] font-semibold leading-[1.2] tracking-[-.045em] md:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mx-auto mt-5 max-w-[535px] text-sm leading-[1.9] text-marketing-copy">
            An outline of how NetSentry is intended to be used, the
            responsibilities involved, and what to expect from the service.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] text-marketing-copy">
            <span className="rounded-full bg-[#f3edf8] px-3 py-1 text-[#806092]">
              Draft for review
            </span>
            <span>Effective date to be confirmed</span>
          </div>
        </section>
        <aside
          aria-labelledby="terms-draft-title"
          className="mb-7 flex items-start gap-4 rounded-xl border border-marketing-border bg-[#f3edf8] px-5 py-5 md:mb-10 md:px-6"
        >
          <FileText
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-1 shrink-0 text-[#a084b2]"
          />
          <div>
            <h2
              id="terms-draft-title"
              className="font-[inherit] text-[13px] font-semibold"
            >
              These terms are being finalized.
            </h2>
            <p className="mt-1 text-xs leading-[1.8] text-marketing-copy">
              This preview shows the proposed structure and wording. The
              operating entity, commercial terms, liability provisions and
              applicable law must be confirmed before these terms become
              effective.
            </p>
          </div>
        </aside>
        <div className="grid gap-7 pb-14 min-[651px]:grid-cols-[185px_minmax(0,1fr)] min-[651px]:gap-9 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <aside>
            <PolicyContents
              prefix="terms"
              sections={termsSections.map(({ id, title }) => ({ id, title }))}
            />
            <p className="mt-6 hidden border-t border-marketing-border pt-5 text-[11px] leading-[1.8] text-marketing-copy min-[651px]:block">
              Looking for practical guidance?
              <br />
              Our documentation explains setup, permissions and product
              availability. Browse the{" "}
              <Link
                href="/docs"
                className="underline decoration-[#c9b4d7] underline-offset-4"
              >
                product documentation
              </Link>
              .
            </p>
          </aside>
          <article aria-label="Draft terms and conditions" className="min-w-0">
            {termsSections.map(({ id, title, blocks }, index) => (
              <section
                key={id}
                id={`terms-${id}`}
                aria-labelledby={`terms-${id}-title`}
                className="scroll-mt-28 border-b border-marketing-border py-7 first:pt-0"
              >
                <h2
                  id={`terms-${id}-title`}
                  className="mb-4 font-[inherit] text-[22px] font-semibold leading-[1.4] tracking-[-.025em] md:text-[23px]"
                >
                  <span
                    aria-hidden="true"
                    className="mr-3 text-[17px] font-normal text-[#af95bf]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {title}
                </h2>
                <div className="space-y-3">
                  {blocks.map((block, i) =>
                    block.type === "list" ? (
                      <ul
                        key={i}
                        className={`${paragraph} list-disc space-y-1 pl-5`}
                      >
                        {block.items.map((item) => (
                          <li key={item} className="pl-1">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        key={i}
                        className={
                          block.type === "note"
                            ? "border-l-[3px] border-[#b89acb] pl-4 text-xs leading-[1.9] text-marketing-copy"
                            : paragraph
                        }
                      >
                        {block.text}
                      </p>
                    ),
                  )}
                </div>
              </section>
            ))}
            <div className="mt-8 rounded-xl border border-marketing-border bg-[#f3edf8] p-6">
              <h2 className="font-[inherit] text-[22px] font-semibold leading-[1.4] tracking-[-.025em]">
                Understand the product before you begin.
              </h2>
              <p className="mt-2 text-xs leading-[1.85] text-marketing-copy">
                Review the permissions and responsibilities that go with
                connecting devices and sharing information.
              </p>
              <a href="#terms-authority" className={`${button} mt-5`}>
                Review permissions and authority
              </a>
            </div>
            <a
              href="#terms-top"
              className="mt-6 inline-flex min-h-11 items-center border-b border-[#d7c6e2] text-xs text-[#806092]"
            >
              Back to top
            </a>
          </article>
        </div>
      </main>
      <footer
        className={`${container} flex flex-wrap justify-between gap-5 border-t border-marketing-border py-7 text-[11px] text-marketing-copy`}
      >
        <p>
          © <CopyrightYear /> NetSentry
        </p>
        <nav aria-label="Terms footer" className="flex flex-wrap gap-6">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/contact">Contact</Link>
          <Link
            href="/terms"
            aria-current="page"
            className="font-semibold text-[#705183]"
          >
            Terms and Conditions
          </Link>
        </nav>
      </footer>
    </div>
  );
}
