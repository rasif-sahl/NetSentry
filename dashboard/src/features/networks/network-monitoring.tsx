"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
  ActionForm,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  formatTime,
  text,
} from "@/shared/ui/common";
import { NetworkInventory } from "./network-inventory";
import { RouterPanel } from "./router-panel";
import { networkConsent, NetworkConsent } from "./network-consent";
import type { NetworkSite, NetworkView } from "./types";

export function NetworkMonitoring(context: PageContext) {
  const path = `/workspaces/${context.workspace.id}/networks`;
  const sites = useResource<NetworkSite[]>(path, true);
  const disclosure = useResource<{ text: string }>("/networks/disclosure");
  const [selected, select] = useState("");
  const id = sites.data?.some((s) => s.networkId === selected)
    ? selected
    : sites.data?.[0]?.networkId;
  const manage = context.permissions.includes("networks:manage");
  return (
    <>
      <Notice>
        Passive IPv4 discovery reads existing neighbor caches only. Cached
        devices may be absent or stale; a missing observation does not prove a
        device is offline. Router support begins with an OpenWrt ubus protocol
        candidate; hardware compatibility is unverified.
      </Notice>
      <details>
        <summary>Network-sharing disclosure</summary>
        <ErrorNotice error={disclosure.error} />
        <p>{disclosure.data?.text || "Loading disclosure…"}</p>
      </details>
      <Card title="Monitored networks">
        <ErrorNotice error={sites.error} />
        {sites.loading && <Loading />}
        {sites.data?.length ? (
          <Field label="Monitored network">
            <select value={id} onChange={(e) => select(e.target.value)}>
              {sites.data.map((s) => (
                <option key={s.networkId} value={s.networkId}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Empty title="No monitored networks">
            Create a named private network, assign a collector here, then enable
            that network in the desktop app.
          </Empty>
        )}
        {manage && (
          <ActionForm
            submit="Create monitored network"
            reset
            action={async (f) => {
              const site = await api<NetworkSite>(path, "POST", {
                name: text(f, "name"),
                cidrs: text(f, "cidrs")
                  .split(/[\s,]+/)
                  .filter(Boolean),
              });
              sites.reload();
              select(site.networkId);
              return "Network created. Collection still needs a server grant and local desktop consent.";
            }}
          >
            <Field label="Network name">
              <input name="name" required maxLength={100} />
            </Field>
            <Field
              label="Private IPv4 subnets"
              hint="Up to eight RFC1918 prefixes, /8 to /30, separated by commas. For example: 192.168.1.0/24"
            >
              <input name="cidrs" required />
            </Field>
          </ActionForm>
        )}
      </Card>
      {id && (
        <NetworkDetail
          key={`${context.workspace.id}/${id}`}
          context={context}
          path={`${path}/${id}`}
          manage={manage}
          refreshSites={sites.reload}
        />
      )}
    </>
  );
}
function NetworkDetail({
  context,
  path,
  manage,
  refreshSites,
}: {
  context: PageContext;
  path: string;
  manage: boolean;
  refreshSites: () => void;
}) {
  const resource = useResource<NetworkView>(path, true),
    agents = useResource<
      {
        id: string;
        name: string;
        state: string;
        modules: { network: boolean };
      }[]
    >(manage ? `/workspaces/${context.workspace.id}/agents` : null);
  const v = resource.data;
  const reload = () => {
    resource.reload();
    refreshSites();
  };
  const eligible =
    agents.data?.filter((a) => a.state === "ACTIVE" && a.modules.network) || [];
  return (
    <>
      <ErrorNotice error={resource.error} />
      {resource.loading && <Loading />}
      {v && (
        <>
          <Card title={`${v.name} · collection`}>
            <p>
              Network ID: <code>{v.networkId}</code> · {v.cidrs.join(", ")}
            </p>
            <button className="button" onClick={resource.reload}>
              Refresh network
            </button>
            {v.collectors.length === 0 && (
              <Empty title="No collectors assigned" />
            )}
            <ul className="item-list">
              {v.collectors.map((c) => (
                <li key={c.agentId}>
                  <strong>{c.name}</strong>{" "}
                  <span className="badge">{c.connection}</span>
                  <p>Last captured: {formatTime(c.observedAt)}</p>
                  {c.interfaces.map((i) => (
                    <p key={`${i.name}/${i.cidr}`}>
                      {i.name}: {i.cidr} · gateway {i.gateway ?? "unknown"}
                    </p>
                  ))}
                  {manage && (
                    <ActionButton
                      action={async () => {
                        await api(`${path}/collectors`, "POST", {
                          agentId: c.agentId,
                          enabled: !c.enabled,
                          ...networkConsent,
                        });
                        reload();
                      }}
                    >
                      {c.enabled
                        ? "Disable collector grant"
                        : "Enable collector grant"}
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
            {manage && (
              <>
                <ErrorNotice error={agents.error} />
                <ActionForm
                  submit="Assign collector"
                  action={async (f) => {
                    await api(`${path}/collectors`, "POST", {
                      agentId: text(f, "agentId"),
                      enabled: true,
                      ...networkConsent,
                    });
                    reload();
                    return "Grant saved. Enter this network ID in the desktop Network sharing controls and accept local consent.";
                  }}
                >
                  <Field label="Network-enabled agent (owner or admin)">
                    <select name="agentId" required>
                      <option value="">Choose an agent</option>
                      {eligible.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <NetworkConsent />
                </ActionForm>
                <details>
                  <summary>Edit or erase network collection</summary>
                  <ActionForm
                    action={async (f) => {
                      await api(path, "PATCH", {
                        name: text(f, "name"),
                        cidrs: text(f, "cidrs")
                          .split(/[\s,]+/)
                          .filter(Boolean),
                      });
                      reload();
                      return "Network updated. Existing source observations have been invalidated.";
                    }}
                  >
                    <Field label="Updated network name">
                      <input
                        name="name"
                        required
                        defaultValue={v.name}
                        maxLength={100}
                      />
                    </Field>
                    <Field label="Updated subnets">
                      <input
                        name="cidrs"
                        required
                        defaultValue={v.cidrs.join(", ")}
                      />
                    </Field>
                  </ActionForm>
                  <ActionButton
                    confirm="Erase this network’s inventory, router credentials, history and grants? The manual network label remains."
                    action={async () => {
                      await api(path, "DELETE");
                      refreshSites();
                    }}
                  >
                    Erase network monitoring data
                  </ActionButton>
                </details>
              </>
            )}
          </Card>
          <RouterPanel
            view={v}
            path={path}
            canManage={manage}
            reload={resource.reload}
          />
          <NetworkInventory
            view={v}
            path={path}
            canManage={manage}
            devices={context.devices}
            reload={resource.reload}
          />
          <Card title="Network events">
            <p>
              Latest 100 inventory and health events. Device-change events
              reflect cache observations; health warnings need operator review.
            </p>
            {!v.events.length && <Empty title="No network events" />}
            <ul className="item-list">
              {v.events.map((e) => (
                <li key={e.id}>
                  <strong>{e.kind.replaceAll("_", " ")}</strong> · {e.severity}{" "}
                  · {formatTime(e.occurredAt)} ·{" "}
                  {e.acknowledgedAt ? "acknowledged" : "unacknowledged"}
                  {context.permissions.includes("alerts:handle") && (
                    <ActionForm
                      submit="Review event"
                      action={async (f) => {
                        await api(`${path}/events/${e.id}`, "PATCH", {
                          acknowledged: f.has("acknowledged"),
                          severity: text(f, "severity"),
                        });
                        resource.reload();
                      }}
                    >
                      <Field label="Event severity">
                        <select name="severity" defaultValue={e.severity}>
                          {["info", "warning", "critical"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                      <label className="check">
                        <input
                          type="checkbox"
                          name="acknowledged"
                          defaultChecked={!!e.acknowledgedAt}
                        />
                        Acknowledged
                      </label>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Router compatibility registry">
            <p>
              Records describe evidence for a specific model and firmware. They
              do not certify hardware or authorize access.
            </p>
            <ul>
              {v.compatibility.map((c) => (
                <li key={c.id}>
                  <strong>
                    {c.manufacturer} {c.model} / {c.firmware}
                  </strong>{" "}
                  · {c.evidence} · {formatTime(c.testedAt)}
                  <p>
                    {c.features.join(", ")}. Limitations: {c.limitations}.
                    Feedback: {c.feedback}
                  </p>
                </li>
              ))}
            </ul>
            {manage && (
              <details>
                <summary>Record compatibility feedback</summary>
                <ActionForm
                  submit="Save compatibility record"
                  reset
                  action={async (f) => {
                    await api(`${path}/compatibility`, "POST", {
                      manufacturer: text(f, "manufacturer"),
                      model: text(f, "model"),
                      firmware: text(f, "firmware"),
                      adapter: "openwrt-ubus-v1",
                      features: f.getAll("features"),
                      limitations: text(f, "limitations"),
                      feedback: text(f, "feedback"),
                      evidence: text(f, "evidence"),
                      testedAt: new Date(
                        String(f.get("testedAt")),
                      ).toISOString(),
                    });
                    resource.reload();
                    return "Evidence recorded without changing collector authorization.";
                  }}
                >
                  {["manufacturer", "model", "firmware"].map((n) => (
                    <Field key={n} label={n}>
                      <input name={n} required maxLength={100} />
                    </Field>
                  ))}
                  <Field label="Evidence">
                    <select name="evidence">
                      <option value="operator_reported">
                        Operator reported
                      </option>
                      <option value="fixture_only">
                        Synthetic fixture only
                      </option>
                    </select>
                  </Field>
                  <Field label="Test date">
                    <input name="testedAt" type="datetime-local" required />
                  </Field>
                  {[
                    "wan_interface_health",
                    "wan_counters",
                    "optional_board_metadata",
                  ].map((f) => (
                    <label className="check" key={f}>
                      <input type="checkbox" name="features" value={f} />
                      {f.replaceAll("_", " ")}
                    </label>
                  ))}
                  <Field label="Limitations">
                    <textarea name="limitations" maxLength={1000} />
                  </Field>
                  <Field label="Feedback">
                    <textarea name="feedback" maxLength={1000} />
                  </Field>
                </ActionForm>
              </details>
            )}
          </Card>
          <details>
            <summary>Monitoring limitations</summary>
            <ul>
              {v.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </>
  );
}
