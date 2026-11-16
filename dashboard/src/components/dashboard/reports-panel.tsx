"use client";
import { useState } from "react";
import { api, download } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Report, UsageNetwork } from "@/lib/types";
import {
  duration,
  exactValue,
  localDate,
  metrics,
  offsetDate,
} from "@/lib/usage";
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
export function ReportsPanel({
  user,
  workspace,
  devices,
  permissions,
}: PageContext) {
  const today = localDate(workspace.timezone);
  const [query, setQuery] = useState(() =>
    new URLSearchParams({
      from: offsetDate(today, -6),
      to: offsetDate(today, 1),
      metric: "mobile_data_bytes",
      period: "day",
    }).toString(),
  );
  const [metric, setMetric] = useState("mobile_data_bytes");
  const report = useResource<Report>(
    `/workspaces/${workspace.id}/monitoring/usage?${query}`,
    true,
  );
  const networks = useResource<UsageNetwork[]>(
    `/workspaces/${workspace.id}/monitoring/networks`,
  );
  const allowedDevices = permissions.includes("reports:read")
    ? devices
    : devices.filter((device) => device.registeredById === user.id);
  const deviceName = (id: string) =>
    devices.find((d) => d.id === id)?.name ?? id;
  const params = new URLSearchParams(query);
  const selectedId = params.get("deviceId");
  const canExport =
    permissions.includes("reports:export") ||
    (selectedId
      ? devices.find((d) => d.id === selectedId)?.registeredById === user.id
      : !permissions.includes("reports:read") ||
        devices.every((d) => d.registeredById === user.id));
  return (
    <>
      <Card title="Choose your report">
        <ActionForm
          submit="Apply report filters"
          action={async (form) => {
            const values = {
              from: text(form, "from"),
              to: text(form, "to"),
              metric: text(form, "metric"),
              period: text(form, "period"),
            };
            const params = new URLSearchParams(values);
            for (const key of ["deviceId", "networkId", "applicationId"])
              if (text(form, key)) params.set(key, text(form, key));
            if (values.to <= values.from)
              throw new Error("The end date must follow the start date.");
            setQuery(params.toString());
            report.reload();
            return "Report filters applied.";
          }}
        >
          <div className="field-row">
            <Field label="From (local date)">
              <input
                name="from"
                type="date"
                required
                defaultValue={params.get("from")!}
              />
            </Field>
            <Field label="To (exclusive local date)">
              <input
                name="to"
                type="date"
                required
                defaultValue={params.get("to")!}
              />
            </Field>
            <Field label="Group by">
              <select name="period">
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Metric">
              <select
                name="metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {Object.entries(metrics).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Device">
              <select name="deviceId">
                <option value="">
                  {permissions.includes("reports:read")
                    ? "All permitted devices"
                    : "My devices only"}
                </option>
                {allowedDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Network label">
              <select name="networkId">
                <option value="">All labels</option>
                {networks.data?.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {metric === "application_foreground_seconds" && (
            <Field
              label="Application identifier"
              hint="Use the identifier reported by the collector."
            >
              <input name="applicationId" required maxLength={255} />
            </Field>
          )}
          <small>
            Dates use {workspace.timezone}. Up to 366 local days; larger
            histories may need a device filter.
          </small>
        </ActionForm>
      </Card>
      <ErrorNotice error={report.error} />
      {report.loading && <Loading />}
      {report.data && (
        <>
          <div className="metric-grid">
            <Card>
              <span className="metric-label">Measured in this period</span>
              <strong className="report-total">
                {exactValue(
                  report.data.comparison.currentMeasured,
                  report.data.metric,
                )}
              </strong>
              <p>Estimated values are shown separately.</p>
            </Card>
            <Card>
              <span className="metric-label">Previous comparison period</span>
              <strong className="report-total">
                {exactValue(
                  report.data.comparison.measured,
                  report.data.metric,
                )}
              </strong>
              <p>
                {report.data.comparison.from} → {report.data.comparison.to}{" "}
                (exclusive)
              </p>
            </Card>
            <Card>
              <span className="metric-label">Change in measured usage</span>
              <strong className="metric-value">
                {report.data.comparison.percentChange === null
                  ? "Unavailable"
                  : `${report.data.comparison.percentChange}%`}
              </strong>
              <p>No percentage is invented for missing or zero baselines.</p>
            </Card>
          </div>
          <Card title="Usage over time">
            <div className="section-heading">
              <p>
                {report.data.from} → {report.data.to} (exclusive) ·{" "}
                {report.data.timezone}
              </p>
              {canExport ? (
                <ActionButton
                  action={async () => {
                    const exported = await api<{
                      content: string;
                      fileName: string;
                      contentType: string;
                    }>(
                      `/workspaces/${workspace.id}/monitoring/export?${query}`,
                    );
                    download(
                      exported.content,
                      exported.fileName,
                      exported.contentType,
                    );
                  }}
                >
                  Download CSV
                </ActionButton>
              ) : (
                <span className="badge">
                  Shared export requires export permission
                </span>
              )}
            </div>
            <small>
              Last refreshed {formatTime(report.updatedAt)}
              {report.error
                ? " · Refresh failed; showing the previous result."
                : ""}
            </small>
            {!report.data.sources.length && (
              <Empty title="No observations in this period">
                Missing measurements are not zero usage. A supported collector
                must upload observations first.
              </Empty>
            )}
            <UsageChart report={report.data} />
            <div className="table-scroll">
              <table>
                <caption>
                  Measured and estimated values remain separate. Coverage is
                  time across the selected devices.
                </caption>
                <thead>
                  <tr>
                    <th>Period starts</th>
                    <th>Measured</th>
                    <th>Estimated</th>
                    <th>Measured coverage</th>
                    <th>Missing time</th>
                    <th>Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.buckets.map((bucket) => (
                    <tr key={bucket.periodStart}>
                      <th scope="row">{bucket.periodStart}</th>
                      <td>
                        {exactValue(bucket.measured, report.data!.metric)}
                      </td>
                      <td>
                        {exactValue(bucket.estimated, report.data!.metric)}
                      </td>
                      <td>
                        {duration(bucket.measuredCoverageMs)} /{" "}
                        {duration(bucket.expectedMs)}
                      </td>
                      <td>{duration(bucket.missingMs)}</td>
                      <td>
                        {bucket.prorated
                          ? "Proportional split"
                          : "No day split"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Notice>{report.data.qualityNote}</Notice>
          </Card>
          <Card title="Measurement sources">
            {report.data.sources.length ? (
              <div className="table-scroll">
                <table>
                  <caption>
                    Authenticated device reports; collection has not been
                    independently certified.
                  </caption>
                  <thead>
                    <tr>
                      <th>Device / date</th>
                      <th>Source / collector</th>
                      <th>Quality / allocation</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.sources.map((source, index) => (
                      <tr key={index}>
                        <td>
                          {deviceName(source.deviceId)}
                          <small>{source.localDate}</small>
                        </td>
                        <td>
                          {source.kind}
                          <small>{source.collectorVersion}</small>
                        </td>
                        <td>
                          {source.quality}
                          <small>
                            {source.prorated
                              ? "Proportionally allocated"
                              : "Unsplit"}
                          </small>
                        </td>
                        <td>{exactValue(source.value, report.data!.metric)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No sources reported.</p>
            )}
            <details>
              <summary>
                Declared collection gaps ({report.data.declaredGaps.length})
              </summary>
              <p>
                Historical declarations may have been filled by later uploads.
              </p>
              <ul className="item-list">
                {report.data.declaredGaps.map((gap, index) => (
                  <li key={index}>
                    <div>
                      <strong>
                        {deviceName(gap.deviceId)} ·{" "}
                        {gap.reason.replaceAll("_", " ")}
                      </strong>
                      <small>
                        {formatTime(gap.intervalStart)} →{" "}
                        {formatTime(gap.intervalEnd)}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        </>
      )}
    </>
  );
}

function UsageChart({ report }: { report: Report }) {
  const buckets = report.buckets.slice(-31);
  // Number is used for visual ratios only; every label/table preserves the exact API decimal.
  const max = Math.max(
    ...buckets.flatMap((bucket) => [
      Number(bucket.measured ?? 0),
      Number(bucket.estimated ?? 0),
    ]),
    1,
  );
  return (
    <figure className="usage-figure">
      <figcaption>
        Recent {buckets.length} report buckets · measured{" "}
        <span className="chart-key measured" /> estimated{" "}
        <span className="chart-key estimated" />. Exact values are in the table
        below.
      </figcaption>
      <div className="usage-chart" aria-hidden="true">
        {buckets.map((bucket) => (
          <div
            className="chart-column"
            key={bucket.periodStart}
            title={`${bucket.periodStart}: measured ${exactValue(bucket.measured, report.metric)}; estimated ${exactValue(bucket.estimated, report.metric)}`}
          >
            <div className="chart-bars">
              <span
                className="measured"
                style={{
                  height: `${(Number(bucket.measured ?? 0) / max) * 100}%`,
                }}
              />
              <span
                className="estimated"
                style={{
                  height: `${(Number(bucket.estimated ?? 0) / max) * 100}%`,
                }}
              />
            </div>
            <small>{bucket.periodStart.slice(5)}</small>
          </div>
        ))}
      </div>
    </figure>
  );
}
