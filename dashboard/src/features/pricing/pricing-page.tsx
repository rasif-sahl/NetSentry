import Link from "next/link";
import { Check } from "lucide-react";
import { CopyrightYear } from "@/features/marketing/copyright-year";
import {
  button,
  Chapter,
  container,
  primaryButton,
} from "@/features/marketing/ui";

// Public positioning only. Sandbox amounts and technical limits are not sale terms.
const editions = [
  {
    name: "Personal Free",
    eyebrow: "For your everyday",
    description: "A simple place to begin understanding your devices.",
    price: "Free edition",
    priceNote: "Proposed entry plan",
    features: [
      "Personal workspace",
      "Supported device reports",
      "Basic reporting and history",
      "Privacy and account controls",
    ],
    action: "Explore Free",
    highlighted: false,
  },
  {
    name: "Personal Premium",
    eyebrow: "A fuller personal view",
    description: "More context for your devices, apps and development work.",
    price: "Coming soon",
    priceNote: "Price announced at launch",
    features: [
      "Expanded personal workspace",
      "Advanced app insights",
      "Supported network reports",
      "Developer tools",
    ],
    action: "Explore Premium",
    highlighted: true,
  },
  {
    name: "Family",
    eyebrow: "For shared routines",
    description: "A clearer shared picture, with individual choices respected.",
    price: "Coming soon",
    priceNote: "Price announced at launch",
    features: [
      "Family workspace",
      "Shared family reports",
      "Time-request workflows",
      "Roles and consent controls",
    ],
    action: "Explore Family",
    highlighted: false,
  },
  {
    name: "Business",
    eyebrow: "For working together",
    description: "Bring supported team devices into one organized workspace.",
    price: "Coming soon",
    priceNote: "Price announced at launch",
    features: [
      "Business workspace",
      "Team device oversight",
      "Workspace access roles",
      "Business reporting context",
    ],
    action: "Explore Business",
    highlighted: false,
  },
];
const comparison = [
  ["Best suited to", "Getting started", "Personal use", "Families", "Teams"],
  ["Supported device reports", "Included", "Included", "Included", "Included"],
  ["Advanced application insights", "—", "Planned", "Planned", "Planned"],
  ["Network & developer tools", "—", "Planned", "Planned", "Planned"],
  ["Family reports & time requests", "—", "—", "Planned", "Planned"],
  ["Business tools", "—", "—", "—", "Planned"],
  [
    "Final device limits & retention",
    "To be confirmed",
    "To be confirmed",
    "To be confirmed",
    "To be confirmed",
  ],
];
const principles = [
  [
    "Your choices stay yours.",
    "An edition never replaces your consent, permissions or control over sharing.",
  ],
  [
    "One connected workspace.",
    "Use the web, mobile and desktop interfaces where they are supported.",
  ],
  [
    "Know what is available.",
    "Platform differences and unavailable reports remain clearly explained.",
  ],
];
const questions = [
  [
    "Can I purchase a paid plan today?",
    "Paid purchases are not available yet. Launch prices, billing terms and supported purchase methods will be published when they are ready.",
  ],
  [
    "Will monthly and annual billing be available?",
    "Monthly and annual options are planned. Final billing periods and any savings will be confirmed with launch pricing.",
  ],
  [
    "Does every feature work on every platform?",
    "No. Capabilities depend on the operating system, supported sources and granted permissions. An edition does not add an unsupported capability.",
  ],
  [
    "Does a family or team plan enable monitoring automatically?",
    "No. Membership and billing do not grant collection permissions. Pairing, consent, sharing and supported platform permissions remain separate choices.",
  ],
];
const muted = "text-xs leading-[1.85] text-marketing-copy";
const heading =
  "font-[inherit] text-[30px] font-semibold leading-[1.3] tracking-[-.035em]";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <main id="pricing-main" tabIndex={-1} className={container}>
        <section className="pb-10 pt-14 text-center md:pb-12 md:pt-20">
          <Chapter>NetSentry pricing</Chapter>
          <h1 className="font-[inherit] text-[38px] font-semibold leading-[1.16] tracking-[-.045em] md:text-[49px]">
            A little more clarity.
            <br />
            <span className="text-[#7e6094]">A plan that fits your day.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[530px] text-[13px] leading-[1.9] text-marketing-copy md:text-sm">
            Start with your own digital habits. Make room for your family or
            your team when you need to.
          </p>
          <p className="mt-6 inline-block rounded-full bg-[#f3edf8] px-4 py-2 text-[11px] text-[#806092]">
            In development · Launch pricing coming soon
          </p>
        </section>
        <section
          id="pricing-plans"
          aria-label="Proposed editions"
          className="grid scroll-mt-28 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {editions.map((edition) => (
            <article
              key={edition.name}
              className={`flex flex-col gap-5 rounded-xl border px-6 py-7 ${edition.highlighted ? "border-[#cbb4dc] bg-[#f3edf8]" : "border-marketing-border bg-white"}`}
            >
              <div>
                <p className="mb-2 text-[9px] font-semibold uppercase tracking-[1.6px] text-[#947da1]">
                  {edition.eyebrow}
                </p>
                <h2 className="font-[inherit] text-[21px] font-semibold leading-[1.3] tracking-[-.025em]">
                  {edition.name}
                </h2>
                <p className={`${muted} mt-3 sm:min-h-[67px]`}>
                  {edition.description}
                </p>
              </div>
              <div className="border-y border-marketing-border py-5">
                <p className="text-[19px] font-semibold tracking-[-.025em]">
                  {edition.price}
                </p>
                <p className="mt-1 text-[11px] text-marketing-copy">
                  {edition.priceNote}
                </p>
              </div>
              <ul className="flex-1 space-y-3 py-1">
                {edition.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-xs leading-relaxed"
                  >
                    <Check
                      size={14}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-[#9b7ab1]"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href="#pricing-compare"
                className={`${edition.highlighted ? primaryButton : button} mt-2`}
              >
                {edition.action}
              </a>
            </article>
          ))}
        </section>
        <p className="mx-auto mt-5 max-w-[700px] text-center text-[11px] leading-[1.8] text-marketing-copy">
          Proposed editions. Prices, limits and launch availability are still
          being finalized.
          <br />
          Features depend on platform support, permissions and consent. Paid
          purchases are not available yet.
        </p>
        <section
          id="pricing-compare"
          className="scroll-mt-28 pt-14 md:pt-20"
          aria-labelledby="pricing-comparison-title"
        >
          <Chapter>A closer look</Chapter>
          <h2 id="pricing-comparison-title" className={heading}>
            Choose the kind of clarity you need.
          </h2>
          <p id="pricing-comparison-note" className={`${muted} mt-3`}>
            A simple overview of the proposed editions. Final inclusions will be
            confirmed before launch.
          </p>
          <div
            role="region"
            aria-label="Edition comparison"
            tabIndex={0}
            className="relative mt-8 overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <table
              className="w-full min-w-[660px] border-collapse text-left text-xs"
              aria-describedby="pricing-comparison-note"
            >
              <caption className="sr-only">
                Proposed NetSentry editions and tools. A dash means the tool is
                not included in that proposed edition.
              </caption>
              <thead>
                <tr>
                  {[
                    "Workspace & tools",
                    "Free",
                    "Premium",
                    "Family",
                    "Business",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="border-b border-marketing-border px-3 py-4 font-semibold first:w-[32%] first:pl-0"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map(([label, ...values]) => (
                  <tr key={label}>
                    <th
                      scope="row"
                      className="border-b border-marketing-border py-4 pr-3 font-medium"
                    >
                      {label}
                    </th>
                    {values.map((value, index) => (
                      <td
                        key={index}
                        className="border-b border-marketing-border px-3 py-4 text-marketing-copy"
                      >
                        {value === "—" ? (
                          <>
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Not included</span>
                          </>
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section
          aria-label="Principles across editions"
          className="mt-9 grid gap-7 border-b border-marketing-border py-9 md:grid-cols-3 md:gap-9"
        >
          {principles.map(([title, text]) => (
            <div key={title}>
              <h2 className="font-[inherit] text-[15px] font-semibold">
                {title}
              </h2>
              <p className={`${muted} mt-2`}>{text}</p>
            </div>
          ))}
        </section>
        <section
          id="pricing-questions"
          className="grid scroll-mt-28 gap-6 pt-14 md:grid-cols-[1fr_1.6fr] md:gap-20 md:pt-20"
          aria-labelledby="pricing-questions-title"
        >
          <div>
            <Chapter>A few helpful answers</Chapter>
            <h2 id="pricing-questions-title" className={heading}>
              Before you choose.
            </h2>
            <p className={`${muted} mt-3`}>
              The details that matter, without the small print.
            </p>
          </div>
          <div>
            {questions.map(([question, answer], index) => (
              <details
                key={question}
                open={index === 0}
                className="group border-b border-marketing-border py-4"
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                  {question}
                  <span
                    aria-hidden="true"
                    className="text-xl font-normal text-[#a58bb6] group-open:hidden"
                  >
                    +
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden text-xl font-normal text-[#a58bb6] group-open:inline"
                  >
                    −
                  </span>
                </summary>
                <p className={`${muted} pb-1 pt-3`}>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="mb-11 mt-16 rounded-xl border border-marketing-border bg-[#f3edf8] px-6 py-10 text-center md:mt-[70px] md:px-10">
          <Chapter>Start with understanding</Chapter>
          <h2 className="font-[inherit] text-[26px] font-semibold tracking-[-.035em]">
            Find your starting point.
          </h2>
          <p className={`${muted} mb-6 mt-3`}>
            Explore what NetSentry does before choosing an edition.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a className={primaryButton} href="#pricing-plans">
              Review the plans
            </a>
            <a className={button} href="#pricing-questions">
              Read the FAQs
            </a>
          </div>
        </section>
      </main>
      <footer
        className={`${container} flex flex-col justify-between gap-5 border-t border-marketing-border py-7 text-[11px] text-marketing-copy sm:flex-row`}
      >
        <p>
          © <CopyrightYear /> NetSentry
        </p>
        <nav
          aria-label="Pricing footer"
          className="flex flex-wrap gap-x-6 gap-y-3"
        >
          <Link href="/product">Product</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms and Conditions</Link>
          <Link href="/applications">Applications</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
      </footer>
    </div>
  );
}
