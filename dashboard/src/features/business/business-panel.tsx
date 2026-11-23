"use client";
import { ResponsiveFilters } from "@/shared/ui/responsive-filters";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Member } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
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

type BusinessPage = PageContext & {
  tab: string;
  location: string;
  changeLocation: (locationId: string) => void;
};

export function BusinessPanel(context: BusinessPage) {
  if (context.workspace.type !== "BUSINESS")
    return (
      <Empty title="Choose a Business organization">
        Create a Business workspace in Team, then choose it from the workspace
        selector. Each organization has separate membership, assignments and
        data.
      </Empty>
    );
  return (
    <Organization
      key={`${context.workspace.id}/${context.location}`}
      {...context}
    />
  );
}
function Organization({
  workspace,
  user,
  reloadDevices,
  tab,
  location,
  changeLocation,
}: BusinessPage) {
  const base = `/workspaces/${workspace.id}/business`;
  const view = useResource<Overview>(
    base +
      `?omitEndpoints=true${location ? `&locationId=${encodeURIComponent(location)}` : ""}`,
    true,
  );
  const all = useResource<Overview>(
    location ? base + "?omitEndpoints=true" : null,
  );
  const options = all.data ?? view.data;
  const can = (permission: string) =>
    view.data?.permissions.includes(permission) ?? false;
  const members = useResource<Member[]>(
    can("members:manage") || can("alerts:handle")
      ? `/workspaces/${workspace.id}/members`
      : null,
  );
  const alerts = useResource<Alert[]>(
    tab === "activity" && can("alerts:handle") ? base + "/alerts" : null,
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
  const locations = (
    <>
      <option value="">All locations</option>
      {options?.locations.map((l) => (
        <option key={l.id} value={l.id}>{l.name}</option>
      ))}
    </>
  );
  const refreshOrganization = (
    <ActionButton
      className="button max-[700px]:size-11 max-[700px]:px-0!"
      action={async () => {
        view.reload();
        all.reload();
        alerts.reload();
      }}
    >
      <RefreshCw size={18} aria-hidden="true" className="min-[700px]:hidden" />
      <span className="max-[700px]:sr-only">Refresh organization</span>
    </ActionButton>
  );
  return (
    <div className="stack">
      <Card title="Business organization">
        <p>
          {data.organization.name} · {data.organization.timezone}
        </p>
        <Notice>{data.qualityNote}</Notice>
        <ResponsiveFilters
          label="Location filters"
          action={async (form) => changeLocation(text(form, "location"))}
          beside={refreshOrganization}
          inline={
            <>
              <Field label="Business location">
                <select value={location} onChange={(event) => changeLocation(event.target.value)}>
                  {locations}
                </select>
              </Field>
              {refreshOrganization}
            </>
          }
        >
          <Field label="Business location">
            <select name="location" defaultValue={location}>{locations}</select>
          </Field>
        </ResponsiveFilters>
      </Card>
      {tab === "organization" && (
        <>
          <BusinessStructure
            base={base}
            location={location}
            data={data}
            options={options}
            can={can}
            mutate={mutate}
          />
        </>
      )}
      {tab === "people" && (
        <>
          <EmployeeAccess
            data={data}
            options={options}
            can={can}
            mutate={mutate}
            members={members.data}
            userId={user.id}
            workspaceRole={workspace.role}
          />
        </>
      )}
      {tab === "reports" && (
        <>
          {can("reports:read") ? (
            <OrganizationReport
              base={base}
              location={location}
              departments={options?.departments ?? []}
              canExport={can("reports:export")}
              search={reportQuery}
              setSearch={setReportQuery}
            />
          ) : (
            <Empty title="Organization reports require reporting access" />
          )}
        </>
      )}
      {tab === "activity" && (
        <>
          {can("policies:manage") && (
            <Card title="Reporting compliance policy">
              <p>
                These checks review reported metadata. They do not verify
                patching, encryption, legal compliance or security protection.
              </p>
              <ActionFormDialog
                label={
                  data.policy
                    ? "Edit reporting policy"
                    : "Create reporting policy"
                }
                primary={!data.policy}
                key={data.policy?.revision ?? 0}
                submit="Save reporting checks"
                action={async (f) => {
                  await mutate("/compliance-policy", "POST", {
                    expectedRevision: data.policy?.revision ?? 0,
                    staleMinutes: Number(f.get("stale")),
                    requireMonitoring: f.has("monitoring"),
                    requirePermission: f.has("permission"),
                  });
                  return "Reporting policy saved.";
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
              </ActionFormDialog>
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
                  <ActionFormDialog
                    label="Assign alert owner"
                    submit="Save alert assignment"
                    action={async (f) => {
                      await mutate(`/alerts/${a.id}`, "PATCH", {
                        expectedRevision: a.revision,
                        ...(text(f, "assignee")
                          ? { assigneeId: text(f, "assignee") }
                          : {}),
                        resolved: f.has("resolved"),
                      });
                      return "Alert assignment saved.";
                    }}
                  >
                    <Field label={`Handler for ${a.networkName}`}>
                      <select name="assignee" defaultValue={a.assigneeId ?? ""}>
                        <option value="">Unassigned</option>
                        {members.data
                          ?.filter((m) =>
                            ["OWNER", "ADMIN", "NETWORK_ADMIN"].includes(
                              m.role,
                            ),
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
                  </ActionFormDialog>
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
          {!["policies:manage", "alerts:handle", "audit:read"].some(can) && (
            <Empty title="Organization activity requires administrative access" />
          )}
        </>
      )}
    </div>
  );
}
