"use client";
import { usePage } from "@/shared/use-page";
import { PageControls } from "@/shared/ui/page-controls";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  Laptop,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import { workspaceHref } from "@/features/workspace/routes";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  formatTime,
  text,
} from "@/shared/ui/common";
import { NetworkInventory } from "./network-inventory";
import { RouterPanel } from "./router-panel";
import { networkConsent, NetworkConsent } from "./network-consent";
import type { NetworkView } from "./types";

export function NetworkDetail({
  context,
  networkId,
}: {
  context: PageContext;
  networkId: string;
}) {
  const router = useRouter();
  const listHref = workspaceHref("networks", "monitoring");
  const path = `/workspaces/${context.workspace.id}/networks/${networkId}`;
  const manage = context.permissions.includes("networks:manage");
  const disclosure = useResource<{ text: string }>("/networks/disclosure");
  const resource = useResource<NetworkView>(path + "?summary=true", true),
    agents = useResource<
      {
        id: string;
        name: string;
        state: string;
        modules: { network: boolean };
      }[]
    >(manage ? `/workspaces/${context.workspace.id}/agents` : null);
  const events = usePage<NetworkView["events"][number]>(
    `${path}/events/page`,
    true,
  );
  function refreshDetail() {
    window.dispatchEvent(new Event("netsentry:refresh"));
  }
  const v = resource.data;
  const lastCapture = v?.collectors.reduce<string | null>(
    (latest, collector) =>
      collector.observedAt && (!latest || collector.observedAt > latest)
        ? collector.observedAt
        : latest,
    null,
  );
  const enabledCollectors =
    v?.collectors.filter((collector) => collector.enabled) ?? [];
  const collectorStatus = !enabledCollectors.length
    ? "Awaiting collector"
    : enabledCollectors.some((collector) => collector.observedAt)
      ? "Collector assigned"
      : "Awaiting first report";
  const eligible =
    agents.data?.filter((a) => a.state === "ACTIVE" && a.modules.network) || [];
  return (
    <>
      <div>
        <Link
          href={listHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-hover! underline-offset-4 hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to monitored networks
        </Link>
      </div>
      {!v && <h1>Network details</h1>}
      <ErrorNotice error={resource.error} />
      {resource.loading && <Loading />}
      {v && (
        <>
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="[overflow-wrap:anywhere]">{v.name}</h1>
              <span className="badge mt-2">{collectorStatus}</span>
            </div>
            <button
              type="button"
              aria-label="Refresh network"
              className="button shrink-0 max-[650px]:size-11 max-[650px]:px-0!"
              onClick={refreshDetail}
            >
              <RefreshCw size={16} aria-hidden="true" />
              <span className="hidden min-[651px]:inline">Refresh network</span>
            </button>
          </header>
          <Card className="@container">
            <dl className="grid gap-4 text-sm @min-[26rem]:grid-cols-2 @min-[38rem]:grid-cols-[1fr_1fr_1.65fr] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:font-semibold [&_dt]:text-text-secondary">
              <div className="min-w-0">
                <dt>Private IPv4 subnets</dt>
                <dd className="[overflow-wrap:anywhere]">
                  {v.cidrs.join(", ")}
                </dd>
              </div>
              <div className="min-w-0">
                <dt>Last captured</dt>
                <dd>
                  {lastCapture
                    ? formatTime(lastCapture)
                    : "Awaiting first report"}
                </dd>
              </div>
              <div className="min-w-0 @min-[26rem]:@max-[38rem]:col-span-2">
                <dt>Network ID</dt>
                <dd>
                  <code className="[overflow-wrap:anywhere]">
                    {v.networkId}
                  </code>
                </dd>
              </div>
            </dl>
          </Card>
          <div className="grid items-stretch gap-4 min-[1100px]:grid-cols-2">
            <Card
              title="Collectors"
              icon={<Laptop size={19} />}
              className="flex flex-col"
            >
              {v.collectors.length === 0 && (
                <Empty title="No collectors assigned">
                  Collection needs a paired computer with local network sharing
                  enabled.
                </Empty>
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
                          refreshDetail();
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
                <div className="mt-4 flex flex-wrap justify-end border-t border-border pt-3">
                  <ActionFormDialog
                    label="Assign collector"
                    submit="Save collector assignment"
                    icon={<Plus size={16} aria-hidden="true" />}
                    primary
                    action={async (form) => {
                      await api(`${path}/collectors`, "POST", {
                        agentId: text(form, "agentId"),
                        enabled: true,
                        ...networkConsent,
                      });
                      refreshDetail();
                      return "Collector assigned. Enter this network ID in the desktop Network sharing controls and accept local consent.";
                    }}
                  >
                    <ErrorNotice error={agents.error} />
                    <Field label="Network-enabled agent (owner or admin)">
                      <select name="agentId" required>
                        <option value="">Choose an agent</option>
                        {eligible.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {!agents.loading &&
                      !agents.error &&
                      eligible.length === 0 && (
                        <p className="text-sm text-text-secondary">
                          Pair a computer and enable Network Monitoring to add
                          an agent here.
                        </p>
                      )}
                    <NetworkConsent />
                  </ActionFormDialog>
                </div>
              )}
            </Card>
            <NetworkInventory
              path={path}
              canManage={manage}
              devices={context.devices}
              reload={resource.reload}
            />
            <RouterPanel
              view={v}
              path={path}
              canManage={manage}
              reload={resource.reload}
            />
            <Card title="Network events" icon={<Activity size={19} />}>
              <p>
                Recent inventory and health events. Device-change events reflect
                cache observations; health warnings need operator review.
              </p>
              <ErrorNotice error={events.error} />
              {events.loading && <Loading />}
              {events.data?.length === 0 && <Empty title="No network events" />}
              <ul className="item-list">
                {events.data?.map((e) => (
                  <li key={e.id}>
                    <strong>{e.kind.replaceAll("_", " ")}</strong> ·{" "}
                    {e.severity} · {formatTime(e.occurredAt)} ·{" "}
                    {e.acknowledgedAt ? "acknowledged" : "unacknowledged"}
                    {context.permissions.includes("alerts:handle") && (
                      <ActionFormDialog
                        label="Edit event review"
                        submit="Review event"
                        action={async (f) => {
                          await api(`${path}/events/${e.id}`, "PATCH", {
                            acknowledged: f.has("acknowledged"),
                            severity: text(f, "severity"),
                          });
                          events.reload();
                          return "Event review saved.";
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
                      </ActionFormDialog>
                    )}
                  </li>
                ))}
              </ul>
              <PageControls label="Network events" page={events} />
            </Card>
          </div>
          <details className="card">
            <summary className="flex min-h-6 list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <Settings size={17} aria-hidden="true" />
              Network settings
              <ChevronDown size={16} aria-hidden="true" className="ms-auto" />
            </summary>
            <div className="mt-4 grid gap-4 border-t border-border pt-4">
              {manage && (
                <section
                  aria-labelledby="network-edit-title"
                  className="grid gap-3"
                >
                  <h2
                    id="network-edit-title"
                    className="text-base font-semibold"
                  >
                    Network configuration
                  </h2>
                  <ActionFormDialog
                    label="Edit name and subnets"
                    submit="Save changes"
                    action={async (f) => {
                      await api(path, "PATCH", {
                        name: text(f, "name"),
                        cidrs: text(f, "cidrs")
                          .split(/[\s,]+/)
                          .filter(Boolean),
                      });
                      resource.reload();
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
                  </ActionFormDialog>
                  <ActionButton
                    confirm="Erase this network’s inventory, router credentials, history and grants? The manual network label remains."
                    action={async () => {
                      await api(path, "DELETE");
                      router.replace(listHref);
                    }}
                  >
                    Erase network monitoring data
                  </ActionButton>
                </section>
              )}
              <details>
                <summary>Network-sharing disclosure</summary>
                <ErrorNotice error={disclosure.error} />
                <p>
                  {disclosure.data?.text ||
                    (disclosure.loading ? "Loading disclosure…" : "")}
                </p>
              </details>
              <details>
                <summary>Router compatibility registry</summary>
                <p>
                  Records describe evidence for a specific model and firmware.
                  They do not certify hardware or authorize access.
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
                  <ActionFormDialog
                    label="Record compatibility feedback"
                    submit="Save compatibility record"
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
                  </ActionFormDialog>
                )}
              </details>
              <details>
                <summary>Monitoring limitations</summary>
                <ul className="grid list-disc gap-2 ps-5">
                  {v.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </details>
            </div>
          </details>
        </>
      )}
    </>
  );
}
