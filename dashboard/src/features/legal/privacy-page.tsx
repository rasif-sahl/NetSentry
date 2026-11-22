import motion from "@/features/marketing/public-motion.module.css";
import Link from "@/features/marketing/public-link";
import { FileText } from "lucide-react";
import { CopyrightYear } from "@/features/marketing/copyright-year";
import { PolicyContents } from "./policy-contents";
import { button, Chapter } from "@/features/marketing/ui";
import { policySections } from "./policy";

const container =
  "mx-auto w-[calc(100%-40px)] max-w-[1060px] md:w-[calc(100%-80px)]";
const paragraph = "text-base leading-relaxed text-marketing-copy";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#30283c] selection:bg-[#e7dcef]">
      <main id="privacy-main" tabIndex={-1} className={container}>
        <section
          id="privacy-top"
          className={`${motion.intro} scroll-mt-28 pb-8 pt-12 text-center md:pb-10 md:pt-16`}
        >
          <Chapter>Your information. Your choices.</Chapter>
          <h1 className="font-[inherit] text-[38px] font-semibold leading-[1.2] tracking-[-.045em] md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mx-auto mt-5 max-w-[535px] text-base leading-relaxed text-marketing-copy">
            A clear view of the information NetSentry uses, why it is needed,
            and the choices available to you.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-marketing-copy">
            <span className="rounded-full bg-[#f3edf8] px-3 py-1 text-[#806092]">
              Draft for review
            </span>
            <span>Effective date to be confirmed</span>
          </div>
          <a
            href="#privacy-choices"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold text-[#604675] underline underline-offset-4 hover:bg-marketing-hover"
          >
            Your privacy choices
          </a>
        </section>
        <aside
          aria-labelledby="privacy-draft-title"
          className={`${motion.reading} mb-7 flex items-start gap-4 rounded-xl border border-marketing-border bg-[#f3edf8] px-5 py-5 md:mb-10 md:px-6`}
        >
          <FileText
            size={20}
            strokeWidth={1.5}
            aria-hidden="true"
            className="mt-1 shrink-0 text-[#a084b2]"
          />
          <div>
            <h2
              id="privacy-draft-title"
              className="font-[inherit] text-[13px] font-semibold"
            >
              Policy content is being finalized.
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-marketing-copy">
              This preview shows the proposed structure and wording. The
              operating entity, service providers, retention periods and
              applicable regional terms must be confirmed before publication as
              an effective policy.
            </p>
          </div>
        </aside>
        <div className="grid gap-7 pb-14 min-[651px]:grid-cols-[185px_minmax(0,1fr)] min-[651px]:gap-9 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <aside>
            <PolicyContents
              sections={policySections.map(({ id, title }) => ({ id, title }))}
            />
            <p className="mt-6 hidden border-t border-marketing-border pt-5 text-sm leading-relaxed text-marketing-copy min-[651px]:block">
              Looking for practical guidance?
              <br />
              Privacy controls are explained in the{" "}
              <Link
                href="/docs/privacy"
                className="underline decoration-[#c9b4d7] underline-offset-4"
              >
                product documentation
              </Link>
              .
            </p>
          </aside>
          <article aria-label="Draft privacy policy" className="min-w-0">
            {policySections.map(({ id, title, blocks }, index) => (
              <section
                key={id}
                id={`privacy-${id}`}
                aria-labelledby={`privacy-${id}-title`}
                className="scroll-mt-28 border-b border-marketing-border py-7 first:pt-0"
              >
                <h2
                  id={`privacy-${id}-title`}
                  className={`${motion.reading} mb-4 font-[inherit] text-[22px] font-semibold leading-[1.4] tracking-[-.025em] md:text-[23px]`}
                >
                  <span
                    aria-hidden="true"
                    className="mr-3 text-[17px] font-normal text-[#af95bf]"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {title}
                </h2>
                <div className={`${motion.reading} space-y-3`}>
                  {blocks.map((block, i) =>
                    block.type === "list" ? (
                      <ul
                        key={i}
                        className={`${paragraph} list-disc space-y-1 pl-5`}
                      >
                        {block.items.map((item) => (
                          <li key={item.text} className="pl-1">
                            {item.lead && (
                              <>
                                <strong className="font-semibold text-marketing-label">
                                  {item.lead}
                                </strong>{" "}
                              </>
                            )}
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p
                        key={i}
                        className={
                          block.type === "note"
                            ? "border-l-[3px] border-[#b89acb] pl-4 text-sm leading-relaxed text-marketing-copy"
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
                Make your choices with context.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-marketing-copy">
                Understand how permissions, sharing and account controls work in
                NetSentry.
              </p>
              <Link href="/docs/privacy" className={`${button} mt-5`}>
                Review your choices
              </Link>
            </div>
            <a
              href="#privacy-top"
              className="mt-6 inline-flex min-h-11 items-center border-b border-[#d7c6e2] text-xs text-[#806092]"
            >
              Back to top
            </a>
          </article>
        </div>
      </main>
      <footer
        className={`${motion.reading} ${container} flex flex-wrap justify-between gap-5 border-t border-marketing-border py-7 text-sm text-marketing-copy`}
      >
        <p>
          © <CopyrightYear /> NetSentry
        </p>
        <nav aria-label="Privacy footer" className="flex flex-wrap gap-6">
          <Link href="/docs">Documentation</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/terms">Terms and Conditions</Link>
          <Link
            href="/privacy"
            aria-current="page"
            className="font-semibold text-[#705183]"
          >
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
