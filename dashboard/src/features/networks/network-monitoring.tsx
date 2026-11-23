"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { PageContext } from "@/features/workspace/types";
import { networkDetailHref } from "@/features/workspace/routes";
import {
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
  const [created, setCreated] = useState(false);

  return (
    <Card
      title="Monitored networks"
      headingAction={
        manage && (
          <ActionFormDialog
            submit="Add network"
            icon={<Plus size={16} aria-hidden="true" />}
            action={async (form) => {
              setCreated(false);
              await api(path, "POST", {
                name: text(form, "name"),
                cidrs: text(form, "cidrs")
                  .split(/[\s,]+/)
                  .filter(Boolean),
              });
              sites.reload();
              setCreated(true);
            }}
          >
            <Field label="Network name">
              <input name="name" required maxLength={100} />
            </Field>
            <Field
              label="Private IPv4 subnets"
              hint="Up to eight private prefixes, /8 to /30, separated by commas. For example, 192.168.1.0/24."
            >
              <input name="cidrs" required />
            </Field>
          </ActionFormDialog>
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
    </Card>
  );
}
