"use client";
import { useEffect, useRef, useState } from "react";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { api } from "@/shared/api";
import { usePage } from "@/shared/use-page";
import { PageControls } from "@/shared/ui/page-controls";
import { useResource } from "@/shared/use-resource";
import type { Alert, AlertRule, UsageNetwork } from "@/shared/types";
import { metrics, exactValue } from "@/shared/usage";
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
  number,
  text,
} from "@/shared/ui/common";
export function NotificationPreferencesPanel() {
  const preference = useResource<{
    inApp: boolean;
    push: boolean;
    email: boolean;
    emailDeliveryAvailable: boolean;
  }>("/notifications/preferences");
  return (
    <Card title="Notification preferences">
      <ErrorNotice error={preference.error} />
      {preference.loading && <Loading />}
      {preference.data && (
        <ActionForm
          submit="Save notification preferences"
          action={async (form) => {
            await api("/notifications/preferences", "PATCH", {
              inApp: form.has("inApp"),
              push: form.has("push"),
              email: form.has("email"),
            });
            preference.reload();
          }}
        >
          <label className="check">
            <input
              type="checkbox"
              name="inApp"
              defaultChecked={preference.data.inApp}
            />
            In-app notifications
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="push"
              defaultChecked={preference.data.push}
            />
            Push preference (delivery unavailable until providers and native
            clients are configured)
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="email"
              defaultChecked={preference.data.email}
            />
            Opt in to email alerts (delivery disabled)
          </label>
          <small>
            Email alert delivery is disabled. Saving preferences sends no email.
          </small>
          <small>
            Quiet hours and your current preferences are checked when an alert
            is delivered.
          </small>
        </ActionForm>
      )}
    </Card>
  );
}
export function AlertsPanel(context: PageContext & { tab: string }) {
  const { workspace, devices, tab } = context;
  const base = `/workspaces/${workspace.id}/monitoring`;
  const rules = useResource<AlertRule[]>(
    tab === "rules" ? `${base}/rules` : null,
    true,
  );
  const alerts = usePage<Alert>(
    tab === "history" ? `${base}/alerts/page` : null,
    true,
  );
  const notifications = usePage<Alert>(
    tab === "notifications" ? `${base}/notifications/page` : null,
    true,
  );
  const networks = useResource<UsageNetwork[]>(
    tab === "rules" ? `${base}/networks` : null,
  );
  const [editing, setEditing] = useState<AlertRule>();
  const [saved, setSaved] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);
  function reload() {
    rules.reload();
    alerts.reload();
    notifications.reload();
  }
  return (
    <>
      {tab === "notifications" && (
        <>
          <Card title="In-app notifications">
            <ErrorNotice error={notifications.error} />
            {notifications.loading && <Loading />}
            {notifications.data?.length ? (
              <ul className="item-list">
                {notifications.data.map((alert) => (
                  <li key={alert.id}>
                    <div>
                      <strong>
                        {alert.snapshot.kind.replaceAll("_", " ")} ·{" "}
                        {alert.snapshot.quality ?? "health"} ·{" "}
                        {alert.snapshot.severity}
                      </strong>
                      <small>
                        {formatTime(alert.createdAt)} ·{" "}
                        {alert.acknowledgedAt
                          ? "Acknowledged"
                          : "Needs acknowledgement"}
                      </small>
                    </div>
                    {!alert.acknowledgedAt && (
                      <ActionButton
                        action={async () => {
                          await api(
                            `${base}/alerts/${alert.id}/acknowledge`,
                            "POST",
                            {},
                          );
                          reload();
                        }}
                      >
                        Acknowledge notification
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              notifications.data && (
                <Empty title="No notifications yet">
                  Pending, quiet-hour or suppressed alerts can still appear in
                  alert the History tab.
                </Empty>
              )
            )}
            <PageControls label="Notifications" page={notifications} />
          </Card>
        </>
      )}
      {tab === "rules" && (
        <>
          {saved && (
            <Notice tone="success">
              Rule saved. It will be checked by the next monitoring maintenance
              pass.
            </Notice>
          )}
          {!editing ? (
            <div className="button-row align-end workflow-actions">
              <RuleEditor
                context={context}
                networks={networks.data ?? []}
                saved={() => {
                  setSaved(true);
                  reload();
                }}
              />
            </div>
          ) : (
            <div ref={editor} tabIndex={-1}>
              <Card title="Edit alert rule">
                <RuleEditor
                  key={editing.id}
                  context={context}
                  networks={networks.data ?? []}
                  initial={editing}
                  saved={() => {
                    setEditing(undefined);
                    setSaved(true);
                    reload();
                  }}
                />
                <div className="button-row align-end">
                  <button
                    type="button"
                    className="button accent"
                    onClick={() => setEditing(undefined)}
                  >
                    Cancel editing
                  </button>
                </div>
              </Card>
            </div>
          )}
          <Card title="Your alert rules">
            <ErrorNotice error={rules.error} />
            {rules.loading && <Loading />}
            {rules.data?.length ? (
              <ul className="item-list">
                {rules.data.map((rule) => (
                  <li key={rule.id}>
                    <div>
                      <strong>
                        {rule.config.kind.replaceAll("_", " ")} ·{" "}
                        {rule.config.severity}
                      </strong>
                      <small>
                        {rule.deviceId
                          ? (devices.find((d) => d.id === rule.deviceId)
                              ?.name ?? "Device")
                          : rule.networkId
                            ? "Network label"
                            : "Workspace"}{" "}
                        · {rule.config.enabled ? "Enabled" : "Disabled"} ·{" "}
                        {rule.config.period} ·{" "}
                        {rule.config.quality ?? "measured"}
                        {rule.config.metric
                          ? ` · ${exactValue(rule.config.threshold.toFixed(6), rule.config.metric)}`
                          : ""}
                      </small>
                    </div>
                    <button
                      className="button"
                      onClick={() => {
                        setSaved(false);
                        setEditing(rule);
                      }}
                    >
                      Edit rule
                    </button>
                    <ActionButton
                      action={async () => {
                        await api(`${base}/rules/${rule.id}`, "DELETE", {});
                        reload();
                      }}
                      confirm="Delete this rule and its alert/delivery history?"
                    >
                      Delete rule
                    </ActionButton>
                  </li>
                ))}
              </ul>
            ) : (
              rules.data && <Empty title="No alert rules yet" />
            )}
          </Card>
        </>
      )}
      {tab === "history" && (
        <>
          <Card title="Alert history and delivery">
            <ErrorNotice error={alerts.error} />
            <small>Last refreshed {formatTime(alerts.updatedAt)}.</small>
            {alerts.loading && <Loading />}
            {alerts.data?.length ? (
              <div className="page-stack">
                {alerts.data.map((alert) => (
                  <article key={alert.id} className="alert-entry">
                    <div className="section-heading">
                      <h3>
                        {alert.snapshot.kind.replaceAll("_", " ")} ·{" "}
                        {alert.snapshot.quality ?? "health"}{" "}
                        <span className="badge">{alert.snapshot.severity}</span>
                      </h3>
                      {!alert.acknowledgedAt && (
                        <ActionButton
                          action={async () => {
                            await api(
                              `${base}/alerts/${alert.id}/acknowledge`,
                              "POST",
                              {},
                            );
                            reload();
                          }}
                        >
                          Acknowledge alert
                        </ActionButton>
                      )}
                    </div>
                    <p>
                      {formatTime(alert.createdAt)} ·{" "}
                      {alert.resolvedAt ? "Resolved" : "Condition active"} ·{" "}
                      {alert.acknowledgedAt ? "Acknowledged" : "Unacknowledged"}
                    </p>
                    <p>
                      Observed value: {alert.snapshot.value ?? "Not applicable"}{" "}
                      · window {alert.snapshot.windowKey} ·{" "}
                      {alert.snapshot.quality ?? "quality not recorded"}
                    </p>
                    <details>
                      <summary>Delivery attempts</summary>
                      <ul className="item-list">
                        {alert.deliveries.map((delivery) => (
                          <li key={delivery.id}>
                            <div>
                              <strong>
                                {delivery.channel.replaceAll("_", " ")} ·{" "}
                                {delivery.status}
                              </strong>
                              <small>
                                {delivery.attempts} attempts · due{" "}
                                {formatTime(delivery.dueAt)}
                              </small>
                              {delivery.attemptHistory.map((attempt, index) => (
                                <small key={index}>
                                  {formatTime(attempt.at)} · {attempt.outcome}
                                  {attempt.code ? ` · ${attempt.code}` : ""}
                                </small>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              alerts.data && <Empty title="No alerts in your history" />
            )}
            <PageControls label="Alert history" page={alerts} />
          </Card>
        </>
      )}
      {tab === "preferences" && (
        <>
          <Notice>
            In-app delivery is available. Android/iOS push providers remain
            unavailable. Alert evaluation and delivery require scheduled
            monitoring maintenance.
          </Notice>
          <NotificationPreferencesPanel />
        </>
      )}
    </>
  );
}
function RuleEditor({
  context,
  networks,
  initial,
  saved,
}: {
  context: PageContext;
  networks: UsageNetwork[];
  initial?: AlertRule;
  saved: () => void;
}) {
  const config = initial?.config;
  const [kind, setKind] = useState(config?.kind ?? "threshold");
  const [metric, setMetric] = useState(config?.metric ?? "mobile_data_bytes");
  const [quiet, setQuiet] = useState(!!config?.quietHours);
  const shared =
    context.permissions.includes("reports:read") &&
    context.permissions.includes("alerts:handle");
  const allowed = shared
    ? context.devices
    : context.devices.filter(
        (device) => device.registeredById === context.user.id,
      );
  const Form = initial ? ActionForm : ActionFormDialog;
  const dialog = initial
    ? {}
    : {
        label: "Create rule",
        primary: true,
        onClose: () => {
          setKind("threshold");
          setMetric("mobile_data_bytes");
          setQuiet(false);
        },
      };
  return (
    <Form
      {...dialog}
      submit={initial ? "Update alert rule" : "Create alert rule"}
      action={async (form) => {
        const input = {
          kind,
          period: text(form, "period"),
          threshold:
            kind === "permission_revoked" ? 1 : number(form, "threshold"),
          severity: text(form, "severity"),
          channels: form.getAll("channels").map(String),
          enabled: form.has("enabled"),
          ...(kind === "threshold"
            ? {
                metric,
                quality: text(form, "quality"),
                ...(text(form, "applicationId")
                  ? { applicationId: text(form, "applicationId") }
                  : {}),
                ...(text(form, "networkId")
                  ? { networkId: text(form, "networkId") }
                  : {}),
              }
            : {}),
          ...(text(form, "deviceId")
            ? { deviceId: text(form, "deviceId") }
            : {}),
          ...(quiet
            ? {
                quietHours: {
                  start: text(form, "quietStart"),
                  end: text(form, "quietEnd"),
                  timezone: text(form, "quietTimezone"),
                },
              }
            : {}),
        };
        if (!input.channels.length)
          throw new Error("Choose at least one delivery channel.");
        await api(
          `/workspaces/${context.workspace.id}/monitoring/rules${initial ? "/" + initial.id : ""}`,
          initial ? "PATCH" : "POST",
          input,
        );
        saved();
      }}
    >
      {!context.devices.length && (
        <Notice>
          Register a supported device to create device-specific rules.
        </Notice>
      )}
      <div className="field-row">
        <Field label="Rule type">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="threshold">Usage threshold</option>
            <option value="device_offline">Device offline</option>
            <option value="not_reporting">Usage reports missing</option>
            <option value="permission_revoked">Permission lost</option>
          </select>
        </Field>
        <Field label="Rule device">
          <select
            name="deviceId"
            defaultValue={initial?.deviceId ?? (shared ? "" : allowed[0]?.id)}
            required={!shared || kind !== "threshold"}
          >
            {shared && kind === "threshold" && (
              <option value="">All permitted devices</option>
            )}
            {allowed.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Severity">
          <select name="severity" defaultValue={config?.severity ?? "warning"}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>
      {kind === "threshold" && (
        <div className="field-row">
          <Field
            label="Threshold data quality"
            hint="Estimated totals are a separate source and are never added to measured totals."
          >
            <select name="quality" defaultValue={config?.quality ?? "measured"}>
              <option value="measured">Measured only</option>
              <option value="estimated">Estimated only</option>
            </select>
          </Field>
          <Field label="Rule metric">
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {Object.entries(metrics).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {shared && (
            <Field label="Rule network label">
              <select name="networkId" defaultValue={initial?.networkId ?? ""}>
                <option value="">All labels</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {metric === "application_foreground_seconds" && (
            <Field label="Rule application identifier">
              <input
                name="applicationId"
                required
                maxLength={255}
                defaultValue={config?.applicationId}
              />
            </Field>
          )}
        </div>
      )}
      <div className="field-row">
        {kind !== "permission_revoked" && (
          <Field
            label={
              ["device_offline", "not_reporting"].includes(kind)
                ? "Reporting/heartbeat threshold (seconds)"
                : `Threshold (${metric.endsWith("_bytes") ? "bytes" : "seconds"})`
            }
            hint={
              ["device_offline", "not_reporting"].includes(kind)
                ? "60–604800 seconds."
                : "Only the selected data quality triggers this threshold."
            }
          >
            <input
              name="threshold"
              type="number"
              required
              min={
                ["device_offline", "not_reporting"].includes(kind)
                  ? 60
                  : 0.000001
              }
              max={
                ["device_offline", "not_reporting"].includes(kind)
                  ? 604800
                  : 9007199254
              }
              step={
                ["device_offline", "not_reporting"].includes(kind)
                  ? 1
                  : 0.000001
              }
              defaultValue={
                config?.threshold ??
                (["device_offline", "not_reporting"].includes(kind)
                  ? 600
                  : 104857600)
              }
            />
          </Field>
        )}
        <Field label="Rule period">
          <select name="period" defaultValue={config?.period ?? "day"}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </Field>
      </div>
      <fieldset>
        <legend>Delivery channels</legend>
        {[
          ["in_app", "In-app"],
          ["email", "Email (delivery disabled)"],
          ["android_push", "Android push (unavailable)"],
          ["ios_push", "iOS push (unavailable)"],
        ].map(([value, label]) => (
          <label className="check" key={value}>
            <input
              type="checkbox"
              name="channels"
              value={value}
              defaultChecked={
                config ? config.channels.includes(value) : value === "in_app"
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={config?.enabled ?? true}
        />
        Enable this rule
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={quiet}
          onChange={(e) => setQuiet(e.target.checked)}
        />
        Use quiet hours
      </label>
      {quiet && (
        <div className="field-row">
          <Field label="Quiet hours start">
            <input
              type="time"
              name="quietStart"
              required
              defaultValue={config?.quietHours?.start ?? "22:00"}
            />
          </Field>
          <Field label="Quiet hours end">
            <input
              type="time"
              name="quietEnd"
              required
              defaultValue={config?.quietHours?.end ?? "08:00"}
            />
          </Field>
          <Field label="Quiet hours timezone">
            <input
              name="quietTimezone"
              required
              defaultValue={
                config?.quietHours?.timezone ?? context.workspace.timezone
              }
            />
          </Field>
        </div>
      )}
      {initial && (
        <label className="check">
          <input type="checkbox" required />I understand that editing removes
          this rule’s previous alert and delivery history.
        </label>
      )}
    </Form>
  );
}
