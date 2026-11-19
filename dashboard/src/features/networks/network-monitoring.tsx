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
type Site = { networkId: string; name: string; cidrs: string[] };
type Endpoint = {
  id: string;
  name: string;
  mac: string | null;
  category: string;
  trust: string;
  notes: string;
  archived: boolean;
  assignedUserId: string | null;
  registeredDeviceId: string | null;
  presence: string;
  lastSeenAt: string;
  observations: {
    agentId: string;
    address: string;
    evidence: string;
    observedAt: string;
  }[];
};
type View = Site & {
  collectors: {
    agentId: string;
    name: string;
    connection: string;
    enabled: boolean;
    observedAt: string | null;
    interfaces: { name: string; cidr: string; gateway: string | null }[];
  }[];
  endpoints: Endpoint[];
  presenceHistory: {
    id: string;
    endpointId: string;
    agentId: string;
    address: string;
    evidence: string;
    firstObservedAt: string;
    lastObservedAt: string;
  }[];
  router: null | {
    adapter: string;
    url: string;
    model: string;
    firmware: string;
    reportedModel: string | null;
    reportedFirmware: string | null;
    testStatus: string;
    credentialConfigured: boolean;
  };
  routerHealth: string;
  wanUp: boolean | null;
  reportedAt: string | null;
  bandwidth: {
    receivedBytes: string;
    sentBytes: string;
    coverageMs: number;
    missingMs: number;
    peakRecentBitsPerSecond: number | null;
    history: { at: string; rx: string; tx: string; gaps: number }[];
    samples: {
      id: string;
      observedAt: string;
      quality: string;
      rxDelta: string | null;
      txDelta: string | null;
    }[];
  };
  events: {
    id: string;
    kind: string;
    severity: string;
    occurredAt: string;
    acknowledgedAt: string | null;
  }[];
  compatibility: {
    id: string;
    manufacturer: string;
    model: string;
    firmware: string;
    evidence: string;
    testedAt: string;
    features: string[];
    limitations: string;
    feedback: string;
  }[];
  limitations: string[];
};
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
const consent = { accepted: true, disclosureVersion: "network-sharing-v1" };
function Accept() {
  return (
    <label className="check">
      <input type="checkbox" required />I have permission to monitor this
      network and accept the network-sharing disclosure.
    </label>
  );
}
export function NetworkMonitoring(context: PageContext) {
  const path = `/workspaces/${context.workspace.id}/networks`;
  const sites = useResource<Site[]>(path, true);
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
              const site = await api<Site>(path, "POST", {
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
  const resource = useResource<View>(path, true),
    agents = useResource<
      {
        id: string;
        name: string;
        state: string;
        modules: { network: boolean };
      }[]
    >(manage ? `/workspaces/${context.workspace.id}/agents` : null);
  const [search, setSearch] = useState(""),
    [archived, setArchived] = useState(false);
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
                          ...consent,
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
                      ...consent,
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
                  <Accept />
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
          <Card title="Router and WAN">
            <p>
              Router API: <strong>{v.routerHealth}</strong> · WAN interface:{" "}
              {v.wanUp === null ? "unknown" : v.wanUp ? "up" : "down"} ·
              captured {formatTime(v.reportedAt)}
            </p>
            <p>
              WAN interface state does not prove internet reachability. Traffic
              is router-wide; per-device bandwidth and blocking are unavailable.
            </p>
            {v.router ? (
              <>
                <p>
                  {v.router.adapter} · {v.router.url} · credential{" "}
                  {v.router.credentialConfigured ? "configured" : "missing"}
                </p>
                <p>
                  Operator model/firmware: {v.router.model || "unknown"} /{" "}
                  {v.router.firmware || "unknown"}. Reported:{" "}
                  {v.router.reportedModel || "unknown"} /{" "}
                  {v.router.reportedFirmware || "unknown"}.
                </p>
                <p>
                  Connection test: <strong>{v.router.testStatus}</strong>.
                  Queuing a test is not a successful connection.
                </p>
                {manage && (
                  <>
                    <ActionButton
                      action={async () => {
                        await api(`${path}/router/test`, "POST");
                        resource.reload();
                      }}
                    >
                      Request connection test
                    </ActionButton>
                    <ActionButton
                      confirm="Remove router credentials and its counter history?"
                      action={async () => {
                        await api(`${path}/router`, "DELETE");
                        resource.reload();
                      }}
                    >
                      Remove router connection
                    </ActionButton>
                  </>
                )}
              </>
            ) : (
              <Empty title="No router connection" />
            )}
            {manage && (
              <details>
                <summary>Configure read-only OpenWrt ubus connection</summary>
                <p>
                  Requires verified HTTPS, a literal private IPv4 /ubus URL, and
                  a dedicated router account with only session login/destroy,
                  system board, WAN status and network device status access.
                  Self-signed deployments need their CA certificate.
                  Hardware/firmware validation is pending.
                </p>
                <ActionForm
                  submit="Save encrypted router credentials"
                  reset
                  action={async (f) => {
                    await api(`${path}/router`, "POST", {
                      agentId: text(f, "agentId"),
                      adapter: "openwrt-ubus-v1",
                      url: text(f, "url"),
                      interfaceName: text(f, "interfaceName"),
                      caCertificate: text(f, "caCertificate"),
                      username: text(f, "username"),
                      password: String(f.get("password") ?? ""),
                      manufacturer: text(f, "manufacturer"),
                      model: text(f, "model"),
                      firmware: text(f, "firmware"),
                      ...consent,
                    });
                    resource.reload();
                    return "Credentials encrypted and assigned to one collector. Request a connection test after local sharing is enabled.";
                  }}
                >
                  <Field label="Assigned router collector">
                    <select name="agentId" required>
                      <option value="">Choose collector</option>
                      {v.collectors
                        .filter((c) => c.enabled)
                        .map((c) => (
                          <option key={c.agentId} value={c.agentId}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="HTTPS router API URL">
                    <input
                      type="url"
                      name="url"
                      placeholder="https://192.168.1.1/ubus"
                      required
                    />
                  </Field>
                  <Field label="Logical WAN interface">
                    <input
                      name="interfaceName"
                      defaultValue="wan"
                      pattern="[a-zA-Z0-9_]{1,32}"
                      required
                    />
                  </Field>
                  <Field label="Router username">
                    <input
                      name="username"
                      required
                      maxLength={100}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Router password">
                    <input
                      name="password"
                      type="password"
                      required
                      maxLength={256}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label="Optional trusted PEM CA certificate">
                    <textarea name="caCertificate" maxLength={8192} />
                  </Field>
                  {["manufacturer", "model", "firmware"].map((n) => (
                    <Field key={n} label={`Operator ${n}`}>
                      <input name={n} maxLength={100} />
                    </Field>
                  ))}
                  <Accept />
                </ActionForm>
              </details>
            )}
            <p>
              Last 24 hours, whole confirmed intervals: received{" "}
              <strong>{v.bandwidth.receivedBytes}</strong> bytes · sent{" "}
              <strong>{v.bandwidth.sentBytes}</strong> bytes.
            </p>
            <p>
              Coverage {Math.round(v.bandwidth.coverageMs / 1000)} seconds ·
              missing {Math.round(v.bandwidth.missingMs / 1000)} seconds. Peak
              among latest 60 samples:{" "}
              {v.bandwidth.peakRecentBitsPerSecond === null
                ? "unavailable"
                : `${Math.round(v.bandwidth.peakRecentBitsPerSecond)} bit/s`}
              .
            </p>
            <details>
              <summary>Traffic history and sample quality</summary>
              <p>
                Hourly buckets use interval end time. Baselines, resets and gaps
                create no usage.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Hour</th>
                      <th>Received bytes</th>
                      <th>Sent bytes</th>
                      <th>Unavailable/baseline samples</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.bandwidth.history.map((h) => (
                      <tr key={h.at}>
                        <td>{formatTime(h.at)}</td>
                        <td>{h.rx}</td>
                        <td>{h.tx}</td>
                        <td>{h.gaps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul>
                {v.bandwidth.samples.slice(0, 10).map((s) => (
                  <li key={s.id}>
                    {formatTime(s.observedAt)} · {s.quality} · RX{" "}
                    {s.rxDelta ?? "unknown"} / TX {s.txDelta ?? "unknown"} bytes
                  </li>
                ))}
              </ul>
            </details>
          </Card>
          <Card title="Observed devices">
            <Field label="Search inventory">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Include archived devices
            </label>
            <p>
              Hostname and manufacturer are unknown. MAC and IP observations do
              not establish identity, ownership or connectivity. Trust and
              blocked labels do not enforce access.
            </p>
            {!v.endpoints.length && (
              <Empty title="No passive neighbor observations yet" />
            )}
            {v.endpoints
              .filter(
                (e) =>
                  (archived || !e.archived) &&
                  `${e.name} ${e.mac ?? ""} ${e.observations.map((o) => o.address).join(" ")}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((e) => (
                <details key={e.id}>
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
                    Recent observed spans (latest 100 across this network).
                    These are cached sightings, not confirmed connection
                    sessions; gaps remain unknown.
                  </p>
                  <ul>
                    {v.presenceHistory
                      .filter((h) => h.endpointId === e.id)
                      .map((h) => (
                        <li key={h.id}>
                          {h.address} · {h.evidence} ·{" "}
                          {formatTime(h.firstObservedAt)} to{" "}
                          {formatTime(h.lastObservedAt)} · collector {h.agentId}
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
                  {manage && (
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
                            registeredDeviceId:
                              text(f, "registeredDeviceId") || null,
                          });
                          resource.reload();
                          return "Inventory labels saved. Associations do not grant monitoring access.";
                        }}
                      >
                        <Field label="Device label">
                          <input
                            name="name"
                            defaultValue={e.name}
                            maxLength={100}
                          />
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
                            {["unknown", "trusted", "blocked_label"].map(
                              (c) => (
                                <option key={c}>{c}</option>
                              ),
                            )}
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
                            {context.devices.map((d) => (
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
                          resource.reload();
                        }}
                      >
                        Erase endpoint
                      </ActionButton>
                    </>
                  )}
                </details>
              ))}
          </Card>
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
