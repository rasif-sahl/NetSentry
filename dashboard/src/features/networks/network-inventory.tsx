"use client";
import { api } from "@/shared/api";
import {
  ActionButton,
  ActionForm,
  Card,
  Empty,
  Field,
  formatTime,
  text,
} from "@/shared/ui/common";
import { useState } from "react";
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
  view,
  path,
  canManage,
  devices,
  reload,
}: {
  view: Pick<NetworkView, "endpoints" | "presenceHistory">;
  path: string;
  canManage: boolean;
  devices: Device[];
  reload: () => void;
}) {
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false);
  return (
    <Card title="Observed devices">
      <Field label="Search inventory">
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
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
      {!view.endpoints.length && (
        <div className="mt-4">
          <Empty title="No passive neighbor observations yet" />
        </div>
      )}
      {view.endpoints
        .filter(
          (e) =>
            (archived || !e.archived) &&
            `${e.name} ${e.mac ?? ""} ${e.observations.map((o) => o.address).join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .map((e) => (
          <details key={e.id} className="mt-3">
            <summary>
              {e.name || e.mac || "Address-only observation"} ·{" "}
              {e.presence.replaceAll("_", " ")} · {e.trust}
              {e.archived ? " · archived" : ""}
            </summary>
            <p>
              MAC {e.mac ?? "unknown"} · last captured{" "}
              {formatTime(e.lastSeenAt)}
            </p>
            <p>
              Recent observed spans (latest 100 across this network). These are
              cached sightings, not confirmed connection sessions; gaps remain
              unknown.
            </p>
            <ul>
              {view.presenceHistory
                .filter((h) => h.endpointId === e.id)
                .map((h) => (
                  <li key={h.id}>
                    {h.address} · {h.evidence} · {formatTime(h.firstObservedAt)}{" "}
                    to {formatTime(h.lastObservedAt)} · collector {h.agentId}
                  </li>
                ))}
            </ul>
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
                <ActionForm
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
                    reload();
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
                </ActionForm>
                <ActionButton
                  confirm="Erase this endpoint? Continued collection can rediscover it."
                  action={async () => {
                    await api(`${path}/endpoints/${e.id}`, "DELETE");
                    reload();
                  }}
                >
                  Erase endpoint
                </ActionButton>
              </>
            )}
          </details>
        ))}
    </Card>
  );
}
