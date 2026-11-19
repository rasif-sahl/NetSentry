import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Building2, Lightbulb, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { CopyrightYear } from "@/components/marketing/copyright-year";
import { MarketingNavigation } from "@/components/marketing/navigation";
import { Chapter, container } from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "NetSentry — Contact",
  description:
    "Questions, ideas or team enquiries about NetSentry. Explore the contact form preview and find documentation to help you get started.",
};
const muted = "text-xs leading-[1.85] text-marketing-copy";
const heading =
  "font-[inherit] text-[25px] font-semibold leading-[1.3] tracking-[-.03em]";
const reasons = [
  {
    icon: MessageCircle,
    title: "Questions about the product",
    text: "Understand features, platforms and where to start.",
  },
  {
    icon: Building2,
    title: "Exploring NetSentry for a team",
    text: "Share your use case and the devices you work with.",
  },
  {
    icon: Lightbulb,
    title: "Something we could do better",
    text: "A small improvement or a bigger idea — we’re listening.",
  },
];
const questions = [
  {
    question: "Where can I find help getting started?",
    answer: (
      <>
        Start with the{" "}
        <Link
          href="/docs/workspace"
          className="underline decoration-[#c9b4d7] underline-offset-4"
        >
          “Start with your workspace” guide
        </Link>{" "}
        in Documentation. You’ll also find guides for pairing devices, choosing
        permissions and understanding reports.
      </>
    ),
  },
  {
    question: "What should I include in a support question?",
    answer: (
      <>
        Tell us which app and operating system you use, what you expected and
        what happened. Include any visible error text, with personal details
        removed.
      </>
    ),
  },
  {
    question: "Can I ask about pricing or platform availability?",
    answer: (
      <>
        Yes.{" "}
        <Link
          href="/pricing"
          className="underline decoration-[#c9b4d7] underline-offset-4"
        >
          Launch pricing
        </Link>{" "}
        is still being finalized, and features depend on{" "}
        <Link
          href="/docs/availability"
          className="underline decoration-[#c9b4d7] underline-offset-4"
        >
          platform support
        </Link>{" "}
        and permissions. Let us know which edition and devices you’re interested
        in.
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <a
        href="#contact-main"
        className="fixed left-4 top-4 z-50 -translate-y-32 rounded-lg bg-[#7e6094] px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNavigation page="contact" />
      <main id="contact-main" className={`${container} max-w-[1060px]`}>
        <section className="pb-10 pt-12 text-center md:pb-12 md:pt-16">
          <Chapter>Contact NetSentry</Chapter>
          <h1 className="font-[inherit] text-[37px] font-semibold leading-[1.16] tracking-[-.045em] md:text-5xl">
            A question. An idea.
            <br />
            <span className="text-[#7e6094]">Let’s start a conversation.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[490px] text-sm leading-[1.9] text-marketing-copy">
            Whether you’re finding your way around NetSentry or exploring it for
            your team, we’d like to hear from you.
          </p>
        </section>
        <section
          aria-label="Contact and help"
          className="grid items-start gap-8 pb-10 min-[651px]:grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)] md:gap-10 md:pb-16 lg:gap-[50px]"
        >
          <ContactForm />
          <aside className="pt-2">
            <Chapter>A good place to begin</Chapter>
            <h2 className={`${heading} mb-6`}>Point us in your direction.</h2>
            {reasons.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex items-start gap-4 border-b border-marketing-border py-5 first-of-type:pt-0"
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="mt-1 shrink-0 text-[#a084b2]"
                />
                <div>
                  <h3 className="font-[inherit] text-sm font-semibold tracking-[-.015em]">
                    {title}
                  </h3>
                  <p className={`${muted} mt-1`}>{text}</p>
                </div>
              </div>
            ))}
            <div className="mt-7 rounded-xl border border-marketing-border bg-[#f3edf8] p-6">
              <BookOpen
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
                className="text-[#a084b2]"
              />
              <h3 className="mb-2 mt-3 font-[inherit] text-[17px] font-semibold leading-[1.4] tracking-[-.02em]">
                A little guidance may help.
              </h3>
              <p className={muted}>
                Our documentation covers setup, permissions, reports and
                platform availability.
              </p>
              <Link
                href="/docs"
                className="mt-4 inline-flex min-h-11 items-center border-b border-[#c9b4d7] text-xs text-[#806092]"
              >
                Browse documentation
              </Link>
            </div>
          </aside>
        </section>
        <section
          id="contact-help"
          aria-labelledby="contact-help-title"
          className="grid scroll-mt-28 gap-7 border-t border-marketing-border py-10 md:grid-cols-[1fr_1.6fr] md:gap-14 md:py-12"
        >
          <div>
            <Chapter>Before you send</Chapter>
            <h2 id="contact-help-title" className={heading}>
              A few useful details.
            </h2>
            <p className={`${muted} mt-3`}>
              The right context makes a good conversation easier.
            </p>
          </div>
          <div>
            {questions.map(({ question, answer }, index) => (
              <details
                key={question}
                open={index === 0}
                className="group border-b border-marketing-border py-4"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-xl font-normal text-[#a084b2] group-open:hidden"
                  >
                    +
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden text-xl font-normal text-[#a084b2] group-open:inline"
                  >
                    −
                  </span>
                </summary>
                <p className={`${muted} mt-3`}>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer
        className={`${container} flex max-w-[1060px] flex-col justify-between gap-5 border-t border-marketing-border py-7 text-[11px] text-marketing-copy sm:flex-row`}
      >
        <p>
          © <CopyrightYear /> NetSentry
        </p>
        <nav
          aria-label="Contact footer"
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          <Link href="/product">Product</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms and Conditions</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
