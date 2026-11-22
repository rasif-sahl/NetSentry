import motion from "@/features/marketing/public-motion.module.css";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChartNoAxesColumnIncreasing,
  Check,
  LayoutGrid,
  LockKeyhole,
  Monitor,
  ShieldCheck,
  Smartphone,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { CopyrightYear } from "@/features/marketing/copyright-year";
import { FeatureExplorer } from "./feature-explorer";
import {
  Brand,
  button,
  caption,
  Chapter,
  container,
  primaryButton,
  ProductImage,
  Title,
  WindowFrame,
} from "@/features/marketing/ui";

const accent = "text-[#7e6094]";
const section = "scroll-mt-28 py-[53px] md:py-20";
const tinted = "border-y border-[#eee6f2] bg-[#f9f7fb]";
const muted = "text-xs leading-[1.8] text-marketing-copy md:text-[13px]";
const quiet = "text-[10px] leading-[1.8] text-marketing-caption md:text-[11px]";

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={`${motion.reveal} mb-7 grid gap-5 md:mb-9 md:grid-cols-[1.2fr_.8fr] md:items-end md:gap-16`}
    >
      <div>
        <Chapter>{eyebrow}</Chapter>
        <Title>{title}</Title>
      </div>
      <p className={`${muted} max-w-[390px]`}>{children}</p>
    </div>
  );
}

function CardTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-[13px] font-semibold text-[#715c80]">
      <Icon
        size={20}
        strokeWidth={1.5}
        className="shrink-0 text-[#9a7bac]"
        aria-hidden="true"
      />
      {children}
    </div>
  );
}

function Steps({ items }: { items: { title: string; description: string }[] }) {
  return (
    <ol
      className={`${motion.stagger} mt-10 grid gap-6 md:grid-cols-3 md:gap-8`}
    >
      {items.map(({ title, description }, index) => (
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
          <p className="col-start-2 text-xs leading-[1.8] text-marketing-copy md:mt-3">
            {description}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function ProductPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <main id="product-main" tabIndex={-1}>
        <section
          id="product-top"
          className={`${container} scroll-mt-28 pb-5 pt-12 text-center md:pt-16`}
        >
          <div className={motion.intro}>
            <Chapter>The product / A closer look at NetSentry</Chapter>
            <h1 className="mb-6 font-[inherit] text-[38px] font-semibold leading-[1.15] tracking-[-.045em] md:text-[clamp(38px,4.4vw,64px)]">
              A clearer view of your devices.
              <br />
              <span className={accent}>More context for every decision.</span>
            </h1>
            <p className="mx-auto max-w-[650px] text-[13px] leading-[1.9] text-marketing-copy md:text-[15px]">
              Bring device reports, digital habits and developer services into
              one workspace. Understand what the data says, where it came from
              and what you can do next.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a className={primaryButton} href="#product-features">
                Explore the features
              </a>
              <a className={button} href="#product-how-it-fits">
                See how it fits together
              </a>
            </div>
            <p className="mt-4 text-[10px] text-marketing-caption">
              Product in development · Features depend on platform and
              permissions
            </p>
          </div>
          <div
            className={`${motion.preview} mx-auto mt-8 max-w-[1050px] md:mt-11`}
          >
            <WindowFrame title="NetSentry · Your workspace">
              <div className="aspect-[1.55] overflow-hidden md:aspect-[2.15]">
                <ProductImage
                  src="/product/dashboard.png"
                  alt="Web dashboard overview with navigation, device cards and an empty inventory"
                  full
                  preload
                />
              </div>
            </WindowFrame>
          </div>
          <p className={caption}>
            Web workspace preview · Empty example, not live monitoring data.
          </p>
        </section>
        <nav
          aria-label="On this page"
          className={`${container} mt-5 flex flex-wrap justify-center gap-x-5 gap-y-3 border-y border-marketing-nav-border py-5 text-[10px] text-[#7e6d8b] md:gap-x-8 md:text-[11px]`}
        >
          {[
            ["Devices", "#product-devices"],
            ["Reports & alerts", "#product-reports"],
            ["Shared workspaces", "#product-sharing"],
            ["Developer tools", "#product-developer"],
            ["Applications", "#product-applications"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="hover:text-[#604675]">
              {label}
            </a>
          ))}
        </nav>
        <section id="product-features" className={`${container} ${section}`}>
          <SectionHeading
            eyebrow="Start with what you want to understand"
            title={
              <>
                Find the detail.
                <br />
                <span className={accent}>Keep the bigger picture.</span>
              </>
            }
          >
            Different questions need different tools. Explore the parts of
            NetSentry that make those questions easier to answer.
          </SectionHeading>
          <FeatureExplorer />
        </section>
        <section id="product-devices" className={`${section} ${tinted}`}>
          <div
            className={`${motion.reveal} ${container} grid items-center gap-8 md:grid-cols-[1.1fr_.9fr] md:gap-20`}
          >
            <div>
              <Chapter>01 / Know your devices</Chapter>
              <Title>
                Every device has a source.
                <br />
                <span className={accent}>Every report has a context.</span>
              </Title>
              <p className="mt-6 text-xs leading-[1.8] text-marketing-copy md:text-sm">
                See the devices registered to your workspace, then look closer
                at what each installation can report. A missing reading stays
                missing. A capability tells you what is supported.
              </p>
              <ul className="my-6 space-y-3">
                {[
                  "Find and organize registered devices",
                  "Review permissions, capabilities and health",
                  "Manage collection, pause and revocation",
                ].map((text) => (
                  <li
                    key={text}
                    className="flex items-start gap-3 text-xs text-[#6b577a]"
                  >
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-[#9a7bac]"
                      aria-hidden="true"
                    />
                    {text}
                  </li>
                ))}
              </ul>
              <p className={`${quiet} max-w-[470px]`}>
                Network observations are separate from enrolled devices.
                Discovery alone does not establish per-device traffic
                measurement.
              </p>
            </div>
            <div className="rounded-[14px] border border-marketing-nav-border bg-white p-6 md:p-8">
              <CardTitle icon={Smartphone}>A device, understood</CardTitle>
              {[
                {
                  label: "Identity",
                  title: "Which device reported it?",
                  text: "Installation and workspace association",
                },
                {
                  label: "Capability",
                  title: "What can it report?",
                  text: "Supported sources and required permissions",
                },
                {
                  label: "Control",
                  title: "What have you allowed?",
                  text: "Collection choices and current consent",
                },
              ].map(({ label, title, text }) => (
                <div
                  key={label}
                  className="border-b border-marketing-nav-border py-5"
                >
                  <p className="mb-1 text-[8px] uppercase tracking-[1.6px] text-[#a08aaf]">
                    {label}
                  </p>
                  <h3 className="font-[inherit] text-sm font-semibold">
                    {title}
                  </h3>
                  <p className="mt-1 text-[11px] text-marketing-copy">{text}</p>
                </div>
              ))}
              <p className="mt-4 text-[9px] text-[#9a87a5]">
                Conceptual guide · No live device status shown
              </p>
            </div>
          </div>
        </section>
        <section id="product-reports" className={`${container} ${section}`}>
          <SectionHeading
            eyebrow="02 / Understand the activity"
            title={
              <>
                Useful reports begin
                <br />
                <span className={accent}>with honest data.</span>
              </>
            }
          >
            Review available usage, compare periods and follow relevant alerts.
            Understand how complete the picture is before deciding what it
            means.
          </SectionHeading>
          <div
            className={`${motion.stagger} grid gap-7 md:grid-cols-3 md:gap-8`}
          >
            {[
              {
                icon: ChartNoAxesColumnIncreasing,
                title: "Look across time",
                text: "Daily, weekly and monthly views for supported measurements, with comparison periods and report exports.",
              },
              {
                icon: LayoutGrid,
                title: "Read the context",
                text: "Source, time coverage and missing periods remain visible. Measured and estimated values stay distinct.",
              },
              {
                icon: ShieldCheck,
                title: "Follow what matters",
                text: "Review alert rules, quiet hours, severity and acknowledgements. Delivery depends on the configured channel.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="grid grid-cols-[25px_1fr] gap-x-4 gap-y-3 border-t border-marketing-nav-border pt-6 md:block"
              >
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="row-span-2 text-[#9a7bac] md:mb-4"
                />
                <h3 className="font-[inherit] text-lg font-semibold leading-tight tracking-[-.025em]">
                  {title}
                </h3>
                <p className="col-start-2 text-xs leading-[1.85] text-marketing-copy md:mt-4">
                  {text}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-9 grid gap-5 rounded-xl border border-marketing-nav-border bg-[#faf8fc] p-6 md:grid-cols-[1.15fr_1fr_1fr_1fr] md:gap-6">
            <p className="pt-1 text-[9px] font-semibold uppercase tracking-[1.8px] text-[#947da1]">
              How to read a report
            </p>
            {[
              ["Measured", "Reported by an identified, supported source."],
              ["Estimated", "Clearly labelled when a value is an estimate."],
              ["Unavailable", "Missing or unsupported does not mean zero."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="border-t border-marketing-nav-border pt-4 md:border-0 md:pt-0"
              >
                <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
                  {title}
                </h3>
                <p className="mt-2 text-[11px] leading-[1.8] text-marketing-copy">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section id="product-sharing" className={`${section} ${tinted}`}>
          <div className={container}>
            <SectionHeading
              eyebrow="03 / Share with a purpose"
              title={
                <>
                  A shared workspace.
                  <br />
                  <span className={accent}>Clear personal boundaries.</span>
                </>
              }
            >
              Bring people into the picture with explicit sharing choices. Being
              in the same workspace does not give everyone the same access.
            </SectionHeading>
            <div
              className={`${motion.stagger} grid gap-5 md:grid-cols-2 md:gap-6`}
            >
              {[
                {
                  icon: UsersRound,
                  label: "For your family",
                  title: "Support better digital habits.",
                  text: "Review supported shared wellbeing reports, child profiles, time requests and policy status within the permissions you have.",
                  note: "Controls depend on platform support and authorization.",
                },
                {
                  icon: LayoutGrid,
                  label: "For your team",
                  title: "Keep responsibilities in scope.",
                  text: "Organize devices and reporting around business workspaces, roles and explicitly accepted employee sharing.",
                  note: "Organization roles and consent govern access.",
                },
              ].map(({ icon, label, title, text, note }) => (
                <article
                  key={label}
                  className="rounded-xl border border-marketing-nav-border bg-white p-6 md:p-7"
                >
                  <CardTitle icon={icon}>{label}</CardTitle>
                  <h3 className="mt-6 font-[inherit] text-[23px] font-semibold leading-tight tracking-[-.025em]">
                    {title}
                  </h3>
                  <p className={`${muted} mt-4`}>{text}</p>
                  <p className="mt-6 border-t border-marketing-nav-border pt-4 text-[10px] leading-[1.8] text-marketing-caption">
                    {note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="product-developer" className={`${container} ${section}`}>
          <SectionHeading
            eyebrow="04 / Bring your development workspace into focus"
            title={
              <>
                Know what is running.
                <br />
                <span className={accent}>Review what happens next.</span>
              </>
            }
          >
            Connect the desktop app to the local agent. Inspect supported
            services by project, runtime, process or listening port.
          </SectionHeading>
          <div className={motion.previewReveal}>
            <WindowFrame title="NetSentry Desktop · Service inventory">
              <div className="aspect-[1.75] overflow-hidden">
                <ProductImage
                  src="/product/services.png"
                  alt="Desktop service inventory with a rounded sidebar, search and empty services list"
                  full
                />
              </div>
            </WindowFrame>
          </div>
          <p className={caption}>
            Desktop renderer preview · Empty service inventory. Native release
            checks remain pending.
          </p>
          <Steps
            items={[
              {
                title: "Inspect the service",
                description:
                  "Review its project, runtime and exact process identity.",
              },
              {
                title: "Choose an action",
                description:
                  "Graceful stop and force-stop require separate confirmation.",
              },
              {
                title: "Check the outcome",
                description:
                  "Accepted or pending does not prove that a service stopped.",
              },
            ]}
          />
          <p className={`${quiet} mt-6 text-center`}>
            Remote requests also require pairing, explicit local consent and
            current controller grants.
          </p>
        </section>
        <section id="product-applications" className={`${section} ${tinted}`}>
          <div className={container}>
            <div
              className={`${motion.reveal} mx-auto max-w-[700px] text-center`}
            >
              <Chapter>The right view, where you need it</Chapter>
              <Title>
                One workspace.
                <br />
                <span className={accent}>Apps with different roles.</span>
              </Title>
              <p className="mx-auto mt-6 max-w-[580px] text-xs leading-[1.8] text-marketing-copy md:text-sm">
                Use the web for the wider view, your phone for supported mobile
                workflows and the desktop app for your computer’s services.
              </p>
            </div>
            <div className="mt-8 grid items-center gap-8 md:mt-11 md:grid-cols-2 md:gap-20">
              <div>
                {[
                  {
                    icon: LayoutGrid,
                    title: "Web dashboard",
                    text: "Reports, devices, alerts, workspaces and account settings in your browser.",
                  },
                  {
                    icon: Smartphone,
                    title: "Android & iOS",
                    text: "Pair devices, review authorized reports and manage sharing. Collection and Screen Time support differ by operating system.",
                  },
                  {
                    icon: Monitor,
                    title: "Desktop app",
                    text: "Connect the local agent, review services and manage supported developer workflows. macOS is the initial target.",
                  },
                ].map(({ icon, title, text }) => (
                  <article
                    key={title}
                    className="border-b border-marketing-nav-border py-6 first:pt-0 last:border-0"
                  >
                    <CardTitle icon={icon}>{title}</CardTitle>
                    <p className="ml-8 mt-3 text-xs leading-[1.8] text-marketing-copy">
                      {text}
                    </p>
                  </article>
                ))}
              </div>
              <div
                className={`${motion.stagger} mx-auto grid w-full max-w-[350px] grid-cols-2 gap-5 md:max-w-[430px] md:gap-6`}
              >
                {[
                  {
                    name: "Android",
                    src: "/product/android.png",
                    alt: "Android Home design with upright screen and floating bottom tabs",
                  },
                  {
                    name: "iOS",
                    src: "/product/ios.png",
                    alt: "iOS Home design with upright screen and floating bottom navigation",
                  },
                ].map(({ name, src, alt }) => (
                  <figure key={name}>
                    <div className="overflow-hidden rounded-[24px] border-[3px] border-[#5f5368] bg-[#5f5368] md:rounded-[27px]">
                      <ProductImage src={src} alt={alt} phone />
                    </div>
                    <figcaption className="mt-4 text-center text-[13px] font-semibold">
                      {name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <p className={caption}>
              Mobile design reconstructions · Native build, signing and
              physical-device validation remain pending.
            </p>
            <details className="group mx-auto mt-8 max-w-[800px] border-y border-marketing-nav-border py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-xs text-[#715c80] [&::-webkit-details-marker]:hidden">
                What should I know about platform availability?
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
              <p className={`${muted} mt-3`}>
                NetSentry is in development. Android usage collection requires
                supported sources and user-granted access. iOS does not
                generally expose device-wide mobile/Wi-Fi totals; Apple Screen
                Time features require separate eligibility and authorization.
                Router functions depend on a tested adapter and hardware.
                Download options are not yet published.
              </p>
            </details>
          </div>
        </section>
        <section id="product-how-it-fits" className={`${container} ${section}`}>
          <div className={`${motion.reveal} mx-auto max-w-[700px] text-center`}>
            <Chapter>From your device to your workspace</Chapter>
            <Title>
              A connected picture.
              <br />
              <span className={accent}>A clear path to it.</span>
            </Title>
            <p className="mt-6 text-xs leading-[1.8] text-marketing-copy md:text-sm">
              Each part has a role. Collection starts with your choices and a
              supported source.
            </p>
          </div>
          <Steps
            items={[
              {
                title: "Your installation",
                description:
                  "Pair the appropriate app or agent and review what it supports.",
              },
              {
                title: "Your permissions",
                description:
                  "Choose supported collection and sharing with explicit consent.",
              },
              {
                title: "Your workspace",
                description:
                  "Review authorized reports, sources, gaps and confirmed outcomes.",
              },
            ]}
          />
        </section>
        <section id="product-privacy" className={`${container} scroll-mt-28`}>
          <div
            className={`${motion.reveal} grid items-center gap-5 rounded-[14px] border border-[#e8dfee] bg-marketing-hover p-7 md:grid-cols-2 md:gap-16 md:p-11`}
          >
            <div>
              <Chapter>Your choices / At every step</Chapter>
              <Title>
                More understanding.
                <br />
                <span className={accent}>You keep the say.</span>
              </Title>
              <p className={`${muted} mt-6`}>
                Account access, device pairing, collection permissions and
                control grants are separate choices.
              </p>
            </div>
            <div>
              {[
                {
                  icon: LockKeyhole,
                  title: "Choose what is collected",
                  text: "Supported permissions and fresh consent come first.",
                },
                {
                  icon: UsersRound,
                  title: "Review who can see or act",
                  text: "Roles, sharing and controller grants stay explicit.",
                },
                {
                  icon: ShieldCheck,
                  title: "Pause, revoke or leave",
                  text: "Privacy controls remain part of the product journey.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="flex items-center gap-5 border-b border-[#e4d8ec] py-4 last:border-0"
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0 text-[#9a7bac]"
                  />
                  <div>
                    <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
                      {title}
                    </h3>
                    <p className="mt-1 text-[11px] leading-[1.8] text-marketing-copy">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          className={`${motion.reveal} ${container} ${section} text-center`}
        >
          <Chapter>Start with the part that matters to you</Chapter>
          <Title>
            Get to know your devices.
            <br />
            <span className={accent}>Make the next step yours.</span>
          </Title>
          <p className="mx-auto mt-6 max-w-[480px] text-xs leading-[1.8] text-marketing-copy md:text-sm">
            Explore the applications and review their availability before you
            begin.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link className={primaryButton} href="/applications">
              Explore the applications
            </Link>
            <Link className={button} href="/">
              Back to the home page
            </Link>
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
              <a href="#product-features">Features</a>
              <Link href="/applications">Applications</Link>
              <a href="#product-privacy">Privacy &amp; choice</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
