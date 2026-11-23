"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  Blocks,
  Building2,
  ChevronRight,
  CreditCard,
  Ellipsis,
  Gauge,
  HeartHandshake,
  Home,
  Laptop,
  LogOut,
  Network,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import type { User, Workspace } from "@/shared/types";
import { ActionButton } from "@/shared/ui/common";
import { workspaceHref, workspaceSections, type WorkspaceSlug } from "./routes";

const icons = {
  "": Home,
  devices: Smartphone,
  "usage-reports": Gauge,
  alerts: Bell,
  networks: Network,
  "developer-tools": Laptop,
  family: HeartHandshake,
  business: Building2,
  subscription: CreditCard,
  operations: ShieldCheck,
  team: Users,
  settings: Settings,
  "more-modules": Blocks,
} satisfies Record<WorkspaceSlug, typeof Home>;

const dockLinks = ["", "devices", "networks", "alerts"] as const;
const groups = [
  { label: "Monitor", links: ["", "devices", "networks", "alerts", "usage-reports"] },
  { label: "Workspace", links: ["team", "family", "business", "developer-tools"] },
  { label: "Manage", links: ["settings", "subscription", "operations", "more-modules"] },
] as const;

const linkStyle =
  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-text-secondary hover:bg-surface-lavender hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary aria-[current=page]:bg-surface-lavender aria-[current=page]:text-primary-hover";

export function DashboardNavigation({
  active,
  workspaceType,
  user,
  onSignOut,
}: {
  active?: WorkspaceSlug;
  workspaceType?: Workspace["type"];
  user: User;
  onSignOut: () => Promise<void>;
}) {
  const titleId = useId();
  const dialogId = useId();
  const sheet = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 700px)");
    const closeOnResize = () => {
      if (media.matches) sheet.current?.close();
    };
    media.addEventListener("change", closeOnResize);
    return () => media.removeEventListener("change", closeOnResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const visible = (slug: WorkspaceSlug) =>
    slug === active ||
    ((slug !== "family" || workspaceType === "FAMILY") &&
      (slug !== "business" || workspaceType === "BUSINESS"));

  const account = (rail: boolean) => (
    <div className={rail ? "mt-auto grid gap-2 pt-4" : "mt-3 grid gap-2 border-t border-border pt-3"}>
      <div className="flex min-w-0 items-center gap-2 px-2 min-[700px]:max-[1100px]:justify-center">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-lavender text-xs font-bold text-primary-hover">
          {user.displayName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 min-[700px]:max-[1100px]:sr-only">
          <strong className="block truncate text-sm">{user.displayName}</strong>
          <small className="block truncate">{user.email}</small>
        </div>
      </div>
      <ActionButton action={onSignOut}>
        <LogOut aria-hidden="true" size={18} className="shrink-0" />
        <span className="min-[700px]:max-[1100px]:sr-only">Sign out</span>
      </ActionButton>
    </div>
  );

  return (
    <>
      <aside aria-label="Workspace navigation" className="sticky top-0 hidden h-dvh min-h-0 flex-col overflow-y-auto border-e border-border bg-surface p-2 min-[700px]:flex min-[1100px]:p-4">
        <nav aria-label="Primary navigation" className="grid gap-4">
          {groups.map(({ label, links }) => (
            <div key={label} className="grid gap-1">
              <span className="px-3 text-xs font-semibold text-text-secondary min-[700px]:max-[1100px]:sr-only">{label}</span>
              {links.filter(visible).map((slug) => {
                const Icon = icons[slug];
                return (
                  <Link key={slug} href={workspaceHref(slug)} aria-current={active === slug ? "page" : undefined} title={workspaceSections[slug]} className={`${linkStyle} min-[700px]:max-[1100px]:justify-center`}>
                    <Icon size={19} className="shrink-0" aria-hidden="true" />
                    <span className="min-[700px]:max-[1100px]:sr-only">{workspaceSections[slug]}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {account(true)}
      </aside>
      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-stretch gap-0.5 border-t border-border bg-surface px-1 pt-1 pb-[max(.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_18px_#21182b0c] min-[700px]:hidden">
        {dockLinks.map((slug) => {
          const Icon = icons[slug];
          return (
            <Link
              key={slug}
              href={workspaceHref(slug)}
              aria-current={active === slug ? "page" : undefined}
              className="grid min-h-12 content-center justify-items-center gap-0.5 rounded-lg text-[.65rem] font-semibold text-text-secondary hover:bg-surface-lavender focus-visible:outline-2 focus-visible:outline-primary aria-[current=page]:bg-surface-lavender aria-[current=page]:text-primary-hover"
            >
              <Icon size={19} aria-hidden="true" />
              {workspaceSections[slug]}
            </Link>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-controls={dialogId}
          aria-expanded={open}
          data-active={active !== undefined && !dockLinks.some((slug) => slug === active)}
          className="grid min-h-12 content-center justify-items-center gap-0.5 rounded-lg text-[.65rem] font-semibold text-text-secondary hover:bg-surface-lavender focus-visible:outline-2 focus-visible:outline-primary data-[active=true]:bg-surface-lavender data-[active=true]:text-primary-hover"
          onClick={() => {
            sheet.current?.showModal();
            setOpen(true);
          }}
        >
          <Ellipsis size={20} aria-hidden="true" />
          More
        </button>
      </nav>
      <dialog
        id={dialogId}
        ref={sheet}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) sheet.current?.close();
        }}
        className="fixed inset-x-0 top-auto bottom-0 mx-auto max-h-[85dvh] w-full max-w-lg overflow-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-black/45 min-[700px]:hidden"
      >
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <header className="mb-2 flex items-center justify-between gap-2">
            <h2 id={titleId}>More navigation</h2>
            <button type="button" autoFocus className="icon-button" aria-label="Close navigation" onClick={() => sheet.current?.close()}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <nav aria-label="More destinations" className="grid gap-3">
            {groups.map(({ label, links }) => (
              <div key={label} className="grid gap-1">
                <span className="px-3 text-xs font-semibold text-text-secondary">{label}</span>
                {links.filter((slug) => visible(slug) && !dockLinks.some((dock) => dock === slug)).map((slug) => {
                  const Icon = icons[slug];
                  return (
                    <Link key={slug} href={workspaceHref(slug)} aria-current={active === slug ? "page" : undefined} onNavigate={() => sheet.current?.close()} className={linkStyle}>
                      <Icon size={19} aria-hidden="true" />
                      {workspaceSections[slug]}
                      <ChevronRight size={15} aria-hidden="true" className="ms-auto" />
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          {account(false)}
        </div>
      </dialog>
    </>
  );
}
