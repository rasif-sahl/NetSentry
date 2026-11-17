"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Member } from "@/lib/types";
import type { PageContext } from "./dashboard-shell";
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
} from "../ui/common";
type Location = { id: string; name: string; revision: number };
type Department = Location & { locationId: string };
type Employee = {
  id: string;
  userId: string;
  displayName: string;
  departmentId: string | null;
  revision: number;
  offboardedAt: string | null;
};
type Assignment = {
  deviceId: string;
  employeeId: string;
  generation: number;
  revision: number;
  consentedAt: string | null;
  reportFrom: string | null;
};
type Device = {
  id: string;
  name: string;
  platform: string;
  state: string;
  generation: number;
  registeredById: string;
  ownership: string;
  lastSeenAt: string | null;
  compliance: { state: string; checks: string[] };
};
type Endpoint = {
  id: string;
  name: string;
  networkId: string;
  networkName: string;
  departmentId: string | null;
  revision: number;
};
type Overview = {
  endpoints: Endpoint[];
  moreEndpoints: boolean;
  organization: { id: string; name: string; timezone: string };
  permissions: string[];
  disclosure: { text: string };
  custodyDisclosure: { text: string };
  locations: Location[];
  departments: Department[];
  employees: Employee[];
  assignments: Assignment[];
  devices: Device[];
  networks: {
    id: string;
    name: string;
    locationId: string | null;
    collectorCount: number;
    freshCollectors: number;
  }[];
  policy: {
    revision: number;
    staleMinutes: number;
    requireMonitoring: boolean;
    requirePermission: boolean;
  } | null;
  qualityNote: string;
};
type Report = {
  from: string;
  to: string;
  timezone: string;
  qualityNote: string;
  rows: {
    localDate: string;
    metric: string;
    quality: string;
    sourceKind: string;
    collectorVersion: string;
    departmentId: string | null;
    locationId: string | null;
    value: string;
    deviceCount: number;
  }[];
};
type Audit = {
  rows: {
    id: string;
    action: string;
    targetId: string | null;
    actorId: string | null;
    occurredAt: string;
  }[];
  retentionDays: number;
};
type Alert = {
  id: string;
  kind: string;
  severity: string;
  occurredAt: string;
  networkName: string;
  assigneeId: string | null;
  revision: number;
  resolvedAt: string | null;
};
export function BusinessPanel(context: PageContext) {
  if (context.workspace.type !== "BUSINESS")
    return (
      <Empty title="Choose a Business organization">
        Create a Business workspace from the workspace selector. Each
        organization has separate membership, assignments and data.
      </Empty>
    );
  return <Organization key={context.workspace.id} {...context} />;
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Organization({ workspace, user, reloadDevices }: PageContext) {
  const base = `/workspaces/${workspace.id}/business`;
  const [location, setLocation] = useState("");
  const view = useResource<Overview>(
    base + (location ? `?locationId=${location}` : ""),
    true,
  );
  const all = useResource<Overview>(location ? base : null);
  const options = all.data ?? view.data;
  const can = (permission: string) =>
    view.data?.permissions.includes(permission) ?? false;
  const members = useResource<Member[]>(
    can("members:manage") || can("alerts:handle")
      ? `/workspaces/${workspace.id}/members`
      : null,
  );
  const alerts = useResource<Alert[]>(
    can("alerts:handle") ? base + "/alerts" : null,
    true,
  );
  const [reportQuery, setReportQuery] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const reportResource = useResource<Report>(
    reportQuery ? base + "/reports?" + reportQuery : null,
  );
  const report = reportResource.data;
  const auditResource = useResource<Audit>(
    auditQuery ? base + "/audit?" + auditQuery : null,
  );
  const audit = auditResource.data;
  async function mutate(path: string, method: string, body?: unknown) {
    await api(base + path, method, body);
    view.reload();
    all.reload();
    alerts.reload();
    reloadDevices();
  }
  if (view.loading) return <Loading />;
  if (view.error || !view.data) return <ErrorNotice error={view.error} />;
  const data = view.data;
  return (
    <div className="stack">
      <Card title="Business organization">
        <p>
          {data.organization.name} · {data.organization.timezone}
        </p>
        <Notice>{data.qualityNote}</Notice>
        <Field label="Business location">
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setReportQuery("");
              setAuditQuery("");
            }}
          >
            <option value="">All locations</option>
            {options?.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <ActionButton
          action={async () => {
            view.reload();
            all.reload();
            alerts.reload();
          }}
        >
          Refresh organization
        </ActionButton>
      </Card>
      <Card title="Locations and network health">
        {data.locations.length === 0 && <Empty title="No locations yet" />}
        {data.locations.map((l) => (
          <div key={l.id} className="row">
            <strong>{l.name}</strong>
            {can("networks:manage") && (
              <ActionForm
                key={l.revision}
                action={async (f) => {
                  await mutate(`/locations/${l.id}`, "PATCH", {
                    name: text(f, "name"),
                    expectedRevision: l.revision,
                  });
                }}
                submit="Rename location"
              >
                <Field label={`Name for ${l.name}`}>
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={l.name}
                  />
                </Field>
              </ActionForm>
            )}
          </div>
        ))}
        {can("networks:manage") && (
          <ActionForm
            reset
            submit="Add location"
            action={async (f) => {
              await mutate("/locations", "POST", {
                name: text(f, "name"),
                expectedRevision: 0,
              });
            }}
          >
            <Field label="New location name">
              <input name="name" required maxLength={100} />
            </Field>
          </ActionForm>
        )}
        {data.networks.map((n) => (
          <div key={n.id} className="row">
            <strong>{n.name}</strong>
            <p>
              {n.freshCollectors > 0
                ? `${n.freshCollectors} recent collector observations`
                : "No fresh collector observation"}{" "}
              · {n.collectorCount} assigned collectors. Hardware/network
              reachability remains unverified.
            </p>
            {can("networks:manage") && (
              <ActionForm
                submit="Assign network location"
                action={async (f) => {
                  await mutate(`/networks/${n.id}/location`, "PATCH", {
                    locationId: text(f, "location"),
                  });
                }}
              >
                <Field label={`Location for ${n.name}`}>
                  <select
                    name="location"
                    required
                    defaultValue={n.locationId ?? ""}
                  >
                    <option value="" disabled>
                      Choose location
                    </option>
                    {options?.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </ActionForm>
            )}
          </div>
        ))}
        <p>
          Create networks and manage authorized collectors in Networks. One
          location can contain several networks.
        </p>
      </Card>
      <Card title="Departments">
        {data.departments.map((d) => (
          <div key={d.id} className="row">
            <strong>{d.name}</strong>
            <p>{options?.locations.find((l) => l.id === d.locationId)?.name}</p>
            {can("members:manage") && (
              <ActionForm
                key={d.revision}
                submit="Update department"
                action={async (f) => {
                  await mutate(`/departments/${d.id}`, "PATCH", {
                    name: text(f, "name"),
                    locationId: text(f, "location"),
                    expectedRevision: d.revision,
                  });
                }}
              >
                <Field label={`Department name for ${d.name}`}>
                  <input
                    name="name"
                    defaultValue={d.name}
                    required
                    maxLength={100}
                  />
                </Field>
                <LocationField
                  locations={options?.locations ?? []}
                  value={d.locationId}
                />
              </ActionForm>
            )}
          </div>
        ))}
        {can("members:manage") && (
          <ActionForm
            reset
            submit="Add department"
            action={async (f) => {
              await mutate("/departments", "POST", {
                name: text(f, "name"),
                locationId: text(f, "location"),
                expectedRevision: 0,
              });
            }}
          >
            <Field label="New department name">
              <input name="name" required maxLength={100} />
            </Field>
            <LocationField locations={options?.locations ?? []} />
          </ActionForm>
        )}
      </Card>
      {can("networks:read") && (
        <Card title="Network device departments">
          <p>
            These are observed network endpoints, not verified ownership or
            employee identities. Assigning a department adds metadata; it does
            not measure per-device traffic.
          </p>
          {data.moreEndpoints && (
            <Notice>
              Showing the first 200 observed devices. Narrow the location or use
              Networks for network-specific inventory.
            </Notice>
          )}
          {data.endpoints.length === 0 && (
            <Empty title="No network devices observed" />
          )}
          {data.endpoints.map((e) => (
            <div key={e.id} className="row">
              <strong>{e.name || "Unnamed observed device"}</strong>
              <p>
                {e.networkName} ·{" "}
                {options?.departments.find((d) => d.id === e.departmentId)
                  ?.name ?? "No department assigned"}
              </p>
              {can("networks:manage") && (
                <ActionForm
                  key={e.revision}
                  submit="Assign network device department"
                  action={async (f) => {
                    await mutate(`/endpoints/${e.id}/department`, "PATCH", {
                      expectedRevision: e.revision,
                      ...(text(f, "department")
                        ? { departmentId: text(f, "department") }
                        : {}),
                    });
                  }}
                >
                  <DepartmentField
                    departments={options?.departments ?? []}
                    value={e.departmentId ?? ""}
                  />
                </ActionForm>
              )}
            </div>
          ))}
        </Card>
      )}
      <Card title="Employees and offboarding">
        <p>
          Invite a verified member in Team first. Employee enrolment records an
          organizational relationship; device collection and organization
          sharing still need separate consent.
        </p>
        {data.employees.map((e) => (
          <div key={e.id} className="row">
            <strong>{e.displayName}</strong>
            <p>
              {e.offboardedAt
                ? `Offboarded ${formatTime(e.offboardedAt)}`
                : (options?.departments.find((d) => d.id === e.departmentId)
                    ?.name ?? "No department")}
            </p>
            {can("members:manage") && (
              <>
                <ActionForm
                  key={e.revision}
                  submit={
                    e.offboardedAt
                      ? "Restore invited employee"
                      : "Update employee department"
                  }
                  action={async (f) => {
                    await mutate(`/employees/${e.id}`, "PATCH", {
                      expectedRevision: e.revision,
                      ...(text(f, "department")
                        ? { departmentId: text(f, "department") }
                        : {}),
                    });
                    return "Updated. Device sharing must be accepted again.";
                  }}
                >
                  <DepartmentField
                    departments={options?.departments ?? []}
                    value={e.departmentId ?? ""}
                  />
                </ActionForm>
                {!e.offboardedAt && e.userId !== user.id && (
                  <ActionButton
                    confirm={`Offboard ${e.displayName}? This removes organization membership, revokes organization device/agent credentials and ends sharing. Personal data and unrelated organizations are preserved.`}
                    action={async () => {
                      await mutate(`/employees/${e.id}/offboard`, "POST", {
                        confirmation: "OFFBOARD",
                      });
                    }}
                  >
                    Offboard employee
                  </ActionButton>
                )}
              </>
            )}
          </div>
        ))}
        {can("members:manage") && (
          <ActionForm
            reset
            submit="Enrol employee"
            action={async (f) => {
              await mutate("/employees", "POST", {
                userId: text(f, "member"),
                ...(text(f, "department")
                  ? { departmentId: text(f, "department") }
                  : {}),
              });
            }}
          >
            <Field label="Organization member">
              <select name="member" required>
                <option value="" disabled>
                  Choose current member
                </option>
                {members.data?.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName} · {m.role}
                  </option>
                ))}
              </select>
            </Field>
            <DepartmentField departments={options?.departments ?? []} />
          </ActionForm>
        )}
      </Card>
      <Card title="Device assignment and employee sharing">
        <Notice>{data.disclosure.text}</Notice>
        {data.devices.map((d) => {
          const a = data.assignments.find((a) => a.deviceId === d.id),
            e = data.employees.find((e) => e.id === a?.employeeId);
          return (
            <div key={d.id} className="row">
              <strong>{d.name}</strong>
              <p>
                {d.platform} · {d.state} · custody: {d.ownership} · generation{" "}
                {d.generation}
              </p>
              <p>
                Reporting checks: {d.compliance.state.replaceAll("_", " ")}{" "}
                {d.compliance.checks
                  .map((c) => c.replaceAll("_", " "))
                  .join(", ")}
                . Metadata {formatTime(d.lastSeenAt)}.
              </p>
              <p>
                {e?.displayName ?? "No visible employee assignment"} ·{" "}
                {a?.consentedAt && a.generation === d.generation
                  ? `Sharing accepted; reports from ${a.reportFrom}`
                  : "Sharing unavailable or awaiting acceptance"}
              </p>
              {can("devices:manage") && (
                <ActionForm
                  key={a?.revision ?? 0}
                  submit="Assign employee device"
                  action={async (f) => {
                    await mutate(`/devices/${d.id}/assignment`, "POST", {
                      employeeId: text(f, "employee"),
                      expectedRevision: a?.revision ?? 0,
                    });
                    return "Assigned. The employee must review and accept sharing.";
                  }}
                >
                  <Field label={`Employee for ${d.name}`}>
                    <select
                      name="employee"
                      required
                      defaultValue={a?.employeeId ?? ""}
                    >
                      <option value="" disabled>
                        Choose employee
                      </option>
                      {data.employees
                        .filter((e) => !e.offboardedAt)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.displayName}
                          </option>
                        ))}
                    </select>
                  </Field>
                </ActionForm>
              )}
              {a && e?.userId === user.id && d.state === "ACTIVE" && (
                <ActionButton
                  confirm={`Accept business-sharing-v1 for ${d.name}? ${data.disclosure.text}`}
                  action={async () => {
                    await mutate(`/devices/${d.id}/sharing`, "POST", {
                      expectedRevision: a.revision,
                      generation: d.generation,
                      accepted: true,
                      disclosureVersion: "business-sharing-v1",
                    });
                  }}
                >
                  Accept organization sharing
                </ActionButton>
              )}
              {a &&
                (can("devices:manage") ||
                  e?.userId === user.id ||
                  d.registeredById === user.id) && (
                  <ActionButton
                    confirm="Withdraw sharing? This ends organization report access. It does not erase your personal observations."
                    action={async () => {
                      await mutate(`/devices/${d.id}/assignment`, "DELETE");
                    }}
                  >
                    Withdraw device sharing
                  </ActionButton>
                )}
              {workspace.role === "OWNER" &&
                d.registeredById === user.id &&
                d.ownership !== "organization" && (
                  <ActionButton
                    confirm={data.custodyDisclosure.text}
                    action={async () => {
                      await mutate(`/devices/${d.id}/custody`, "POST", {
                        accepted: true,
                        disclosureVersion: "business-custody-v1",
                      });
                    }}
                  >
                    Declare company-owned device
                  </ActionButton>
                )}
              {can("devices:manage") && d.state === "ACTIVE" && (
                <ActionButton
                  confirm="Remotely unenrol this device? Credentials and monitoring consent will be revoked; personal measurements will be retained for their owner's privacy controls."
                  action={async () => {
                    await mutate(`/devices/${d.id}/unenrol`, "POST", {
                      confirmation: "UNENROL",
                    });
                  }}
                >
                  Remotely unenrol device
                </ActionButton>
              )}
            </div>
          );
        })}
      </Card>
      {can("policies:manage") && (
        <Card title="Reporting compliance policy">
          <p>
            These checks review reported metadata. They do not verify patching,
            encryption, legal compliance or security protection.
          </p>
          <ActionForm
            key={data.policy?.revision ?? 0}
            submit="Save reporting checks"
            action={async (f) => {
              await mutate("/compliance-policy", "POST", {
                expectedRevision: data.policy?.revision ?? 0,
                staleMinutes: Number(f.get("stale")),
                requireMonitoring: f.has("monitoring"),
                requirePermission: f.has("permission"),
              });
            }}
          >
            <Field label="Metadata stale after minutes">
              <input
                name="stale"
                type="number"
                min={5}
                max={10080}
                required
                defaultValue={data.policy?.staleMinutes ?? 1440}
              />
            </Field>
            <label>
              <input
                name="monitoring"
                type="checkbox"
                defaultChecked={data.policy?.requireMonitoring ?? false}
              />{" "}
              Require monitoring consent
            </label>
            <label>
              <input
                name="permission"
                type="checkbox"
                defaultChecked={data.policy?.requirePermission ?? false}
              />{" "}
              Require a reported granted permission
            </label>
          </ActionForm>
        </Card>
      )}
      {can("reports:read") && (
        <Card title="Organization usage reports">
          <ActionForm
            submit="Load organization report"
            action={async (f) => {
              const q = query(f, location);
              setReportQuery(q);
              reportResource.reload();
            }}
          >
            <DateFields />
            <DepartmentField departments={options?.departments ?? []} />
          </ActionForm>
          <ErrorNotice error={reportResource.error} />
          {reportResource.loading && <Loading />}
          {report && (
            <>
              <Notice>{report.qualityNote}</Notice>
              <p>
                {report.from} to {report.to} (exclusive) · {report.timezone}
              </p>
              {report.rows.length === 0 ? (
                <Empty title="No consented organization observations" />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Department</th>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Quality / source</th>
                        <th>Reporting devices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.localDate}</td>
                          <td>
                            {options?.departments.find(
                              (d) => d.id === r.departmentId,
                            )?.name ?? "Unassigned"}
                          </td>
                          <td>{r.metric.replaceAll("_", " ")}</td>
                          <td>{r.value}</td>
                          <td>
                            {r.quality} · {r.sourceKind} · {r.collectorVersion}
                          </td>
                          <td>{r.deviceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {can("reports:export") && (
                <ActionButton
                  action={async () => {
                    download(
                      await api(base + "/reports/export?" + reportQuery),
                      "netsentry-organization-report.json",
                    );
                  }}
                >
                  Export current organization date range
                </ActionButton>
              )}
            </>
          )}
        </Card>
      )}
      {can("alerts:handle") && (
        <Card title="Business network alerts">
          <ErrorNotice error={alerts.error} />
          {alerts.data?.length === 0 && (
            <Empty title="No network events reported" />
          )}
          {alerts.data?.map((a) => (
            <div key={a.id} className="row">
              <strong>
                {a.networkName} · {a.kind.replaceAll("_", " ")}
              </strong>
              <p>
                {a.severity} · {formatTime(a.occurredAt)} ·{" "}
                {a.resolvedAt ? "Resolved" : "Open"}
              </p>
              <ActionForm
                submit="Save alert assignment"
                action={async (f) => {
                  await mutate(`/alerts/${a.id}`, "PATCH", {
                    expectedRevision: a.revision,
                    ...(text(f, "assignee")
                      ? { assigneeId: text(f, "assignee") }
                      : {}),
                    resolved: f.has("resolved"),
                  });
                }}
              >
                <Field label={`Handler for ${a.networkName}`}>
                  <select name="assignee" defaultValue={a.assigneeId ?? ""}>
                    <option value="">Unassigned</option>
                    {members.data
                      ?.filter((m) =>
                        ["OWNER", "ADMIN", "NETWORK_ADMIN"].includes(m.role),
                      )
                      .map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName}
                        </option>
                      ))}
                  </select>
                </Field>
                <label>
                  <input
                    name="resolved"
                    type="checkbox"
                    defaultChecked={!!a.resolvedAt}
                  />{" "}
                  Mark resolved
                </label>
              </ActionForm>
            </div>
          ))}
        </Card>
      )}
      {can("audit:read") && (
        <Card title="Organization audit">
          <ActionForm
            submit="Load organization audit"
            action={async (f) => {
              setAuditQuery(query(f, ""));
              auditResource.reload();
            }}
          >
            <DateFields />
          </ActionForm>
          <ErrorNotice error={auditResource.error} />
          {auditResource.loading && <Loading />}
          {audit && (
            <>
              <p>
                Organization-wide records: Business actions retain{" "}
                {audit.retentionDays} days; network events retain 30 days and
                developer outcomes 7 days. No usage measurements or credentials
                are included.
              </p>
              {audit.rows.map((a) => (
                <p key={a.id}>
                  {formatTime(a.occurredAt)} · {a.action.replaceAll("_", " ")} ·{" "}
                  {a.targetId ?? "Organization"}
                </p>
              ))}
              {can("reports:export") && (
                <ActionForm
                  submit="Export organization audit"
                  action={async (f) => {
                    download(
                      await api(base + "/audit/export?" + query(f, "")),
                      "netsentry-business-audit.json",
                    );
                  }}
                >
                  <DateFields />
                </ActionForm>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
function LocationField({
  locations,
  value = "",
}: {
  locations: Location[];
  value?: string;
}) {
  return (
    <Field label="Location">
      <select name="location" defaultValue={value} required>
        <option value="" disabled>
          Choose location
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function DepartmentField({
  departments,
  value = "",
}: {
  departments: Department[];
  value?: string;
}) {
  return (
    <Field label="Department">
      <select name="department" defaultValue={value}>
        <option value="">No department / all report departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
function DateFields() {
  const now = new Date(),
    to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
    from = now.toISOString().slice(0, 8) + "01";
  return (
    <>
      <Field label="From date">
        <input name="from" type="date" required defaultValue={from} />
      </Field>
      <Field label="To date (exclusive)">
        <input name="to" type="date" required defaultValue={to} />
      </Field>
    </>
  );
}
function query(form: FormData, location: string) {
  return new URLSearchParams({
    from: text(form, "from"),
    to: text(form, "to"),
    ...(location ? { locationId: location } : {}),
    ...(text(form, "department")
      ? { departmentId: text(form, "department") }
      : {}),
  }).toString();
}
