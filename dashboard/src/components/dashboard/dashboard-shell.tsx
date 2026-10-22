"use client";

import {
  Activity, Bell, ChevronDown, CircleHelp, Gauge, Home, Laptop, Menu,
  Network, Radar, Router, Search, Settings, Shield, ShieldCheck,
  Smartphone, Sparkles, Tablet, Wifi, X, type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

type NavigationItem = { label: string; icon: LucideIcon; badge?: string };

const navigation: NavigationItem[] = [
  { label: "Overview", icon: Home },
  { label: "Devices", icon: Smartphone, badge: "12" },
  { label: "Networks", icon: Network },
  { label: "Usage", icon: Gauge },
  { label: "Security", icon: Shield, badge: "2" },
  { label: "Insights", icon: Sparkles },
];

const devices = [
  { name: "Rasif’s Pixel", detail: "Android 16 · This device", usage: "3.8 GB", status: "Protected", icon: Smartphone },
  { name: "Living room TV", detail: "Samsung TV · Online", usage: "2.4 GB", status: "Protected", icon: Tablet },
  { name: "MacBook Pro", detail: "macOS · Online", usage: "1.9 GB", status: "Review", icon: Laptop },
  { name: "Unknown device", detail: "10.0.0.24 · First seen today", usage: "640 MB", status: "Unknown", icon: CircleHelp },
];

const activity = [
  { day: "M", value: 42 }, { day: "T", value: 58 }, { day: "W", value: 46 },
  { day: "T", value: 74 }, { day: "F", value: 62 }, { day: "S", value: 88 },
  { day: "S", value: 68 },
];

export function DashboardShell() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [activeItem, setActiveItem] = useState("Overview");
  const [range, setRange] = useState("7 days");
  const [scanning, setScanning] = useState(false);

  function selectNavigation(label: string) {
    setActiveItem(label);
    setMobileNavigationOpen(false);
  }

  function startScan() {
    setScanning(true);
    window.setTimeout(() => setScanning(false), 1800);
  }

  return (
    <div className="min-h-dvh bg-background text-text">
      <a href="#dashboard-content" className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-text px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0">Skip to dashboard</a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-surface px-4 py-5 lg:flex lg:flex-col">
        <Brand />
        <Navigation activeItem={activeItem} onSelect={selectNavigation} className="mt-9" />
        <div className="mt-auto space-y-1 border-t border-border pt-4">
          <SidebarButton icon={CircleHelp} label="Help & support" />
          <SidebarButton icon={Settings} label="Settings" />
          <button className="mt-3 flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-surface-lavender">
            <span className="grid size-9 place-items-center rounded-full bg-primary font-heading text-sm font-bold text-white">RS</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Rasif Sahl</span><span className="block truncate text-xs text-text-secondary">Personal plan</span></span>
            <ChevronDown className="size-4 text-muted" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-text/30 backdrop-blur-[2px]" onClick={() => setMobileNavigationOpen(false)} />
          <aside className="relative flex h-full w-[min(84vw,320px)] flex-col bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between"><Brand /><button aria-label="Close navigation" className="grid size-10 place-items-center rounded-xl bg-surface-lavender text-primary" onClick={() => setMobileNavigationOpen(false)}><X className="size-5" /></button></div>
            <Navigation activeItem={activeItem} onSelect={selectNavigation} className="mt-8" />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button aria-label="Open navigation" className="grid size-10 place-items-center rounded-xl bg-surface-lavender text-primary lg:hidden" onClick={() => setMobileNavigationOpen(true)}><Menu className="size-5" /></button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 md:flex md:max-w-sm">
            <Search className="size-[18px] shrink-0 text-muted" /><input aria-label="Search devices and networks" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" placeholder="Search devices or networks" /><kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-text-secondary">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full bg-success-surface px-3 py-1.5 text-xs font-semibold text-success sm:flex"><span className="size-2 rounded-full bg-success" /> Monitoring active</div>
            <button aria-label="Notifications, two unread" className="relative grid size-10 place-items-center rounded-xl border border-border bg-surface transition hover:bg-surface-lavender"><Bell className="size-[19px]" /><span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-white" /></button>
          </div>
        </header>

        <main id="dashboard-content" className="mx-auto max-w-[1500px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-medium text-primary">Thursday, 22 October</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] sm:text-[28px]">Network overview</h1><p className="mt-1 text-sm text-text-secondary">Your personal network is protected and running normally.</p></div>
            <button onClick={startScan} disabled={scanning} className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(128,101,143,.2)] transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"><Radar className={`size-[18px] ${scanning ? "animate-spin" : ""}`} />{scanning ? "Scanning network…" : "Scan devices"}</button>
          </div>

          <section aria-label="Network summary" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Security score" value="98" suffix="/100" note="Excellent protection" icon={ShieldCheck} tone="success" />
            <MetricCard title="Connected devices" value="12" note="10 known · 2 to review" icon={Smartphone} tone="primary" />
            <MetricCard title="Data used today" value="9.2" suffix=" GB" note="18% below your average" icon={Activity} tone="rose" />
            <MetricCard title="Network health" value="Healthy" note="Last checked 2 min ago" icon={Wifi} tone="success" compact />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-sm font-semibold">Data activity</p><p className="mt-1 text-xs text-text-secondary">Upload and download across all devices</p></div>
                <div className="flex rounded-lg bg-surface-lavender p-1">{["24 hours", "7 days", "30 days"].map((option) => <button key={option} onClick={() => setRange(option)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${range === option ? "bg-surface text-primary shadow-sm" : "text-text-secondary hover:text-primary"}`}>{option}</button>)}</div>
              </div>
              <div className="mt-7 flex h-52 items-end gap-2 sm:gap-4" aria-label="Weekly data usage chart">
                {activity.map((item, index) => <div key={`${item.day}-${index}`} className="flex h-full flex-1 flex-col justify-end gap-2"><div className="relative flex flex-1 items-end rounded-lg bg-background px-1.5 sm:px-2"><div className="w-full rounded-md bg-gradient-to-t from-primary to-secondary transition-[height] duration-500" style={{ height: `${item.value}%` }} title={`${item.value}% relative activity`} /></div><span className="text-center text-[11px] font-medium text-muted">{item.day}</span></div>)}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-text-secondary"><span><b className="text-text">42.8 GB</b> downloaded</span><span><b className="text-text">8.4 GB</b> uploaded</span><span className="text-success">↓ 12% from last week</span></div>
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">Security status</p><p className="mt-1 text-xs text-text-secondary">2 items need your attention</p></div><span className="rounded-full bg-danger-surface px-2.5 py-1 text-[11px] font-bold text-danger">Review</span></div>
              <div className="mt-5 space-y-3"><SecurityItem icon={CircleHelp} title="Unknown device joined" detail="First seen at 10:42 AM" tone="danger" /><SecurityItem icon={Router} title="Router update available" detail="Firmware 1.2.8 is ready" tone="warning" /><SecurityItem icon={ShieldCheck} title="Last scan completed" detail="No threats found" tone="success" /></div>
              <button className="mt-5 w-full rounded-[10px] bg-surface-lavender px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">View security center</button>
            </Card>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
            <Card className="overflow-hidden !p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">Active devices</h2><p className="mt-1 text-xs text-text-secondary">Devices using your network now</p></div><button className="text-xs font-semibold text-primary hover:text-primary-hover">View all</button></div>
              <div className="divide-y divide-border">{devices.map((device) => <DeviceRow key={device.name} {...device} />)}</div>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-primary to-[#664f73] text-white">
              <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/10" /><div className="absolute -bottom-20 -left-10 size-44 rounded-full bg-accent/20" />
              <div className="relative"><span className="grid size-10 place-items-center rounded-xl bg-white/15"><Sparkles className="size-5" /></span><h2 className="mt-5 text-lg font-semibold">A calmer digital week</h2><p className="mt-2 text-sm leading-6 text-white/75">Evening usage is down 14%. Your most active window is now between 7 PM and 9 PM.</p><button className="mt-6 rounded-[10px] bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-surface-lavender">Explore insights</button></div>
            </Card>
          </section>
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-2xl border border-border bg-surface/95 p-1.5 shadow-[0_10px_35px_rgba(54,38,67,.14)] backdrop-blur lg:hidden">
        {navigation.slice(0, 5).map(({ label, icon: Icon }) => { const active = activeItem === label; return <button key={label} onClick={() => selectNavigation(label)} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition ${active ? "bg-surface-lavender text-primary" : "text-text-secondary"}`}><Icon className="size-[19px]" strokeWidth={1.8} /><span className="truncate">{label}</span></button>; })}
      </nav>
    </div>
  );
}

function Brand() {
  return <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[13px] bg-primary text-white shadow-[0_8px_18px_rgba(128,101,143,.24)]"><ShieldCheck className="size-[22px]" strokeWidth={2} /></span><div><p className="font-heading text-base font-bold tracking-[-0.03em]">NetSentry</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Personal</p></div></div>;
}

function Navigation({ activeItem, onSelect, className = "" }: { activeItem: string; onSelect: (label: string) => void; className?: string }) {
  return <nav aria-label="Primary navigation" className={`space-y-1 ${className}`}>{navigation.map(({ label, icon: Icon, badge }) => { const active = label === activeItem; return <button key={label} onClick={() => onSelect(label)} aria-current={active ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-surface-lavender text-primary" : "text-text-secondary hover:bg-background hover:text-text"}`}><Icon className="size-[19px]" strokeWidth={1.8} /><span>{label}</span>{badge ? <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${label === "Security" ? "bg-danger-surface text-danger" : "bg-background text-text-secondary"}`}>{badge}</span> : null}</button>; })}</nav>;
}

function SidebarButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-background hover:text-text"><Icon className="size-[18px]" />{label}</button>;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5 ${className}`}>{children}</div>;
}

function MetricCard({ title, value, suffix, note, icon: Icon, tone, compact = false }: { title: string; value: string; suffix?: string; note: string; icon: LucideIcon; tone: "success" | "primary" | "rose"; compact?: boolean }) {
  const tones = { success: "bg-success-surface text-success", primary: "bg-surface-lavender text-primary", rose: "bg-surface-rose text-secondary" };
  return <Card><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-text-secondary">{title}</p><p className={`mt-3 font-heading font-bold tracking-[-0.04em] ${compact ? "text-2xl" : "text-[28px]"}`}>{value}<span className="text-sm font-semibold text-text-secondary">{suffix}</span></p></div><span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-5" strokeWidth={1.9} /></span></div><p className="mt-2 text-xs text-text-secondary">{note}</p></Card>;
}

function SecurityItem({ icon: Icon, title, detail, tone }: { icon: LucideIcon; title: string; detail: string; tone: "danger" | "warning" | "success" }) {
  const tones = { danger: "bg-danger-surface text-danger", warning: "bg-warning-surface text-warning", success: "bg-success-surface text-success" };
  return <div className="flex items-center gap-3 rounded-xl border border-border p-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon className="size-[18px]" /></span><span className="min-w-0"><span className="block truncate text-xs font-semibold">{title}</span><span className="mt-0.5 block truncate text-[11px] text-text-secondary">{detail}</span></span></div>;
}

function DeviceRow({ name, detail, usage, status, icon: Icon }: (typeof devices)[number]) {
  const needsReview = status !== "Protected";
  return <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_100px_110px] sm:px-5"><span className="grid size-10 place-items-center rounded-xl bg-surface-lavender text-primary"><Icon className="size-5" strokeWidth={1.8} /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{name}</span><span className="mt-0.5 block truncate text-xs text-text-secondary">{detail}</span></span><span className="hidden text-right text-xs font-semibold sm:block">{usage}</span><span className={`justify-self-end rounded-full px-2.5 py-1 text-[10px] font-bold ${needsReview ? "bg-danger-surface text-danger" : "bg-success-surface text-success"}`}>{status}</span></div>;
}
