import {
  Building2,
  Check,
  ChevronDown,
  Network,
  UsersRound,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Workspace } from "@/shared/types";

function WorkspaceIdentity({ name, type }: { name: string; type?: string }) {
  const Icon =
    type === "FAMILY" ? UsersRound : type === "BUSINESS" ? Building2 : Network;
  return (
    <>
      <span className="grid size-8 place-items-center rounded-lg bg-surface-lavender text-primary-hover sm:size-9">
        <Icon aria-hidden="true" size={17} />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-semibold leading-tight">
          {name}
        </span>
        {type && (
          <span className="text-xs leading-tight text-text-secondary capitalize">
            {type.toLowerCase()}
          </span>
        )}
      </span>
    </>
  );
}

export function WorkspaceSwitcher({
  workspace,
  workspaces,
  switching,
  onSelect,
}: {
  workspace: Workspace | undefined;
  workspaces: Workspace[] | undefined;
  switching: boolean;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    (
      panel.current?.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      ) ?? panel.current?.querySelector("button")
    )?.focus();
    function dismissOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div
      className="relative min-w-0 flex-1 sm:max-w-56"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          closeAndFocus();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        aria-label={
          workspace
            ? `Active workspace: ${workspace.name}, ${workspace.type.toLowerCase()}`
            : "Active workspace"
        }
        data-workspace-id={workspace?.id}
        aria-expanded={open}
        aria-controls={panelId}
        aria-disabled={!workspace || switching}
        aria-busy={switching}
        className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 text-start text-text hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-expanded:border-primary aria-disabled:opacity-70 sm:gap-3 sm:px-3"
        onClick={() => {
          if (workspace && !switching) setOpen(!open);
        }}
      >
        <WorkspaceIdentity
          name={workspace?.name ?? "Workspace"}
          type={workspace?.type}
        />
        <ChevronDown
          aria-hidden="true"
          size={15}
          className={
            open ? "rotate-180 text-primary-hover" : "text-primary-hover"
          }
        />
      </button>
      <div
        id={panelId}
        ref={panel}
        role="group"
        aria-label="Switch workspace"
        hidden={!open}
        className="absolute start-0 top-full z-30 mt-2 max-h-[min(24rem,60dvh)] w-full overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg sm:w-72"
        onKeyDown={(event) => {
          const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
          if (!keys.includes(event.key)) return;
          const rows = [...event.currentTarget.querySelectorAll("button")];
          const current = rows.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (current < 0) return;
          event.preventDefault();
          if (event.key === "Home") rows[0]?.focus();
          else if (event.key === "End") rows.at(-1)?.focus();
          else
            rows[
              (current + (event.key === "ArrowDown" ? 1 : -1) + rows.length) %
                rows.length
            ]?.focus();
        }}
      >
        <p className="px-2 pt-1 pb-1.5 text-xs font-semibold text-text-secondary">
          Switch workspace
        </p>
        {workspaces?.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={`${item.name}, ${item.type.toLowerCase()}`}
            aria-pressed={item.id === workspace?.id}
            data-workspace-id={item.id}
            className="grid min-h-12 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1 text-start hover:bg-surface-lavender focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary aria-pressed:bg-surface-lavender sm:gap-3"
            onClick={() => {
              closeAndFocus();
              if (item.id !== workspace?.id) onSelect(item.id);
            }}
          >
            <WorkspaceIdentity name={item.name} type={item.type} />
            <Check
              aria-hidden="true"
              size={15}
              className={
                item.id === workspace?.id ? "text-primary-hover" : "invisible"
              }
            />
          </button>
        ))}
      </div>
    </div>
  );
}
