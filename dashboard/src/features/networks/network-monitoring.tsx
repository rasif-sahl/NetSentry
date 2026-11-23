"use client";
import { usePage } from "@/shared/use-page";
import { PageControls } from "@/shared/ui/page-controls";
import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { ChevronRight, Network, Plus } from "lucide-react";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { api } from "@/shared/api";
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
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const sites = usePage<NetworkSite>(
    `${path}/page?search=${encodeURIComponent(query)}`,
    true,
  );
  const manage = permissions.includes("networks:manage");
  const [created, setCreated] = useState(false);

  return (
    <Card
      title="Monitored networks"
      headingAction={
        manage && (
          <ActionFormDialog
            submit="Add network"
            primary
            icon={<Plus size={16} aria-hidden="true" />}
            action={async (form) => {
              setCreated(false);
              await api(path, "POST", {
                name: text(form, "name"),
                cidrs: text(form, "cidrs")
                  .split(/[\s,]+/)
                  .filter(Boolean),
              });
              setSearch("");
              sites.reset();
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
      <div className="mb-4">
        <Field label="Find a monitored network">
          <input
            type="search"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by network name"
          />
        </Field>
      </div>
      <ErrorNotice error={sites.error} />
      {sites.loading && <Loading />}
      {sites.data &&
        (sites.data.length ? (
          <table aria-label="Monitored networks">
            <thead>
              <tr>
                <th scope="col">Network</th>
                <th scope="col" className="hidden sm:table-cell">Private IPv4 subnets</th>
              </tr>
            </thead>
            <tbody>
              {sites.data.map((site) => (
                <tr
                  key={site.networkId}
                  className="relative hover:bg-surface-lavender focus-within:bg-surface-lavender"
                >
                  <th scope="row" className="w-full sm:w-1/2">
                    <div className="flex min-w-0 items-center gap-3 pe-6">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-lavender text-primary-hover">
                        <Network size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={networkDetailHref(site.networkId)}
                          className="inline-flex min-h-7 items-center font-semibold underline-offset-4 [overflow-wrap:anywhere] hover:underline after:absolute after:inset-0 after:content-['']"
                        >
                          {site.name}
                          <ChevronRight
                            className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-primary-hover"
                            size={17}
                            aria-hidden="true"
                          />
                        </Link>
                        <span className="mb-1 block text-xs font-normal text-text-secondary [overflow-wrap:anywhere] sm:hidden">
                          {site.cidrs.join(", ")}
                        </span>
                      </div>
                    </div>
                  </th>
                  <td className="hidden pe-8! [overflow-wrap:anywhere] sm:table-cell">
                    {site.cidrs.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty
            title={query ? "No matching networks" : "No monitored networks"}
          >
            {manage
              ? "Add a network to set up collection."
              : "A workspace owner or admin can add a network."}
          </Empty>
        ))}
      <PageControls label="Monitored networks" page={sites} />
    </Card>
  );
}
