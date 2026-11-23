"use client";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { NetworkMonitoring } from "./network-monitoring";
import { NetworkDetail } from "./network-detail";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { UsageNetwork } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import {
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  text,
} from "@/shared/ui/common";
export function NetworksPanel({
  workspace,
  user,
  devices,
  permissions,
  reloadDevices,
  tab,
  networkId,
}: PageContext & { tab: string; networkId?: string }) {
  const path = `/workspaces/${workspace.id}/monitoring`;
  const networks = useResource<UsageNetwork[]>(
    tab === "labels" ? `${path}/networks` : null,
    true,
  );
  const ownDevices = devices.filter(
    (d) => d.registeredById === user.id && d.state === "ACTIVE",
  );
  if (tab === "monitoring") {
    const context = { workspace, user, devices, permissions, reloadDevices };
    return networkId ? (
      <NetworkDetail key={networkId} context={context} networkId={networkId} />
    ) : (
      <NetworkMonitoring {...context} />
    );
  }
  return (
    <>
      {tab === "labels" && (
        <>
          <Notice>
            Manual labels below remain available independently of network
            collection.
          </Notice>
          <Card title="Network labels">
            <ErrorNotice error={networks.error} />
            {networks.loading && <Loading />}
            {networks.data?.length ? (
              <ul className="item-list">
                {networks.data.map((network) => (
                  <li key={network.id}>
                    <strong>{network.name}</strong>
                    <span className="badge">Manual label</span>
                  </li>
                ))}
              </ul>
            ) : (
              networks.data && <Empty title="No network labels yet" />
            )}
            {permissions.includes("networks:manage") && (
              <ActionFormDialog
                submit="Create network label"
                primary
                action={async (form) => {
                  await api(`${path}/networks`, "POST", {
                    name: text(form, "name"),
                  });
                  networks.reload();
                  return "Network label created.";
                }}
              >
                <Field label="Network label name">
                  <input name="name" required maxLength={100} />
                </Field>
              </ActionFormDialog>
            )}
          </Card>
          {permissions.includes("devices:register") && (
            <Card title="Assign your device to a label">
              {!ownDevices.length || !networks.data?.length ? (
                <Empty title="A paired device and network label are needed" />
              ) : (
                <ActionFormDialog
                  label="Assign network label"
                  submit="Assign label and pause monitoring"
                  action={async (form) => {
                    await api(`${path}/network-assignment`, "POST", {
                      deviceId: text(form, "deviceId"),
                      networkId: text(form, "networkId"),
                    });
                    reloadDevices();
                    return "Label assigned. Monitoring is paused; review device consent before resuming.";
                  }}
                >
                  <Field label="Your device">
                    <select name="deviceId">
                      {ownDevices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Network label">
                    <select name="networkId">
                      {networks.data.map((network) => (
                        <option key={network.id} value={network.id}>
                          {network.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <label className="check">
                    <input type="checkbox" required />I understand this pauses
                    monitoring and requires renewed consent.
                  </label>
                </ActionFormDialog>
              )}
            </Card>
          )}
        </>
      )}
    </>
  );
}
