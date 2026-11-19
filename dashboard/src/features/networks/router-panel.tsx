"use client";
import { api } from "@/shared/api";
import {
  ActionButton,
  ActionForm,
  Card,
  Empty,
  Field,
  formatTime,
  text,
} from "@/shared/ui/common";
import { NetworkConsent, networkConsent } from "./network-consent";
import type { NetworkView } from "./types";

export function RouterPanel({
  view,
  path,
  canManage,
  reload,
}: {
  view: Pick<
    NetworkView,
    | "router"
    | "routerHealth"
    | "wanUp"
    | "reportedAt"
    | "collectors"
    | "bandwidth"
  >;
  path: string;
  canManage: boolean;
  reload: () => void;
}) {
  return (
    <Card title="Router and WAN">
      <p>
        Router API: <strong>{view.routerHealth}</strong> · WAN interface:{" "}
        {view.wanUp === null ? "unknown" : view.wanUp ? "up" : "down"} ·
        captured {formatTime(view.reportedAt)}
      </p>
      <p>
        WAN interface state does not prove internet reachability. Traffic is
        router-wide; per-device bandwidth and blocking are unavailable.
      </p>
      {view.router ? (
        <>
          <p>
            {view.router.adapter} · {view.router.url} · credential{" "}
            {view.router.credentialConfigured ? "configured" : "missing"}
          </p>
          <p>
            Operator model/firmware: {view.router.model || "unknown"} /{" "}
            {view.router.firmware || "unknown"}. Reported:{" "}
            {view.router.reportedModel || "unknown"} /{" "}
            {view.router.reportedFirmware || "unknown"}.
          </p>
          <p>
            Connection test: <strong>{view.router.testStatus}</strong>. Queuing
            a test is not a successful connection.
          </p>
          {canManage && (
            <>
              <ActionButton
                action={async () => {
                  await api(`${path}/router/test`, "POST");
                  reload();
                }}
              >
                Request connection test
              </ActionButton>
              <ActionButton
                confirm="Remove router credentials and its counter history?"
                action={async () => {
                  await api(`${path}/router`, "DELETE");
                  reload();
                }}
              >
                Remove router connection
              </ActionButton>
            </>
          )}
        </>
      ) : (
        <Empty title="No router connection" />
      )}
      {canManage && (
        <details>
          <summary>Configure read-only OpenWrt ubus connection</summary>
          <p>
            Requires verified HTTPS, a literal private IPv4 /ubus URL, and a
            dedicated router account with only session login/destroy, system
            board, WAN status and network device status access. Self-signed
            deployments need their CA certificate. Hardware/firmware validation
            is pending.
          </p>
          <ActionForm
            submit="Save encrypted router credentials"
            reset
            action={async (f) => {
              await api(`${path}/router`, "POST", {
                agentId: text(f, "agentId"),
                adapter: "openwrt-ubus-v1",
                url: text(f, "url"),
                interfaceName: text(f, "interfaceName"),
                caCertificate: text(f, "caCertificate"),
                username: text(f, "username"),
                password: String(f.get("password") ?? ""),
                manufacturer: text(f, "manufacturer"),
                model: text(f, "model"),
                firmware: text(f, "firmware"),
                ...networkConsent,
              });
              reload();
              return "Credentials encrypted and assigned to one collector. Request a connection test after local sharing is enabled.";
            }}
          >
            <Field label="Assigned router collector">
              <select name="agentId" required>
                <option value="">Choose collector</option>
                {view.collectors
                  .filter((c) => c.enabled)
                  .map((c) => (
                    <option key={c.agentId} value={c.agentId}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="HTTPS router API URL">
              <input
                type="url"
                name="url"
                placeholder="https://192.168.1.1/ubus"
                required
              />
            </Field>
            <Field label="Logical WAN interface">
              <input
                name="interfaceName"
                defaultValue="wan"
                pattern="[a-zA-Z0-9_]{1,32}"
                required
              />
            </Field>
            <Field label="Router username">
              <input
                name="username"
                required
                maxLength={100}
                autoComplete="off"
              />
            </Field>
            <Field label="Router password">
              <input
                name="password"
                type="password"
                required
                maxLength={256}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Optional trusted PEM CA certificate">
              <textarea name="caCertificate" maxLength={8192} />
            </Field>
            {["manufacturer", "model", "firmware"].map((n) => (
              <Field key={n} label={`Operator ${n}`}>
                <input name={n} maxLength={100} />
              </Field>
            ))}
            <NetworkConsent />
          </ActionForm>
        </details>
      )}
      <p>
        Last 24 hours, whole confirmed intervals: received{" "}
        <strong>{view.bandwidth.receivedBytes}</strong> bytes · sent{" "}
        <strong>{view.bandwidth.sentBytes}</strong> bytes.
      </p>
      <p>
        Coverage {Math.round(view.bandwidth.coverageMs / 1000)} seconds ·
        missing {Math.round(view.bandwidth.missingMs / 1000)} seconds. Peak
        among latest 60 samples:{" "}
        {view.bandwidth.peakRecentBitsPerSecond === null
          ? "unavailable"
          : `${Math.round(view.bandwidth.peakRecentBitsPerSecond)} bit/s`}
        .
      </p>
      <details>
        <summary>Traffic history and sample quality</summary>
        <p>
          Hourly buckets use interval end time. Baselines, resets and gaps
          create no usage.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hour</th>
                <th>Received bytes</th>
                <th>Sent bytes</th>
                <th>Unavailable/baseline samples</th>
              </tr>
            </thead>
            <tbody>
              {view.bandwidth.history.map((h) => (
                <tr key={h.at}>
                  <td>{formatTime(h.at)}</td>
                  <td>{h.rx}</td>
                  <td>{h.tx}</td>
                  <td>{h.gaps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul>
          {view.bandwidth.samples.slice(0, 10).map((s) => (
            <li key={s.id}>
              {formatTime(s.observedAt)} · {s.quality} · RX{" "}
              {s.rxDelta ?? "unknown"} / TX {s.txDelta ?? "unknown"} bytes
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
