"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Member } from "@/shared/types";
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
import { OrganizationAudit, OrganizationReport } from "./organization-reports";
import { BusinessStructure } from "./business-structure";
import { EmployeeAccess } from "./employee-access";
import type { Alert, Overview } from "./types";

export function BusinessPanel(context: PageContext) {
  if (context.workspace.type !== "BUSINESS")
    return (
      <Empty title="Choose a Business organization">
        Create a Business workspace in Team, then choose it from the workspace
        selector. Each organization has separate membership, assignments and
        data.
      </Empty>
    );
  return <Organization key={context.workspace.id} {...context} />;
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
      <BusinessStructure
        data={data}
        options={options}
        can={can}
        mutate={mutate}
      />
      <EmployeeAccess
        data={data}
        options={options}
        can={can}
        mutate={mutate}
        members={members.data}
        userId={user.id}
        workspaceRole={workspace.role}
      />

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
        <OrganizationReport
          base={base}
          location={location}
          departments={options?.departments ?? []}
          canExport={can("reports:export")}
          search={reportQuery}
          setSearch={setReportQuery}
        />
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
        <OrganizationAudit
          base={base}
          canExport={can("reports:export")}
          search={auditQuery}
          setSearch={setAuditQuery}
        />
      )}
    </div>
  );
}
