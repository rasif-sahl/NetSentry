"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, X } from "lucide-react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { PageContext } from "@/features/workspace/types";
import { networkDetailHref } from "@/features/workspace/routes";
import {
  ActionForm,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  text,
} from "@/shared/ui/common";
import type { NetworkSite } from "./types";

export function NetworkMonitoring({ workspace, permissions }: PageContext) {
  const path = `/workspaces/${workspace.id}/networks`;
  const sites = useResource<NetworkSite[]>(path, true);
  const manage = permissions.includes("networks:manage");
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const dialogTitle = useId();
  const [created, setCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  return (
    <Card
      title="Monitored networks"
      headingAction={
        manage && (
          <button
            type="button"
            className="button accent"
            onClick={() => {
              dialog.current?.showModal();
              nameInput.current?.focus();
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Add network
          </button>
        )
      }
    >
      {created && (
        <div className="mb-3">
          <Notice tone="success">
            Network added. Open it to assign a collector.
          </Notice>
        </div>
      )}
      <ErrorNotice error={sites.error} />
      {sites.loading && <Loading />}
      {sites.data &&
        (sites.data.length ? (
          <table aria-label="Monitored networks">
            <thead>
              <tr>
                <th scope="col">Network</th>
                <th scope="col">Private IPv4 subnets</th>
              </tr>
            </thead>
            <tbody>
              {sites.data.map((site) => (
                <tr
                  key={site.networkId}
                  className="relative hover:bg-surface-lavender focus-within:bg-surface-lavender"
                >
                  <th scope="row">
                    <Link
                      href={networkDetailHref(site.networkId)}
                      className="inline-flex min-h-8 items-center gap-2 font-semibold text-text underline-offset-4 [overflow-wrap:anywhere] hover:underline after:absolute after:inset-0 after:content-['']"
                    >
                      {site.name}
                      <ArrowRight
                        className="shrink-0 text-primary-hover"
                        size={15}
                        aria-hidden="true"
                      />
                    </Link>
                  </th>
                  <td className="[overflow-wrap:anywhere]">
                    {site.cidrs.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No monitored networks">
            {manage
              ? "Add a network to set up collection."
              : "A workspace owner or admin can add a network."}
          </Empty>
        ))}
      {manage && (
        <dialog
          ref={dialog}
          aria-labelledby={dialogTitle}
          onCancel={(event) => {
            if (saving) event.preventDefault();
          }}
          onClose={() => setFormVersion((version) => version + 1)}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-border bg-surface p-4 text-text shadow-xl backdrop:bg-black/45 sm:p-6"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={dialogTitle} className="text-lg font-semibold">
              Add network
            </h2>
            <button
              type="button"
              aria-label="Cancel"
              className="icon-button shrink-0"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <ActionForm
            key={formVersion}
            submit="Add network"
            action={async (form) => {
              setCreated(false);
              setSaving(true);
              try {
                await api(path, "POST", {
                  name: text(form, "name"),
                  cidrs: text(form, "cidrs")
                    .split(/[\s,]+/)
                    .filter(Boolean),
                });
                sites.reload();
                setCreated(true);
                dialog.current?.close();
              } finally {
                setSaving(false);
              }
            }}
          >
            <Field label="Network name">
              <input ref={nameInput} name="name" required maxLength={100} />
            </Field>
            <Field
              label="Private IPv4 subnets"
              hint="Up to eight private prefixes, /8 to /30, separated by commas. For example, 192.168.1.0/24."
            >
              <input name="cidrs" required />
            </Field>
          </ActionForm>
        </dialog>
      )}
    </Card>
  );
}
