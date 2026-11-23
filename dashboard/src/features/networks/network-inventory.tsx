"use client";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { usePage } from "@/shared/use-page";
import { PageControls } from "@/shared/ui/page-controls";
import { api } from "@/shared/api";
import {
  ActionButton,
  Card,
  Empty,
  ErrorNotice,
  Loading,
  Field,
  formatTime,
  text,
} from "@/shared/ui/common";
import { useDeferredValue, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import type { Device } from "@/shared/types";
import type { NetworkView } from "./types";

const categories = [
  "unknown",
  "phone",
  "tablet",
  "computer",
  "television",
  "console",
  "smart_home",
  "printer",
  "camera",
  "network",
];
export function NetworkInventory({
  path,
  canManage,
  devices,
  reload,
}: {
  path: string;
  canManage: boolean;
  devices: Device[];
  reload: () => void;
}) {
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false);
  const query = useDeferredValue(search.trim());
  const page = usePage<NetworkView["endpoints"][number]>(
    `${path}/devices/page?search=${encodeURIComponent(query)}&archived=${archived}`,
    true,
  );
  function refreshInventory() {
    reload();
    page.reload();
  }
  return (
    <Card
      title="Observed devices"
      icon={<MonitorSmartphone size={19} />}
      className="[overflow-wrap:anywhere]"
    >
      <Field label="Search inventory">
        <input
          type="search"
          maxLength={200}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Field>
      <label className="check mt-3">
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        Include archived devices
      </label>
      <p>
        Hostname and manufacturer are unknown. MAC and IP observations do not
        establish identity, ownership or connectivity. Trust and blocked labels
        do not enforce access.
      </p>
      <ErrorNotice error={page.error} />
      {page.loading && <Loading />}
      {page.data?.length === 0 && (
        <div className="mt-4">
          <Empty
            title={
              query
                ? "No matching observed devices"
                : "No passive neighbor observations yet"
            }
          />
        </div>
      )}
      {page.data?.map((e) => (
        <details key={e.id} className="mt-3">
          <summary>
            {e.name || e.mac || "Address-only observation"} ·{" "}
            {e.presence.replaceAll("_", " ")} · {e.trust}
            {e.archived ? " · archived" : ""}
          </summary>
          <p>
            MAC {e.mac ?? "unknown"} · last captured {formatTime(e.lastSeenAt)}
          </p>
          <ObservedSpans path={`${path}/devices/${e.id}/presence/page`} />
          <ul>
            {e.observations.map((o) => (
              <li key={o.agentId}>
                {o.address} · {o.evidence} · collector {o.agentId} ·{" "}
                {formatTime(o.observedAt)}
              </li>
            ))}
          </ul>
          {canManage && (
            <>
              <ActionFormDialog
                label="Edit device labels"
                submit="Save changes"
                action={async (f) => {
                  await api(`${path}/endpoints/${e.id}`, "PATCH", {
                    name: text(f, "name"),
                    notes: text(f, "notes"),
                    category: text(f, "category"),
                    trust: text(f, "trust"),
                    archived: f.has("archived"),
                    assignedUserId: text(f, "assignedUserId") || null,
                    registeredDeviceId: text(f, "registeredDeviceId") || null,
                  });
                  refreshInventory();
                  return "Inventory labels saved. Associations do not grant monitoring access.";
                }}
              >
                <Field label="Device label">
                  <input name="name" defaultValue={e.name} maxLength={100} />
                </Field>
                <Field label="Category">
                  <select name="category" defaultValue={e.category}>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Trust label">
                  <select name="trust" defaultValue={e.trust}>
                    {["unknown", "trusted", "blocked_label"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Notes">
                  <textarea
                    name="notes"
                    defaultValue={e.notes}
                    maxLength={1000}
                  />
                </Field>
                <Field label="Optional workspace member ID">
                  <input
                    name="assignedUserId"
                    defaultValue={e.assignedUserId ?? ""}
                  />
                </Field>
                <Field label="Optional registered device ID">
                  <select
                    name="registeredDeviceId"
                    defaultValue={e.registeredDeviceId ?? ""}
                  >
                    <option value="">No association</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="check">
                  <input
                    type="checkbox"
                    name="archived"
                    defaultChecked={e.archived}
                  />
                  Archive label
                </label>
              </ActionFormDialog>
              <ActionButton
                confirm="Erase this endpoint? Continued collection can rediscover it."
                action={async () => {
                  await api(`${path}/endpoints/${e.id}`, "DELETE");
                  refreshInventory();
                }}
              >
                Erase endpoint
              </ActionButton>
            </>
          )}
        </details>
      ))}
      <PageControls label="Observed devices" page={page} />
    </Card>
  );
}

function ObservedSpans({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const page = usePage<NetworkView["presenceHistory"][number]>(
    open ? path : null,
  );
  return (
    <details
      className="mt-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Observed spans</summary>
      <p>Cached sightings reflect observations and leave gaps unknown.</p>
      <ErrorNotice error={page.error} />
      {page.loading && <Loading />}
      {page.data?.length === 0 && <p>No observed spans yet.</p>}
      <ul>
        {page.data?.map((item) => (
          <li key={item.id}>
            {item.address} · {item.evidence} ·{" "}
            {formatTime(item.firstObservedAt)} to{" "}
            {formatTime(item.lastObservedAt)} · collector {item.agentId}
          </li>
        ))}
      </ul>
      <PageControls label="Observed spans" page={page} />
    </details>
  );
}
