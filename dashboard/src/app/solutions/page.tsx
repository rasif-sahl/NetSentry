import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  Check,
  Code2,
  LayoutGrid,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { CopyrightYear } from "@/components/marketing/copyright-year";
import { MarketingNavigation } from "@/components/marketing/navigation";
import { SolutionPreview } from "@/components/marketing/solution-preview";
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
} from "@/components/marketing/ui";

export const metadata: Metadata = {
  title: "NetSentry — Solutions",
  description:
    "Find your NetSentry starting point: personal device insight, shared family context, consent-based team reporting and local developer services.",
};
const section = "scroll-mt-28 py-[53px] md:py-20";
const tinted = "border-y border-[#eee6f2] bg-[#f9f7fb]";
const accent = "text-[#7e6094]";
const muted = "text-xs leading-[1.85] text-[#766a81]";
const quiet = "text-[10px] leading-[1.8] text-[#887493] md:text-[11px]";
const solutions = [
  {
    id: "personal",
    icon: UserRound,
    label: "For yourself",
    question: "“Where is my screen time going?”",
    title: "Personal insight",
    text: "Review your own available usage and reporting context.",
    app: "Web + supported phone",
  },
  {
    id: "family",
    icon: UsersRound,
    label: "For your family",
    question: "“How can we review our digital habits together?”",
    title: "Shared family context",
    text: "Review authorized wellbeing reports and family requests.",
    app: "Family workspace + mobile",
  },
  {
    id: "teams",
    icon: Building2,
    label: "For your team",
    question: "“Which devices and reports are in our scope?”",
    title: "Team reporting",
    text: "Organize consent-based reporting within business roles.",
    app: "Business workspace on the web",
  },
  {
    id: "developers",
    icon: Code2,
    label: "For your projects",
    question: "“What services are still running?”",
    title: "Developer services",
    text: "Review local services, exact targets and action outcomes.",
    app: "Desktop + local agent",
  },
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
      <p className="text-xs leading-[1.8] text-[#766a81] md:text-[13px]">
        {children}
      </p>
    </div>
  );
}
function Checks({ items }: { items: string[] }) {
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
function StartingPoint({
  label,
  children,
  app,
}: {
  label: string;
  children: ReactNode;
  app: "web" | "phones" | "desktop";
}) {
  return (
    <div className="mt-6 border-t border-[#e8e0ed] pt-5">
      <p className="text-[8px] font-semibold uppercase tracking-[1.4px] text-[#a08aaf]">
        A good starting point
      </p>
      <p className="mt-3 text-xs font-semibold text-[#715c80]">{label}</p>
      <p className="mt-2 text-[11px] leading-[1.85] text-[#766a81]">
        {children}
      </p>
      <Link
        className="mt-4 inline-block border-b border-[#d3bedf] pb-1 text-[11px] text-[#806193]"
        href={`/applications#applications-${app}`}
      >
        Explore the applications
      </Link>
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
        aria-hidden="true"
        className="shrink-0 text-[#9a7bac]"
      />
      {children}
    </div>
  );
}

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <a
        href="#solutions-main"
        className="fixed left-4 top-4 z-50 -translate-y-32 rounded-lg bg-[#7e6094] px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNavigation page="solutions" />
      <main id="solutions-main">
        <section className={`${container} pb-8 pt-12 text-center md:pt-16`}>
          <Chapter>NetSentry solutions / Start with your everyday</Chapter>
          <h1 className="mb-6 font-[inherit] text-[38px] font-semibold leading-[1.15] tracking-[-.045em] md:text-[clamp(38px,4.4vw,64px)]">
            Different days. Different needs.
            <br />
            <span className={accent}>A clearer picture for each.</span>
          </h1>
          <p className="mx-auto max-w-[650px] text-[13px] leading-[1.9] text-[#766a81] md:text-[15px]">
            Your own digital habits. Your family’s shared routines. Your team’s
            devices. Your development workspace. Find the part of NetSentry that
            fits what you want to understand.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href="#solutions-paths" className={primaryButton}>
              Find your starting point
            </a>
            <Link href="/product" className={button}>
              Explore the product
            </Link>
          </div>
          <p className="mt-4 text-[10px] text-[#887493]">
            Product in development · Features depend on platform, permissions
            and consent
          </p>
        </section>
        <section
          id="solutions-paths"
          aria-label="Choose your solution"
          className={`${container} scroll-mt-28 pb-12 md:pb-16`}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {solutions.map(({ id, icon: Icon, label, question }) => (
              <a
                key={id}
                href={`#solutions-${id}`}
                className="rounded-xl border border-[#e8e0ed] bg-white px-4 pb-4 pt-5 hover:border-[#bda4cd] hover:bg-[#fcfaff] md:px-6 md:pb-5 md:pt-6"
              >
                <span className="mb-4 inline-flex rounded-[10px] bg-[#f0e9f5] p-2.5 text-[#9a7bac]">
                  <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <h2 className="font-[inherit] text-[17px] font-semibold leading-tight tracking-[-.025em] md:text-[19px]">
                  {label}
                </h2>
                <p className="mt-3 min-h-20 text-[11px] leading-[1.8] text-[#766a81] md:min-h-[65px] md:text-xs">
                  {question}
                </p>
                <span className="mt-4 block border-t border-[#e8e0ed] pt-3 text-[10px] text-[#8c729c]">
                  Explore this solution
                </span>
              </a>
            ))}
          </div>
        </section>
        <section id="solutions-personal" className={`${section} ${tinted}`}>
          <div className={container}>
            <Heading
              eyebrow="01 / For yourself"
              title={
                <>
                  Understand your activity.
                  <br />
                  <span className={accent}>Make room for better habits.</span>
                </>
              }
            >
              Bring supported device reports into one workspace. Start with what
              is being reported, then look at the patterns and gaps that give it
              meaning.
            </Heading>
            <div className="grid items-center gap-8 lg:grid-cols-[1.45fr_.85fr] lg:gap-11">
              <div className="min-w-0">
                <WindowFrame title="NetSentry · Personal workspace">
                  <div className="aspect-[1.5] overflow-hidden md:aspect-[1.9] lg:aspect-[1.45]">
                    <ProductImage
                      src="/product/dashboard.png"
                      alt="Upright web dashboard preview showing sidebar navigation and an empty device inventory"
                      full
                    />
                  </div>
                </WindowFrame>
                <p className={caption}>
                  Web dashboard preview · Empty workspace example, not live
                  monitoring data.
                </p>
              </div>
              <div>
                <Chapter>A moment in your day</Chapter>
                <h3 className="font-[inherit] text-2xl font-semibold leading-[1.25] tracking-[-.025em] md:text-[25px]">
                  “I want to understand
                  <br />
                  how I use my devices.”
                </h3>
                <Checks
                  items={[
                    "Review available usage over time",
                    "See the source and coverage behind a report",
                    "Adjust collection and sharing choices",
                  ]}
                />
                <p className={quiet}>
                  Reports depend on supported sources and permissions. Missing
                  data stays unavailable; estimates remain labelled.
                </p>
                <StartingPoint
                  label="Web dashboard + a supported phone app"
                  app="web"
                >
                  Review the wider picture on the web and supported mobile
                  activity on your phone.
                </StartingPoint>
              </div>
            </div>
          </div>
        </section>
        <section id="solutions-family" className={`${container} ${section}`}>
          <div className="grid items-center gap-8 md:grid-cols-[1.1fr_.9fr] md:gap-16">
            <div>
              <Chapter>02 / For your family</Chapter>
              <Title>
                Share the understanding.
                <br />
                <span className={accent}>Keep the choices explicit.</span>
              </Title>
              <p className={`${muted} mt-6 md:text-sm`}>
                Review supported shared wellbeing reports, child profiles and
                time requests. Give family conversations more context while
                keeping access and consent clear.
              </p>
              <Checks
                items={[
                  "Review shared reports within your permissions",
                  "Consider time requests and guardian decisions",
                  "See policy intent and reported support status",
                ]}
              />
              <p className={quiet}>
                Current Android and router restriction adapters do not enforce
                device limits. Apple controls require separate eligibility,
                authorization and device validation.
              </p>
              <StartingPoint
                label="A family workspace + supported mobile apps"
                app="phones"
              >
                Use authorized reports and family workflows on the web and
                mobile.
              </StartingPoint>
            </div>
            <div className="rounded-[14px] border border-[#e8e0ed] bg-white p-6 md:p-8">
              <CardTitle icon={UsersRound}>
                A family workflow, explained
              </CardTitle>
              <ol className="mt-3">
                {[
                  [
                    "Choose what is shared",
                    "Review profile assignments and explicit sharing consent.",
                  ],
                  [
                    "Review the context together",
                    "Look at available reports, coverage and time requests.",
                  ],
                  [
                    "Understand the current status",
                    "A saved rule or approved request is a decision. Applied controls need supported authority and a confirmed result.",
                  ],
                ].map(([title, text], index) => (
                  <li
                    key={title}
                    className="flex gap-5 border-b border-[#e8e0ed] py-6"
                  >
                    <span className="text-[22px] leading-tight text-[#b095c1]">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="font-[inherit] text-[17px] font-semibold leading-tight tracking-[-.025em]">
                        {title}
                      </h3>
                      <p className={`${muted} mt-3`}>{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[9px] leading-relaxed text-[#9a87a5]">
                Conceptual workflow · No live child data or applied restriction
                shown
              </p>
            </div>
          </div>
        </section>
        <section id="solutions-teams" className={`${section} ${tinted}`}>
          <div className={container}>
            <Heading
              eyebrow="03 / For your team"
              title={
                <>
                  Bring the workspace together.
                  <br />
                  <span className={accent}>Keep access in scope.</span>
                </>
              }
            >
              Organize reporting around your business workspace, locations and
              roles. Employee sharing begins with explicit acceptance for the
              assigned device.
            </Heading>
            <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr] md:gap-16">
              <div className="order-2 rounded-[14px] border border-[#e8e0ed] bg-white p-6 md:order-1 md:p-8">
                <CardTitle icon={Building2}>
                  A workspace with clear boundaries
                </CardTitle>
                <div className="mt-6 rounded-[10px] border border-[#e8dfee] bg-[#f5f0f8] p-5">
                  <p className="text-[8px] font-semibold uppercase tracking-[1.4px] text-[#a08aaf]">
                    Business workspace
                  </p>
                  <h3 className="mt-2 font-[inherit] text-[22px] font-semibold leading-tight tracking-[-.025em]">
                    Your organization
                  </h3>
                  <p className="mt-3 text-[11px] text-[#766a81]">
                    Locations, departments and assigned devices
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: UserRound,
                      title: "Employee",
                      text: "Chooses whether to accept assigned-device sharing.",
                    },
                    {
                      icon: LayoutGrid,
                      title: "Authorized viewer",
                      text: "Reviews only the information allowed by their role.",
                    },
                  ].map(({ icon: Icon, title, text }) => (
                    <div
                      key={title}
                      className="rounded-[10px] border border-[#e8e0ed] p-4"
                    >
                      <Icon
                        size={19}
                        strokeWidth={1.5}
                        aria-hidden="true"
                        className="mb-4 text-[#9a7bac]"
                      />
                      <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
                        {title}
                      </h3>
                      <p className="mt-2 text-[11px] leading-[1.8] text-[#766a81]">
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 flex items-center gap-3 border-t border-[#e8e0ed] pt-5 text-[10px] leading-[1.8] text-[#8a7299]">
                  <LockKeyhole
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  Reports follow current consent, assignments and permissions.
                </p>
                <p className="mt-4 text-[9px] leading-relaxed text-[#9a87a5]">
                  Conceptual access model · No employee activity or organization
                  data shown
                </p>
              </div>
              <div className="order-1 md:order-2">
                <Chapter>A moment in your workday</Chapter>
                <h3 className="font-[inherit] text-2xl font-semibold leading-[1.25] tracking-[-.025em] md:text-[25px]">
                  “I need a clear view
                  <br />
                  of our reporting scope.”
                </h3>
                <Checks
                  items={[
                    "Organize locations, departments and device assignments",
                    "Review authorized organization reports and network alerts",
                    "Keep employee sharing and offboarding explicit",
                  ]}
                />
                <p className={quiet}>
                  Organization reports respect sharing dates and current roles.
                  NetSentry does not produce employee productivity scores.
                </p>
                <StartingPoint
                  label="Web dashboard + authorized reporting sources"
                  app="web"
                >
                  Manage your organization on the web. Collection depends on the
                  enrolled source and its permissions.
                </StartingPoint>
              </div>
            </div>
          </div>
        </section>
        <section
          id="solutions-developers"
          className={`${container} ${section}`}
        >
          <Heading
            eyebrow="04 / For your projects"
            title={
              <>
                See the services.
                <br />
                <span className={accent}>Get back to the work.</span>
              </>
            }
          >
            Review supported local services by project, runtime, process or
            listening port. Know the exact target before choosing an action.
          </Heading>
          <SolutionPreview />
          <ol className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
            {[
              [
                "Find the service",
                "Review projects, runtimes and listening ports from the local agent.",
              ],
              [
                "Review the exact target",
                "Graceful stop and force-stop require separate confirmation.",
              ],
              [
                "Check what happened",
                "Read the recorded outcome. A pending or accepted request does not prove a service stopped.",
              ],
            ].map(([title, text], index) => (
              <li
                key={title}
                className="grid grid-cols-[35px_1fr] gap-x-4 gap-y-2 border-t border-[#e8e0ed] pt-5 md:block"
              >
                <span className="row-span-2 text-[27px] leading-none text-[#b095c1] md:mb-5 md:block">
                  0{index + 1}
                </span>
                <h3 className="font-[inherit] text-[17px] font-semibold leading-tight tracking-[-.025em]">
                  {title}
                </h3>
                <p className={`${muted} col-start-2 md:mt-3`}>{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 grid items-end gap-5 md:grid-cols-[1fr_250px] md:gap-16">
            <StartingPoint label="Desktop app + local agent" app="desktop">
              macOS is the initial target. Mobile remote requests also require
              pairing, explicit local consent and controller grants.
            </StartingPoint>
            <p className={`${quiet} md:pb-1`}>
              Native build, signing and physical-device checks remain pending.
            </p>
          </div>
        </section>
        <section id="solutions-choose" className={`${section} ${tinted}`}>
          <div className={container}>
            <div className="mx-auto max-w-[700px] text-center">
              <Chapter>Find the path that fits</Chapter>
              <Title>
                Start with a question.
                <br />
                <span className={accent}>Choose a useful next step.</span>
              </Title>
              <p className="mx-auto mt-6 max-w-[580px] text-xs leading-[1.8] text-[#766a81] md:text-sm">
                You can begin with one use case. Add supported devices and
                sharing only when they make sense for you.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {solutions.map(({ id, icon: Icon, title, text, app }) => (
                <a
                  key={id}
                  href={`#solutions-${id}`}
                  className="rounded-xl border border-[#e8e0ed] bg-white px-4 py-5 hover:border-[#bda4cd] hover:bg-[#fcfaff] md:px-6 md:py-6"
                >
                  <Icon
                    size={22}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="mb-5 text-[#9a7bac]"
                  />
                  <h3 className="font-[inherit] text-base font-semibold leading-tight tracking-[-.025em] md:text-lg">
                    {title}
                  </h3>
                  <p className="mt-4 min-h-[82px] text-[11px] leading-[1.8] text-[#766a81] md:min-h-[68px] md:text-xs">
                    {text}
                  </p>
                  <span className="mt-5 block border-t border-[#e8e0ed] pt-4 text-[10px] leading-relaxed text-[#8c729c]">
                    {app}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
        <section id="solutions-choices" className={`${container} ${section}`}>
          <div className="grid items-center gap-5 rounded-[14px] border border-[#e8dfee] bg-[#f4eff8] p-7 md:grid-cols-2 md:gap-16 md:p-11">
            <div>
              <Chapter>A shared foundation / Your choices</Chapter>
              <Title>
                Different solutions.
                <br />
                <span className={accent}>The same clear boundaries.</span>
              </Title>
              <p className={`${muted} mt-6`}>
                Account access, device pairing, collection permissions, sharing
                and remote-control grants remain separate choices.
              </p>
            </div>
            <div>
              {[
                {
                  icon: LockKeyhole,
                  title: "Choose what is collected",
                  text: "Supported sources, permissions and fresh consent come first.",
                },
                {
                  icon: UsersRound,
                  title: "Review who can see or act",
                  text: "Workspace roles and explicit grants keep access in scope.",
                },
                {
                  icon: ShieldCheck,
                  title: "Pause, revoke or leave",
                  text: "Privacy controls stay part of the everyday workflow.",
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
                    <p className="mt-1 text-[11px] leading-[1.8] text-[#766a81]">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          id="solutions-availability"
          className={`${container} scroll-mt-28 pb-3`}
        >
          <Heading
            eyebrow="Clear expectations / From the start"
            title={
              <>
                Choose with context.
                <br />
                <span className={accent}>Know what is supported.</span>
              </>
            }
          >
            NetSentry is in development. These solutions describe supported
            workflows and their boundaries, with native release validation still
            pending.
          </Heading>
          {[
            [
              "Will every feature work on every device?",
              "Features depend on the operating system, collector, permissions and integration. iOS does not generally expose device-wide mobile/Wi-Fi totals; Apple Screen Time requires separate eligibility and authorization. Router capabilities depend on verified hardware and adapters.",
            ],
            [
              "Does sharing a workspace grant monitoring or control?",
              "No. Membership, device pairing, collection consent and remote-control permission are separate. Family decisions and business roles do not create device-control authority.",
            ],
          ].map(([question, answer]) => (
            <details
              key={question}
              className="group mb-5 border-b border-[#e8e0ed] pb-5"
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
              <p className="mt-3 max-w-[870px] text-xs leading-[1.9] text-[#766a81]">
                {answer}
              </p>
            </details>
          ))}
        </section>
        <section className={`${container} ${section} text-center`}>
          <Chapter>Your everyday. A clearer picture.</Chapter>
          <Title>
            Find your starting point.
            <br />
            <span className={accent}>Make the next step yours.</span>
          </Title>
          <p className="mx-auto mt-6 max-w-[500px] text-xs leading-[1.8] text-[#766a81] md:text-sm">
            Explore the applications and their availability, or take a closer
            look at how NetSentry fits together.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link className={primaryButton} href="/applications">
              Explore the applications
            </Link>
            <Link className={button} href="/product">
              Explore the product
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e8e0ed] bg-white py-8">
        <div className={container}>
          <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:gap-8">
            <Link href="/" aria-label="NetSentry home">
              <Brand />
            </Link>
            <p className="text-[11px] leading-[1.8] text-[#887493]">
              Device reports, digital wellbeing and developer tools.
              <br />
              Built around supported data and explicit choices.
            </p>
          </div>
          <div className="mt-7 flex flex-col justify-between gap-4 border-t border-[#e8e0ed] pt-5 text-[10px] text-[#887493] md:flex-row">
            <p>
              © <CopyrightYear /> NetSentry
            </p>
            <div className="flex flex-wrap gap-6">
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms and Conditions</Link>
              <Link href="/">Home</Link>
              <Link href="/applications">Applications</Link>
              <a href="#solutions-choices">Privacy &amp; choice</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
