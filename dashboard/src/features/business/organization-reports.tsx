"use client";
import { ResponsiveFilters } from "@/shared/ui/responsive-filters";
import { api, download } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
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
import { DepartmentField } from "./department-field";
import type { Audit, Department, Report } from "./types";

type ReportControls = {
  base: string;
  canExport: boolean;
  search: string;
  setSearch: (search: string) => void;
};

export function OrganizationReport({
  base,
  location,
  departments,
  canExport,
  search,
  setSearch,
}: ReportControls & { location: string; departments: Department[] }) {
  const reportResource = useResource<Report>(
    search ? base + "/reports?" + search : null,
  );
  const report = reportResource.data;
  return (
    <Card title="Organization usage reports">
      <ResponsiveFilters
        label="Organization report filters"
        submit="Load organization report"
        action={async (f) => {
          const q = query(f, location);
          setSearch(q);
          reportResource.reload();
        }}
      >
        <DateFields search={search} />
        <DepartmentField departments={departments} value={new URLSearchParams(search).get("departmentId") ?? ""} />
      </ResponsiveFilters>
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
            <div className="table-scroll">
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
                        {departments.find((d) => d.id === r.departmentId)
                          ?.name ?? "Unassigned"}
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
          {canExport && (
            <ActionButton
              action={async () => {
                downloadJson(
                  await api(base + "/reports/export?" + search),
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
  );
}

export function OrganizationAudit({
  base,
  canExport,
  search,
  setSearch,
}: ReportControls) {
  const auditResource = useResource<Audit>(
    search ? base + "/audit?" + search : null,
  );
  const audit = auditResource.data;
  return (
    <Card title="Organization audit">
      <ResponsiveFilters
        label="Organization audit filters"
        submit="Load organization audit"
        action={async (f) => {
          setSearch(query(f, ""));
          auditResource.reload();
        }}
      >
        <DateFields search={search} />
      </ResponsiveFilters>
      <ErrorNotice error={auditResource.error} />
      {auditResource.loading && <Loading />}
      {audit && (
        <>
          <p>
            Organization-wide records: Business actions retain{" "}
            {audit.retentionDays} days; network events retain 30 days and
            developer outcomes 7 days. No usage measurements or credentials are
            included.
          </p>
          {audit.rows.map((a) => (
            <p key={a.id}>
              {formatTime(a.occurredAt)} · {a.action.replaceAll("_", " ")} ·{" "}
              {a.targetId ?? "Organization"}
            </p>
          ))}
          {canExport && (
            <ResponsiveFilters
              label="Export audit"
              submit="Export organization audit"
              action={async (f) => {
                downloadJson(
                  await api(base + "/audit/export?" + query(f, "")),
                  "netsentry-business-audit.json",
                );
              }}
            >
              <DateFields />
            </ResponsiveFilters>
          )}
        </>
      )}
    </Card>
  );
}

function downloadJson(value: unknown, name: string) {
  download(JSON.stringify(value, null, 2), name, "application/json");
}

function DateFields({ search = "" }: { search?: string }) {
  const applied = new URLSearchParams(search);
  const now = new Date(),
    to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
    from = now.toISOString().slice(0, 8) + "01";
  return (
    <>
      <Field label="From date">
        <input name="from" type="date" required defaultValue={applied.get("from") ?? from} />
      </Field>
      <Field label="To date (exclusive)">
        <input name="to" type="date" required defaultValue={applied.get("to") ?? to} />
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
