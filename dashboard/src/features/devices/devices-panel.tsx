"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { DeviceEvent, Disclosures } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
  ActionForm,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Notice,
  formatTime,
  text,
} from "@/shared/ui/common";
export function DevicesPanel({
  user,
  devices,
  permissions,
  reloadDevices,
}: PageContext) {
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const filtered = devices.filter((d) =>
    `${d.name} ${d.platform}`.toLowerCase().includes(search.toLowerCase()),
  );
  const device = devices.find((d) => d.id === selected) ?? devices[0];
  const owner = device?.registeredById === user.id;
  const canManage = owner || permissions.includes("devices:manage");
  const disclosures = useResource<Disclosures>("/privacy/disclosures");
  const history = useResource<DeviceEvent[]>(
    device && canManage ? `/devices/${device.id}/history` : null,
  );
  async function change(action: string, method = "POST") {
    await api(`/devices/${device!.id}${action}`, method, {});
    reloadDevices();
    history.reload();
  }
  return (
    <>
      <Card title="Device inventory">
        <Field label="Find a device">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or platform"
          />
        </Field>
        {filtered.length ? (
          <ul className="item-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {item.platform} · {item.state.toLowerCase()} · last reported{" "}
                    {formatTime(item.lastSeenAt)}
                  </small>
                </div>
                <span className="badge">
                  {item.monitoringEnabled
                    ? "Consent enabled"
                    : "Monitoring paused"}
                </span>
                <button
                  className="button"
                  onClick={() => setSelected(item.id)}
                  aria-pressed={device?.id === item.id}
                >
                  View {item.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title={
              devices.length ? "No matching devices" : "No registered devices"
            }
          >
            Pair an installation through a supported native client. Browser
            access does not enroll or certify this computer.
          </Empty>
        )}
      </Card>
      {device && (
        <Card title={device.name} key={device.id}>
          <p>
            Reported device information. Consent, OS permission and collector
            availability are separate checks.
          </p>
          <dl className="details-grid">
            {Object.entries({
              Platform: device.platform,
              State: device.state,
              Permission: device.permissionStatus,
              "Monitoring health": device.monitoringHealth,
              "Consent scopes": device.consentScopes.join(", ") || "None",
              "OS version": device.operatingSystemVersion ?? "Not reported",
              "Application version":
                device.applicationVersion ?? "Not reported",
              "Battery setup": device.batteryOptimizationStatus,
              "Last device report": formatTime(device.lastSeenAt),
              "Last synchronization": formatTime(device.lastSyncedAt),
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {canManage && (
            <details>
              <summary>Rename this device</summary>
              <ActionForm
                action={async (form) => {
                  await api(`/devices/${device.id}`, "PATCH", {
                    name: text(form, "name"),
                  });
                  reloadDevices();
                }}
                submit="Rename device"
              >
                <Field label="Device name">
                  <input
                    name="name"
                    defaultValue={device.name}
                    required
                    maxLength={100}
                  />
                </Field>
              </ActionForm>
            </details>
          )}
          <h3>Reported capabilities</h3>
          {device.capabilityReport?.capabilities.length ? (
            <div className="table-scroll">
              <table>
                <caption>
                  Reported {formatTime(device.capabilityReport.reportedAt)}. A
                  capability declaration does not grant permission.
                </caption>
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>Status / reason</th>
                    <th>Source / checked</th>
                    <th>Required setup</th>
                  </tr>
                </thead>
                <tbody>
                  {device.capabilityReport.capabilities.map((capability) => (
                    <tr key={capability.id}>
                      <td>{capability.id}</td>
                      <td>
                        <span className="badge">
                          {capability.status.replaceAll("_", " ")}
                        </span>
                        <small>{capability.reason}</small>
                      </td>
                      <td>
                        {capability.source}
                        <small>{formatTime(capability.checkedAt)}</small>
                      </td>
                      <td>
                        {capability.requiredSetup.join(", ") || "None reported"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No capability report">
              Supported collection has not been established for this
              installation.
            </Empty>
          )}
          {owner && device.state === "ACTIVE" && (
            <details>
              <summary>Review monitoring consent</summary>
              <ErrorNotice error={disclosures.error} />
              {disclosures.data && (
                <ActionForm
                  key={disclosures.data.monitoring.version}
                  submit="Grant selected consent"
                  action={async (form) => {
                    const scopes = form.getAll("scopes").map(String);
                    if (!scopes.length)
                      throw new Error("Select at least one scope.");
                    await api(`/devices/${device.id}/consent`, "POST", {
                      accepted: true,
                      disclosureVersion: disclosures.data!.monitoring.version,
                      scopes,
                    });
                    reloadDevices();
                    history.reload();
                    return "Consent recorded. Data remains unavailable until a supported collector reports it.";
                  }}
                >
                  <Notice>{disclosures.data.monitoring.text}</Notice>
                  <small>
                    Disclosure {disclosures.data.monitoring.version}
                  </small>
                  <label className="check">
                    <input
                      name="scopes"
                      type="checkbox"
                      value="network_usage"
                      defaultChecked={device.consentScopes.includes(
                        "network_usage",
                      )}
                    />
                    Network usage
                  </label>
                  <label className="check">
                    <input
                      name="scopes"
                      type="checkbox"
                      value="app_usage"
                      defaultChecked={device.consentScopes.includes(
                        "app_usage",
                      )}
                    />
                    Application usage
                  </label>
                  <label className="check">
                    <input type="checkbox" required />I understand and accept
                    this monitoring disclosure.
                  </label>
                </ActionForm>
              )}
            </details>
          )}
          {canManage && (
            <div className="button-row">
              <ActionButton
                disabled={!device.monitoringEnabled}
                action={() => change("/pause")}
              >
                Pause monitoring
              </ActionButton>
              {owner && (
                <ActionButton
                  action={() => change("/consent", "DELETE")}
                  confirm="Revoke monitoring consent for this device? Collection will stop and scopes will be cleared."
                >
                  Revoke consent
                </ActionButton>
              )}
              <ActionButton
                action={() => change("/unenrol")}
                confirm="Unenrol this device and revoke its installation credential? Fresh pairing will be required."
              >
                Unenrol device
              </ActionButton>
              {owner && (
                <ActionButton
                  className="button danger"
                  action={() => change("/data", "DELETE")}
                  confirm="Delete all monitoring data and derived alerts for this device? The credential will be revoked. This cannot be undone."
                >
                  Delete device data
                </ActionButton>
              )}
              <ActionButton
                className="button danger"
                action={() => change("", "DELETE")}
                confirm="Remove this device and its monitoring data? This cannot be undone."
              >
                Remove device
              </ActionButton>
            </div>
          )}
          {canManage && (
            <details>
              <summary>Permission and consent history</summary>
              <ErrorNotice error={history.error} />
              {history.data?.length ? (
                <ul className="item-list">
                  {history.data.map((event) => (
                    <li key={event.id}>
                      <div>
                        <strong>{event.kind.replaceAll("_", " ")}</strong>
                        <small>{formatTime(event.createdAt)}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No history available.</p>
              )}
            </details>
          )}
          {!canManage && (
            <Notice>
              You can read inventory. Consent and management actions require the
              device owner or an authorized manager.
            </Notice>
          )}
        </Card>
      )}
    </>
  );
}
