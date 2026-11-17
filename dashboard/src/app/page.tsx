import Link from "next/link";
import { CopyrightYear } from "@/components/marketing/copyright-year";
import {
  Building2,
  Check,
  Clock3,
  Code2,
  Eye,
  LayoutGrid,
  LockKeyhole,
  Monitor,
  Network,
  PauseCircle,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";
import { MarketingNavigation } from "@/components/marketing/navigation";
import { ProductShowcase } from "@/components/marketing/product-showcase";
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

const muted = "text-sm leading-[1.9] text-[#766a81]";
const accent = "text-[#7e6094]";
const section =
  "scroll-mt-28 border-y border-[#eee6f2] bg-[#f9f7fb] py-16 md:py-20";
const faqs = [
  [
    "Can I download every app today?",
    "NetSentry is in development. Native build, signing and physical-device validation are still in progress. Download options will be published when release readiness is confirmed.",
  ],
  [
    "Does every feature work on every device?",
    "No. Features depend on the operating system, permissions, collector and integration. iOS does not generally expose device-wide mobile/Wi-Fi totals; Apple Screen Time features require separate authorization. Unsupported or missing data stays unavailable.",
  ],
  [
    "Does signing in start monitoring?",
    "No. Account access, device pairing, collection permissions and sharing consent are separate steps. Monitoring requires the relevant supported permissions and explicit consent.",
  ],
  [
    "Can I control a computer remotely?",
    "Only supported, paired computers with explicit local consent and current controller grants may accept requests. An accepted or pending request does not prove that a service stopped; the recorded outcome matters.",
  ],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fdfcfe] font-['Avenir_Next','Segoe_UI',Arial,sans-serif] text-[#2c2437] selection:bg-[#e7dcef]">
      <a
        href="#main"
        className="fixed left-4 top-4 z-50 -translate-y-32 rounded-lg bg-[#7e6094] px-4 py-3 text-sm text-white focus:translate-y-0"
      >
        Skip to content
      </a>
      <MarketingNavigation />
      <main id="main">
        <section
          className="pb-5 pt-12 text-center md:pt-16"
          aria-labelledby="hero-title"
        >
          <div className={container}>
            <p className="text-[9px] font-bold uppercase leading-relaxed tracking-[1.7px] text-[#8d779b] md:text-[10px]">
              A connected view. A more intentional digital life.
            </p>
            <h1
              id="hero-title"
              className="my-6 font-[inherit] text-[39px] font-semibold leading-[1.08] tracking-[-0.045em] md:text-[66px]"
            >
              Your devices tell a story.
              <br />
              <span className={accent}>Bring it into focus.</span>
            </h1>
            <p
              className={`${muted} mx-auto max-w-[615px] text-[13px] md:text-[15px]`}
            >
              Your phone, your computer, your network. Meet NetSentry: a
              workspace for device reports, digital wellbeing and developer
              tools. Understand what’s happening. Choose what happens next.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="#story" className={primaryButton}>
                See the bigger picture
              </a>
              <a href="#apps" className={button}>
                Explore the apps
              </a>
            </div>
            <p className="mt-4 text-[10px] text-[#887493]">
              Product preview · In development
            </p>
            <div className="mx-auto mt-9 max-w-[1080px] md:mt-12">
              <WindowFrame title="NetSentry · Web workspace">
                <div className="aspect-[1.55] overflow-hidden md:aspect-[1.9]">
                  <ProductImage
                    src="/product/dashboard.png"
                    alt="NetSentry dashboard overview with sidebar navigation, device cards and an empty workspace"
                    full
                    preload
                  />
                </div>
              </WindowFrame>
            </div>
            <p className={caption}>
              Web dashboard preview · Empty workspace example.
            </p>
            <div
              className="mt-6 flex flex-wrap justify-center gap-y-4 border-y border-[#e8e0ed] py-5 text-[10px] text-[#7e6d8b] md:text-xs"
              aria-label="Explore the applications"
            >
              {[
                {
                  label: "Web dashboard",
                  href: "#dashboard",
                  icon: LayoutGrid,
                },
                { label: "Android & iOS", href: "#apps", icon: Smartphone },
                { label: "Desktop app", href: "#desktop", icon: Monitor },
              ].map(({ label, href, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-2 hover:text-[#604675] [&+a]:border-l [&+a]:border-[#e8e0ed] md:gap-3 md:px-10"
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
        <section
          id="story"
          className={`${container} scroll-mt-28 py-16 text-center md:py-24`}
        >
          <Chapter>The story starts with a question</Chapter>
          <Title>
            More devices.
            <br />
            <span className={accent}>More things to make sense of.</span>
          </Title>
          <p className={`${muted} mx-auto mt-6 max-w-[680px]`}>
            A busy phone. A shared workspace. A development server you forgot
            about. Small questions add up when the answers live in different
            places.
          </p>
          <div className="mt-9 grid gap-4 text-left md:grid-cols-3">
            {[
              { icon: Clock3, text: "“Where is my screen time going?”" },
              {
                icon: Network,
                text: "“What are my devices actually reporting?”",
              },
              {
                icon: Code2,
                text: "“Is that development service still running?”",
              },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-4 rounded-xl border border-[#e8e0ed] bg-white px-6 py-5"
              >
                <span className="rounded-xl bg-[#f0e9f5] p-3 text-[#9a7bac]">
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <p className="max-w-[190px] text-[13px] leading-relaxed text-[#766a81]">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section id="dashboard" className={section}>
          <div className={container}>
            <div className="mb-9 grid gap-6 md:grid-cols-[1fr_340px] md:items-end md:gap-12">
              <div>
                <Chapter>01 / Step back. See the bigger picture.</Chapter>
                <Title>
                  A workspace that brings
                  <br />
                  <span className={accent}>the details together.</span>
                </Title>
              </div>
              <p className={muted}>
                Start on the web. Find your reported devices, explore available
                usage and follow the alerts that matter to your workspace.
              </p>
            </div>
            <ProductShowcase kind="dashboard" />
            <div className="mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
              {[
                [
                  "Know which device reported it",
                  "Device identity, capabilities and health stay visible.",
                ],
                [
                  "Understand the quality of the data",
                  "Missing, measured and estimated values remain distinct.",
                ],
                [
                  "Keep the right people in scope",
                  "Workspace roles and sharing choices govern access.",
                ],
              ].map(([title, text]) => (
                <div
                  key={title}
                  className="text-xs leading-relaxed text-[#766a81]"
                >
                  <strong className="mb-2 flex items-start gap-2 text-[13px] font-semibold text-[#645170]">
                    <Check
                      className="mt-0.5 shrink-0 text-[#9a7bac]"
                      size={15}
                      aria-hidden="true"
                    />
                    {title}
                  </strong>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          id="apps"
          className={`${container} grid scroll-mt-28 items-center gap-10 py-16 md:py-24 lg:grid-cols-[.85fr_1.15fr] lg:gap-14`}
        >
          <div>
            <Chapter>02 / Keep your everyday devices in the story.</Chapter>
            <Title>
              Your phone has a part
              <br />
              <span className={accent}>in the bigger picture.</span>
            </Title>
            <p className={`${muted} mt-6`}>
              Use the mobile companions to pair a device, review the reports you
              can access and manage your sharing choices wherever you are.
            </p>
            <div className="my-6 border-l-2 border-[#dcc9e7] pl-4">
              <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
                Android · Understand supported phone activity
              </h3>
              <p className="mt-2 text-xs leading-[1.8] text-[#766a81]">
                Permission-based network and application usage, screen-time
                reports and explicit collection controls.
              </p>
            </div>
            <div className="my-6 border-l-2 border-[#dcc9e7] pl-4">
              <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
                iOS · Stay connected to your workspace
              </h3>
              <p className="mt-2 text-xs leading-[1.8] text-[#766a81]">
                Device pairing, authorized reports and sharing workflows. Apple
                Screen Time features require separate eligibility and
                authorization.
              </p>
            </div>
            <a
              href="#availability"
              className="inline-block border-b border-[#d3bedf] pb-1 text-xs text-[#806193]"
            >
              Understand platform availability
            </a>
            <p className="mt-5 text-[10px] text-[#887493]">
              Native apps · Release validation in progress
            </p>
          </div>
          <div>
            <ProductShowcase kind="mobile" />
          </div>
        </section>
        <section id="desktop" className={section}>
          <div className={container}>
            <div className="mb-10 grid gap-6 md:grid-cols-2 md:gap-14">
              <div>
                <Chapter>03 / Follow through on your computer.</Chapter>
                <Title>
                  Less “what’s running?”
                  <br />
                  <span className={accent}>More “now I know.”</span>
                </Title>
                <p className="mt-6 text-[10px] text-[#887493]">
                  macOS is the initial desktop target · Signed release checks
                  pending
                </p>
              </div>
              <div className={`${muted} space-y-5`}>
                <p>
                  The desktop app connects the local agent and puts developer
                  services into focus. Review projects, runtimes, processes and
                  listening ports on supported computers.
                </p>
                <p>
                  Need to stop a service? Review the exact target first.
                  Graceful and force stops require separate confirmation; remote
                  requests require additional consent and grants.
                </p>
              </div>
            </div>
            <ProductShowcase kind="desktop" />
          </div>
        </section>
        <section
          id="features"
          className={`${container} scroll-mt-28 py-16 text-center md:py-24`}
        >
          <Chapter>One product. Different everyday stories.</Chapter>
          <Title>
            Built around <span className={accent}>your part of the story.</span>
          </Title>
          <p className={`${muted} mx-auto mt-6 max-w-[550px]`}>
            Personal insight, shared responsibility or a clearer development
            workspace. Start with the tools relevant to you.
          </p>
          <div className="mt-9 grid grid-cols-2 gap-3 text-left md:grid-cols-4 md:gap-4">
            {[
              {
                title: "For yourself",
                icon: UserRound,
                text: "Understand supported device activity and build a clearer picture of your digital habits.",
              },
              {
                title: "For your family",
                icon: UsersRound,
                text: "Review shared wellbeing reports, time requests and policy status with explicit consent.",
              },
              {
                title: "For your team",
                icon: Building2,
                text: "Organize consent-based device reporting within scoped business workspaces.",
              },
              {
                title: "For your projects",
                icon: Code2,
                text: "Inspect local development services and review authorized stop actions and outcomes.",
              },
            ].map(({ title, icon: Icon, text }) => (
              <article
                key={title}
                className="rounded-xl border border-[#e8e0ed] bg-white p-5 md:p-6"
              >
                <span className="mb-5 inline-flex rounded-xl bg-[#f0e9f5] p-3 text-[#9a7bac]">
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <h3 className="font-[inherit] text-base font-semibold tracking-tight md:text-lg">
                  {title}
                </h3>
                <p className="mt-4 text-xs leading-[1.8] text-[#766a81]">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section id="privacy" className={`${container} scroll-mt-28`}>
          <div className="grid gap-8 rounded-2xl border border-[#e8dfee] bg-[#f4eff8] p-6 md:grid-cols-2 md:items-center md:gap-16 md:p-12">
            <div>
              <Chapter>Understanding should come with choice.</Chapter>
              <Title>
                A clearer view.
                <br />
                <span className={accent}>You keep the say.</span>
              </Title>
              <p className={`${muted} mt-6`}>
                Signing in isn’t permission to monitor. Pairing isn’t permission
                to control. NetSentry keeps those choices explicit at every
                step.
              </p>
            </div>
            <div className="space-y-3">
              {[
                {
                  title: "Choose what can be collected",
                  icon: LockKeyhole,
                  text: "Supported permissions and fresh consent come first.",
                },
                {
                  title: "Review who can see or act",
                  icon: Eye,
                  text: "Sharing and controller grants are separate choices.",
                },
                {
                  title: "Pause, revoke or leave",
                  icon: PauseCircle,
                  text: "Device and account privacy controls stay within reach.",
                },
              ].map(({ title, icon: Icon, text }) => (
                <div
                  key={title}
                  className="flex items-center gap-5 rounded-xl border border-[#e6dcec] bg-white/70 p-5"
                >
                  <Icon
                    size={21}
                    strokeWidth={1.5}
                    className="shrink-0 text-[#9a7bac]"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-[inherit] text-xs font-semibold text-[#715c80]">
                      {title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-[#766a81]">
                      {text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          id="how-it-works"
          className={`${container} scroll-mt-28 py-16 text-center md:py-24`}
        >
          <Chapter>When you’re ready, begin with one device.</Chapter>
          <Title>
            A simple path to{" "}
            <span className={accent}>your first clear picture.</span>
          </Title>
          <div className="mt-10 grid gap-7 text-left md:grid-cols-3 md:gap-8">
            {[
              [
                "Create your workspace",
                "Set up your account and choose the workspace where your devices and authorized people belong.",
              ],
              [
                "Pair a supported installation",
                "Use the appropriate app or agent. Review the capabilities, permissions and disclosures before enabling collection.",
              ],
              [
                "Review. Understand. Decide.",
                "Explore available reports, check missing data and decide whether to share, change a setting or take a confirmed action.",
              ],
            ].map(([title, text], i) => (
              <article key={title} className="border-t border-[#e8e0ed] pt-6">
                <p className="mb-5 text-3xl font-medium text-[#b095c1]">
                  0{i + 1}
                </p>
                <h3 className="font-[inherit] text-base font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-3 text-xs leading-[1.8] text-[#766a81]">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section
          id="availability"
          className="scroll-mt-28 border-t border-[#eee6f2] bg-[#f9f7fb] py-14 md:py-20"
        >
          <div
            className={`${container} grid gap-9 md:grid-cols-[.8fr_1.2fr] md:gap-20`}
          >
            <div>
              <Chapter>A few things worth knowing.</Chapter>
              <Title>
                Clear expectations.
                <br />
                <span className={accent}>From the start.</span>
              </Title>
              <p className={`${muted} mt-6 max-w-[320px]`}>
                Devices and operating systems differ. We’d rather show you a
                limitation than disguise it as a measurement.
              </p>
            </div>
            <div id="faq" className="scroll-mt-28">
              {faqs.map(([question, answer], i) => (
                <details
                  key={question}
                  open={i === 0}
                  className="group mb-4 border-b border-[#e4d9eb] pb-4"
                >
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-[13px] font-medium text-[#705781] [&::-webkit-details-marker]:hidden">
                    {question}
                    <span
                      aria-hidden="true"
                      className="text-xl font-normal text-[#af91c2] group-open:hidden"
                    >
                      +
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden text-xl font-normal text-[#af91c2] group-open:inline"
                    >
                      −
                    </span>
                  </summary>
                  <p className="mt-3 text-xs leading-[1.9] text-[#766a81]">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="py-16 text-center md:py-24">
          <div className={container}>
            <Chapter>Your devices. Your workspace. Your choices.</Chapter>
            <Title>
              Bring your digital world
              <br />
              <span className={accent}>a little more into focus.</span>
            </Title>
            <p className={`${muted} mx-auto my-6 max-w-[500px]`}>
              Start with the bigger picture. Get to know the apps. Take the next
              step when your devices and permissions are ready.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/app" className={primaryButton}>
                Open your workspace
              </Link>
              <a href="#apps" className={button}>
                See the applications
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e9e0ed] bg-white py-9">
        <div className={container}>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:gap-12">
            <div className="max-w-[300px]">
              <Link href="/" aria-label="NetSentry home">
                <Brand />
              </Link>
              <p className="mt-4 text-[11px] leading-[1.9] text-[#887493]">
                A clearer picture of your devices, digital habits and
                development workspace. Built around supported data and explicit
                choices.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-5 text-[11px] text-[#887493] md:gap-14">
              {[
                {
                  title: "Discover",
                  links: [
                    ["The product", "/product"],
                    ["Who it’s for", "/solutions"],
                    ["How it works", "#how-it-works"],
                  ],
                },
                {
                  title: "Applications",
                  links: [
                    ["Web dashboard", "/applications#applications-web"],
                    ["Android & iOS", "/applications#applications-phones"],
                    ["Desktop app", "/applications#applications-desktop"],
                  ],
                },
                {
                  title: "Learn",
                  links: [
                    ["Common questions", "#faq"],
                    ["Documentation", "/docs"],
                    ["Platform availability", "#availability"],
                    ["Privacy & choice", "#privacy"],
                  ],
                },
              ].map(({ title, links }) => (
                <div key={title} className="flex flex-col items-start gap-3">
                  <strong className="mb-1 text-[10px] uppercase tracking-wider text-[#695276]">
                    {title}
                  </strong>
                  {links.map(([label, href]) => (
                    <a key={href} href={href} className="hover:text-[#604675]">
                      {label}
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-[#eee6f2] pt-5 text-[10px] text-[#887493]">
            <p>
              © <CopyrightYear /> NetSentry
            </p>
            <p>Product in development · Availability varies by platform</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
