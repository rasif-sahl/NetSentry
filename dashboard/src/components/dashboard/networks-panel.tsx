"use client";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { UsageNetwork } from "@/lib/types";
import type { PageContext } from "./dashboard-shell";
import {
  ActionForm,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  text,
} from "../ui/common";
export function NetworksPanel({
  workspace,
  user,
  devices,
  permissions,
  reloadDevices,
}: PageContext) {
  const path = `/workspaces/${workspace.id}/monitoring`;
  const networks = useResource<UsageNetwork[]>(`${path}/networks`, true);
  const ownDevices = devices.filter(
    (d) => d.registeredById === user.id && d.state === "ACTIVE",
  );
  return (
    <>
      <Notice>
        These are manual workspace labels. Discovery, router traffic and
        verified network presence are planned for the network-agent phase.
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
          <ActionForm
            submit="Create network label"
            reset
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
          </ActionForm>
        )}
      </Card>
      {permissions.includes("devices:register") && (
        <Card title="Assign your device to a label">
          {!ownDevices.length || !networks.data?.length ? (
            <Empty title="A paired device and network label are needed" />
          ) : (
            <ActionForm
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
            </ActionForm>
          )}
        </Card>
      )}
    </>
  );
}
