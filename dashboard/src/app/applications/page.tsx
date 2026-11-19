import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  LayoutGrid,
  Monitor,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { ApplicationPreview } from "@/components/marketing/application-preview";
import { CopyrightYear } from "@/components/marketing/copyright-year";
import { MarketingNavigation } from "@/components/marketing/navigation";
import {
  Brand,
  button,
  caption,
  Chapter,
  container,
  primaryButton,
  Title,
} from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "NetSentry — Applications",
  description:
    "Find your NetSentry starting point. Explore the web dashboard, Android, iOS and desktop apps, compare their roles and review setup requirements and availability.",
};

const accent = "text-[#7e6094]";
const section = "scroll-mt-28 py-[53px] md:py-20";
const tinted = "border-y border-[#eee6f2] bg-[#f9f7fb]";
const muted = "text-xs leading-[1.85] text-marketing-copy";
const status =
  "inline-block rounded-full border border-[#e8dfee] bg-[#f5f0f8] px-3 py-1 text-[9px] leading-relaxed text-[#8a7299]";
const apps = [
  {
    id: "web",
    name: "Web dashboard",
    icon: LayoutGrid,
    description: "See the wider picture.",
    stage: "In your browser",
  },
  {
    id: "android",
    name: "Android",
    icon: Smartphone,
    description: "Understand supported phone activity.",
    stage: "Native validation pending",
  },
  {
    id: "ios",
    name: "iOS",
    icon: Smartphone,
    description: "Stay connected to your workspace.",
    stage: "Native validation pending",
  },
  {
    id: "desktop",
    name: "Desktop",
    icon: Monitor,
    description: "Bring local services into focus.",
    stage: "macOS first",
  },
];
const mobileApps = [
  {
    id: "android",
    name: "Android",
    title: "Understand supported phone activity.",
    description:
      "Review supported phone usage and stay connected to your workspace. Collection starts with your permission.",
    features: [
      "Supported application and screen-time reports",
      "Supported mobile/Wi-Fi usage sources",
      "Device pairing and explicit sharing choices",
    ],
    note: "Usage access, compatible sources and background settings affect collection. Physical-device validation remains pending.",
  },
  {
    id: "ios",
    name: "iOS",
    title: "Stay connected to your workspace.",
    description:
      "Review authorized reports and sharing choices, with Apple-specific features where eligible and authorized.",
    features: [
      "Device pairing and authorized report views",
      "Sharing and supported family workflows",
      "Apple Screen Time features where authorized",
    ],
    note: "Apple eligibility and authorization apply. Device-wide mobile/Wi-Fi totals are not generally available. Native validation remains pending.",
  },
] as const;
const comparison = [
  [
    "Main role",
    "Workspace overview and management",
    "Supported phone activity and reports",
    "Authorized reports and sharing",
    "Local developer services",
  ],
  [
    "Useful for",
    "Devices, reports, alerts and people",
    "Usage, permissions and sharing choices",
    "Pairing, shared reports and eligible Apple features",
    "Services, projects and action outcomes",
  ],
  [
    "Setup depends on",
    "Account, workspace and reporting sources",
    "Compatible build and user-granted access",
    "Compatible build and Apple-specific authorization",
    "Compatible build, local agent and pairing",
  ],
  [
    "Current stage",
    "Web source implemented; product in development",
    "Native validation pending",
    "Native validation pending",
    "macOS target; signed release checks pending",
  ],
];
const faqs = [
  [
    "Can I download the mobile and desktop apps now?",
    "NetSentry is in development. Native build, signing and physical-device validation are still in progress. Download options will be published when release readiness is confirmed.",
  ],
  [
    "Do Android and iOS provide the same measurements?",
    "No. Android collection depends on user-granted access and supported sources. iOS does not generally expose device-wide mobile/Wi-Fi totals. Apple Screen Time features require separate eligibility and authorization.",
  ],
  [
    "Does the desktop app monitor my whole network?",
    "The desktop interface connects to a local agent whose modules are enabled separately. Network monitoring requires its own setup, supported sources and consent; developer-service access does not authorize network collection.",
  ],
];

function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-7 grid gap-5 md:mb-9 md:grid-cols-[1.2fr_.8fr] md:items-end md:gap-16">
      <div>
        <Chapter>{eyebrow}</Chapter>
        <Title>{title}</Title>
      </div>
      <p className="text-xs leading-[1.8] text-marketing-copy md:text-[13px]">
        {children}
      </p>
    </div>
  );
}
function Checks({ items }: { items: readonly string[] }) {
  return (
    <ul className="my-6 space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 text-[11px] leading-relaxed text-[#6b577a]"
        >
          <Check
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[#9a7bac]"
          />
          {item}
        </li>
      ))}
    </ul>
  );
}
function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 border-t border-marketing-nav-border pt-5">
      <p className="text-[8px] font-semibold uppercase tracking-[1.4px] text-[#a08aaf]">
        {title}
      </p>
      <p className="mt-2 text-[11px] leading-[1.8] text-marketing-copy">
        {children}
      </p>
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <a
        href="#applications-main"
        className="fixed left-4 top-4 z-50 -translate-y-32 rounded-lg bg-[#7e6094] px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNavigation page="applications" />
      <main id="applications-main">
        <section className={`${container} pb-8 pt-12 text-center md:pt-16`}>
          <Chapter>NetSentry applications / Find your starting point</Chapter>
          <h1 className="mb-6 font-[inherit] text-[38px] font-semibold leading-[1.15] tracking-[-.045em] md:text-[clamp(38px,4.4vw,64px)]">
            One workspace.
            <br />
            <span className={accent}>The right app for your day.</span>
          </h1>
          <p className="mx-auto max-w-[650px] text-[13px] leading-[1.9] text-marketing-copy md:text-[15px]">
            A wider view on the web. Supported insights on your phone. Developer
            tools on your computer. Get to know each NetSentry app and choose
            where to begin.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="#applications-choose" className={primaryButton}>
              Explore the applications
            </a>
            <a href="#applications-compare" className={button}>
              Compare the apps
            </a>
          </div>
          <p className="mt-4 text-[10px] text-marketing-caption">
            Product in development · Availability varies by platform
          </p>
        </section>
        <section
          id="applications-choose"
          aria-label="Choose an application"
          className={`${container} scroll-mt-28 pb-12 md:pb-16`}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {apps.map(({ id, name, icon: Icon, description, stage }) => (
              <a
                key={id}
                href={`#applications-${id}`}
                className="rounded-xl border border-marketing-nav-border bg-white px-4 pb-4 pt-5 hover:border-[#bda4cd] hover:bg-[#fcfaff] md:px-6 md:pb-5 md:pt-6"
              >
                <span className="mb-4 inline-flex rounded-[10px] bg-[#f0e9f5] p-2.5 text-[#9a7bac]">
                  <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <h2 className="font-[inherit] text-[17px] font-semibold leading-tight tracking-[-.025em] md:text-[19px]">
                  {name}
                </h2>
                <p className="mt-3 min-h-[57px] text-[11px] leading-[1.7] text-marketing-copy md:min-h-[42px] md:text-xs">
                  {description}
                </p>
                <p className="mt-4 min-h-10 border-t border-marketing-nav-border pt-3 text-[9px] text-[#947da1] md:mt-5 md:text-[10px]">
                  {stage}
                </p>
              </a>
            ))}
          </div>
          <p className="mt-5 text-center text-[10px] leading-relaxed text-marketing-caption">
            Each app has a different role. Permissions and supported sources
            determine what it can do.
          </p>
        </section>
        <section id="applications-web" className={`${section} ${tinted}`}>
          <div className={container}>
            <Heading
              eyebrow="01 / Web dashboard"
              title={
                <>
                  Your workspace.
                  <br />
                  <span className={accent}>The bigger picture.</span>
                </>
              }
            >
              Start in your browser. Review reported devices, explore available
              usage and manage the people and settings in your workspace.
            </Heading>
            <ApplicationPreview app="dashboard" />
            <div className="mt-8 grid gap-5 md:grid-cols-3 md:gap-8">
              {[
                [
                  "Your devices and reports",
                  "Device inventory, supported usage, data sources and coverage.",
                ],
                [
                  "Your alerts and people",
                  "Relevant alerts, family/team workflows and scoped sharing.",
                ],
                [
                  "Your account and choices",
                  "Workspace access, account settings and privacy controls.",
                ],
              ].map(([title, text]) => (
                <div key={title}>
                  <h3 className="font-[inherit] text-sm font-semibold text-[#645170]">
                    {title}
                  </h3>
                  <p className={`${muted} mt-2`}>{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 border-t border-marketing-nav-border pt-5 md:flex md:items-baseline md:gap-8">
              <p className="shrink-0 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#947da1]">
                Before you begin
              </p>
              <p className="mt-2 text-[11px] leading-[1.8] text-marketing-copy md:mt-0">
                An account and workspace. Reports need supported, authorized
                devices to provide data.
              </p>
            </div>
          </div>
        </section>
        <section id="applications-phones" className={`${container} ${section}`}>
          <div className="mx-auto max-w-[700px] text-center">
            <Chapter>02 / Android &amp; iOS</Chapter>
            <Title>
              For your phone.
              <br />
              <span className={accent}>With your choices built in.</span>
            </Title>
            <p className="mx-auto mt-6 max-w-[580px] text-xs leading-[1.8] text-marketing-copy md:text-sm">
              Pair a device, review authorized reports and manage your sharing.
              The available collection and control features depend on your
              operating system.
            </p>
          </div>
          <div className="mt-8 grid items-stretch gap-6 md:mt-10 md:grid-cols-2">
            {mobileApps.map(
              ({ id, name, title, description, features, note }) => (
                <article
                  key={id}
                  id={`applications-${id}`}
                  className="scroll-mt-28 overflow-hidden rounded-[14px] border border-marketing-nav-border bg-white"
                >
                  <div className="flex items-center justify-between gap-4 px-6 py-5">
                    <span className="flex items-center gap-3 text-[13px] font-semibold text-[#715c80]">
                      <Smartphone
                        size={20}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="text-[#9a7bac]"
                      />
                      {name}
                    </span>
                    <span className={status}>In development</span>
                  </div>
                  <ApplicationPreview app={id} />
                  <div className="p-6 md:p-7">
                    <h3 className="max-w-[350px] font-[inherit] text-[23px] font-semibold leading-[1.15] tracking-[-.025em] md:text-[22px]">
                      {title}
                    </h3>
                    <p className={`${muted} mt-4 md:min-h-[46px]`}>
                      {description}
                    </p>
                    <Checks items={features} />
                    <Note title="What to know">{note}</Note>
                  </div>
                </article>
              ),
            )}
          </div>
          <p className={caption}>
            Mobile design reconstructions · Native build, signing and
            physical-device checks remain pending.
          </p>
        </section>
        <section id="applications-desktop" className={`${section} ${tinted}`}>
          <div className={container}>
            <Heading
              eyebrow="03 / Desktop app"
              title={
                <>
                  Your computer.
                  <br />
                  <span className={accent}>Your services, in focus.</span>
                </>
              }
            >
              Connect to the local agent. Inspect services, projects and
              listening ports on supported computers, then review any action
              before it runs.
            </Heading>
            <div className="grid items-center gap-8 lg:grid-cols-[1.45fr_.9fr] lg:gap-11">
              <div className="min-w-0">
                <ApplicationPreview app="desktop" />
              </div>
              <div>
                <span className={status}>macOS is the initial target</span>
                <h3 className="mt-5 font-[inherit] text-[25px] font-semibold leading-[1.15] tracking-[-.025em]">
                  Know what is running.
                  <br />
                  Choose what happens next.
                </h3>
                <Checks
                  items={[
                    "Review services and project groups",
                    "Inspect the exact target before acting",
                    "Check recorded action outcomes",
                  ]}
                />
                <p className={muted}>
                  Graceful stop and force-stop need separate confirmation.
                  Remote requests also require pairing, explicit local consent
                  and current controller grants.
                </p>
                <Note title="Before you begin">
                  A compatible signed build, local agent setup and pairing.
                  Native release checks are still pending.
                </Note>
              </div>
            </div>
          </div>
        </section>
        <section
          id="applications-compare"
          className={`${container} ${section}`}
        >
          <Heading
            eyebrow="Choose by what you need"
            title={
              <>
                Different apps.
                <br />
                <span className={accent}>A shared understanding.</span>
              </>
            }
          >
            Start with the role that fits your day. Having an app or an account
            does not automatically enable collection or control.
          </Heading>
          <p className="mb-3 text-[10px] text-marketing-caption lg:hidden">
            Scroll across to compare all four applications.
          </p>
          <div
            role="region"
            aria-label="Application comparison"
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-marketing-nav-border"
          >
            <table className="w-full min-w-[750px] table-fixed border-collapse bg-white text-left text-[11px] leading-[1.8] md:min-w-[790px]">
              <caption className="sr-only">
                NetSentry application roles and setup requirements
              </caption>
              <thead>
                <tr>
                  {["At a glance", ...apps.map((app) => app.name)].map(
                    (title) => (
                      <th
                        key={title}
                        scope="col"
                        className="border-r border-marketing-nav-border bg-[#f5f0f8] px-4 py-5 text-xs font-semibold text-[#715c80] last:border-r-0 md:px-5"
                      >
                        {title}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {comparison.map(([title, ...cells]) => (
                  <tr
                    key={title}
                    className="border-t border-marketing-nav-border"
                  >
                    <th
                      scope="row"
                      className="border-r border-marketing-nav-border bg-[#fcfafd] px-4 py-5 align-top font-medium text-[#715c80] md:px-5"
                    >
                      {title}
                    </th>
                    {cells.map((cell, index) => (
                      <td
                        key={index}
                        className="border-r border-marketing-nav-border px-4 py-5 align-top text-marketing-copy last:border-r-0 md:px-5"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={caption}>
            This is a guide to app roles, not a promise of feature parity or
            public release availability.
          </p>
        </section>
        <section id="applications-setup" className={`${section} ${tinted}`}>
          <div className={container}>
            <div className="mx-auto max-w-[700px] text-center">
              <Chapter>When your supported app is ready</Chapter>
              <Title>
                Begin with one device.
                <br />
                <span className={accent}>Build your picture from there.</span>
              </Title>
              <p className="mt-6 text-xs leading-[1.8] text-marketing-copy md:text-sm">
                You do not need every application to understand where NetSentry
                can help.
              </p>
            </div>
            <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
              {[
                [
                  "Choose your starting point",
                  "Use the web for the wider view, a phone for supported mobile workflows or desktop for local services.",
                ],
                [
                  "Review the requirements",
                  "Check availability, supported sources and permissions before installing or pairing an app.",
                ],
                [
                  "Make your choices",
                  "Choose supported collection and sharing. Review sources, gaps and outcomes in your workspace.",
                ],
              ].map(([title, text], index) => (
                <li
                  key={title}
                  className="grid grid-cols-[35px_1fr] gap-x-4 gap-y-2 border-t border-marketing-nav-border pt-5 md:block"
                >
                  <span className="row-span-2 text-[27px] leading-none text-[#b095c1] md:mb-5 md:block">
                    0{index + 1}
                  </span>
                  <h3 className="font-[inherit] text-[17px] font-semibold leading-tight tracking-[-.025em]">
                    {title}
                  </h3>
                  <p className="col-start-2 mt-1 text-xs leading-[1.8] text-marketing-copy md:mt-3">
                    {text}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-9 flex items-start gap-5 rounded-xl border border-[#e8dfee] bg-marketing-hover p-5 md:items-center md:px-7 md:py-6">
              <ShieldCheck
                size={22}
                strokeWidth={1.5}
                aria-hidden="true"
                className="mt-1 shrink-0 text-[#9a7bac] md:mt-0"
              />
              <div>
                <h3 className="font-[inherit] text-xs font-semibold leading-relaxed text-[#715c80]">
                  Pairing connects a device. Consent determines what comes next.
                </h3>
                <p className="mt-1 text-[11px] leading-[1.8] text-marketing-copy">
                  Account access, collection permissions, sharing and
                  remote-control grants are separate choices.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="applications-availability"
          className={`${container} ${section}`}
        >
          <Heading
            eyebrow="A few things to know first"
            title={
              <>
                Clear expectations.
                <br />
                <span className={accent}>Before you begin.</span>
              </>
            }
          >
            Supported features vary between platforms. NetSentry shows
            limitations rather than turning missing data into a measurement.
          </Heading>
          {faqs.map(([question, answer], index) => (
            <details
              key={question}
              open={index === 0}
              className="group mb-5 border-b border-marketing-nav-border pb-5"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-xs text-[#705781] md:text-[13px] [&::-webkit-details-marker]:hidden">
                {question}
                <span
                  aria-hidden="true"
                  className="text-xl text-[#af91c2] group-open:hidden"
                >
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="hidden text-xl text-[#af91c2] group-open:inline"
                >
                  −
                </span>
              </summary>
              <p className="mt-3 max-w-[830px] text-xs leading-[1.9] text-marketing-copy">
                {answer}
              </p>
            </details>
          ))}
        </section>
        <section className={`${container} pb-[53px] text-center md:pb-20`}>
          <Chapter>Your devices. Your workspace. Your choices.</Chapter>
          <Title>
            Find your starting point.
            <br />
            <span className={accent}>Keep the bigger picture.</span>
          </Title>
          <p className="mx-auto mt-6 max-w-[480px] text-xs leading-[1.8] text-marketing-copy md:text-sm">
            Explore the product story or take another look at the app that fits
            your needs.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link className={primaryButton} href="/product">
              Explore the product
            </Link>
            <a className={button} href="#applications-choose">
              Choose an application
            </a>
          </div>
        </section>
      </main>
      <footer className="border-t border-marketing-nav-border bg-white py-8">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:gap-8">
            <Link href="/" aria-label="NetSentry home">
              <Brand />
            </Link>
            <p className="text-[11px] leading-[1.8] text-marketing-caption">
              Device reports, digital wellbeing and developer tools.
              <br />
              Built around supported data and explicit choices.
            </p>
          </div>
          <div className="mt-7 flex flex-col justify-between gap-4 border-t border-marketing-nav-border pt-5 text-[10px] text-marketing-caption md:flex-row">
            <p>
              © <CopyrightYear /> NetSentry
            </p>
            <div className="flex flex-wrap gap-6">
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms and Conditions</Link>
              <Link href="/">Home</Link>
              <Link href="/product">Product</Link>
              <a href="#applications-availability">Availability</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
