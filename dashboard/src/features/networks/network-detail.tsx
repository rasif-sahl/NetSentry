"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { workspaceHref } from "@/features/workspace/routes";
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
  const eligible =
    agents.data?.filter((a) => a.state === "ACTIVE" && a.modules.network) || [];
  return (
    <>
      <div>
        <Link href={listHref} className="button accent">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to monitored networks
        </Link>
      </div>
      <ErrorNotice error={resource.error} />
      {resource.loading && <Loading />}
      {v && (
        <>
          <Card
            title={v.name}
            className="[&_h2]:[overflow-wrap:anywhere]"
            headingAction={
              <button
                type="button"
                aria-label="Refresh network"
                className="button max-[650px]:size-11 max-[650px]:px-0!"
                onClick={resource.reload}
              >
                <span className="max-[650px]:hidden">Refresh network</span>
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className="hidden max-[650px]:block"
                />
              </button>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-semibold text-text-secondary">
                  Network ID
                </dt>
                <dd>
                  <code className="text-sm [overflow-wrap:anywhere]">
                    {v.networkId}
                  </code>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold text-text-secondary">
                  Private IPv4 subnets
                </dt>
                <dd className="text-sm [overflow-wrap:anywhere]">
                  {v.cidrs.join(", ")}
                </dd>
              </div>
            </dl>
            <nav
              aria-label="Network details sections"
              className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4"
            >
              <a href="#network-collection" className="button">
                Collection
              </a>
              <a href="#network-devices" className="button">
                Observed devices
              </a>
              <a href="#network-router" className="button">
                Router and WAN
              </a>
              <a href="#network-events" className="button">
                Events
              </a>
            </nav>
          </Card>
          <div id="network-collection" className="scroll-mt-4">
            <Card title="Collection">
              <details className="mb-3">
                <summary>Network-sharing disclosure</summary>
                <ErrorNotice error={disclosure.error} />
                <p>
                  {disclosure.data?.text ||
                    (disclosure.loading ? "Loading disclosure…" : "")}
                </p>
              </details>
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
                          resource.reload();
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
                    className="mt-4"
                    submit="Assign collector"
                    action={async (f) => {
                      await api(`${path}/collectors`, "POST", {
                        agentId: text(f, "agentId"),
                        enabled: true,
                        ...networkConsent,
                      });
                      resource.reload();
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
                  <details className="mt-4 border-t border-border pt-4">
                    <summary>Edit or erase network collection</summary>
                    <ActionForm
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
                    </ActionForm>
                    <ActionButton
                      confirm="Erase this network’s inventory, router credentials, history and grants? The manual network label remains."
                      action={async () => {
                        await api(path, "DELETE");
                        router.replace(listHref);
                      }}
                    >
                      Erase network monitoring data
                    </ActionButton>
                  </details>
                </>
              )}
            </Card>
          </div>
          <div id="network-devices" className="scroll-mt-4">
            <NetworkInventory
              view={v}
              path={path}
              canManage={manage}
              devices={context.devices}
              reload={resource.reload}
            />
          </div>
          <div id="network-router" className="scroll-mt-4">
            <RouterPanel
              view={v}
              path={path}
              canManage={manage}
              reload={resource.reload}
            />
          </div>
          <div id="network-events" className="scroll-mt-4">
            <Card title="Network events">
              <p>
                Latest 100 inventory and health events. Device-change events
                reflect cache observations; health warnings need operator
                review.
              </p>
              {!v.events.length && <Empty title="No network events" />}
              <ul className="item-list">
                {v.events.map((e) => (
                  <li key={e.id}>
                    <strong>{e.kind.replaceAll("_", " ")}</strong> ·{" "}
                    {e.severity} · {formatTime(e.occurredAt)} ·{" "}
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
          </div>
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
          <Card title="Monitoring limitations">
            <ul className="grid list-disc gap-2 ps-5">
              {v.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
