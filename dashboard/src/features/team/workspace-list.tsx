import { useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { api } from "@/shared/api";
import type { Workspace } from "@/shared/types";
import { ActionForm, Card, Empty, Field, Notice, text } from "@/shared/ui/common";

export function WorkspaceList({
  workspaces,
  activeId,
  switching,
  onSelect,
  onChanged,
}: {
  workspaces: Workspace[];
  activeId?: string;
  switching: boolean;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const [notice, setNotice] = useState("");

  return (
    <Card
      title="Your workspaces"
      className="mb-4 @container"
      headingAction={
        <div className="flex flex-wrap justify-end gap-2 @max-lg:col-span-2">
          <WorkspaceAction
            label="Create workspace"
            primary
            action={async (form) => {
              setNotice("");
              await api<Workspace>("/workspaces", "POST", {
                name: text(form, "name"),
                type: text(form, "type"),
                timezone: text(form, "timezone"),
              });
              onChanged();
              setNotice("Workspace created.");
            }}
          >
            <Field label="Workspace name">
              <input name="name" required maxLength={100} />
            </Field>
            <Field label="Workspace type">
              <select name="type">
                <option value="FAMILY">Family</option>
                <option value="BUSINESS">Business</option>
              </select>
            </Field>
            <Field label="Workspace timezone">
              <input
                name="timezone"
                required
                defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
              />
            </Field>
          </WorkspaceAction>
          <WorkspaceAction
            label="Accept invitation"
            action={async (form) => {
              setNotice("");
              await api("/workspaces/invitations/accept", "POST", {
                token: text(form, "token"),
              });
              onChanged();
              setNotice("Invitation accepted.");
            }}
          >
            <Field label="Invitation token">
              <input
                name="token"
                required
                pattern="[A-Za-z0-9_-]{43}"
                autoComplete="off"
              />
            </Field>
          </WorkspaceAction>
        </div>
      }
    >
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}
      {workspaces.length === 0 ? (
        <Empty title="No workspaces yet" />
      ) : (
        <ul
          aria-label="Your workspaces"
          aria-busy={switching}
          className="divide-y divide-border"
        >
          {workspaces.map((workspace) => {
            const active = workspace.id === activeId;
            return (
              <li
                key={workspace.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 break-words">
                  <strong className="text-sm">{workspace.name}</strong>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    <span className="capitalize">
                      {workspace.type.toLowerCase()}
                    </span>
                    {" · "}
                    <span className="capitalize">
                      {workspace.role.toLowerCase().replaceAll("_", " ")}
                    </span>
                    {" · "}
                    {workspace.timezone}
                  </p>
                </div>
                <button
                  type="button"
                  className={
                    active ? "badge min-h-11" : "button accent min-h-11"
                  }
                  aria-label={
                    active
                      ? `Active workspace: ${workspace.name}`
                      : `Switch to ${workspace.name}`
                  }
                  aria-current={active || undefined}
                  aria-disabled={active || switching}
                  onClick={() => {
                    if (!active && !switching) onSelect(workspace.id);
                  }}
                >
                  {active ? "Active" : "Switch"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function WorkspaceAction({
  label,
  primary = false,
  action,
  children,
}: {
  label: string;
  primary?: boolean;
  action: (form: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        className={primary ? "button primary" : "button accent"}
        onClick={() => {
          dialog.current?.showModal();
          dialog.current?.querySelector("input")?.focus();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (saving) event.preventDefault();
        }}
        onClose={() => {
          setFormVersion((version) => version + 1);
          trigger.current?.focus();
        }}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-border bg-surface p-4 text-text shadow-xl backdrop:bg-black/45 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="mb-0">
            {label}
          </h2>
          <button
            type="button"
            className="icon-button shrink-0"
            aria-label="Close dialog"
            disabled={saving}
            onClick={() => dialog.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ActionForm
          key={formVersion}
          submit={label}
          action={async (form) => {
            setSaving(true);
            try {
              await action(form);
              dialog.current?.close();
            } finally {
              setSaving(false);
            }
          }}
        >
          {children}
        </ActionForm>
      </dialog>
    </>
  );
}
