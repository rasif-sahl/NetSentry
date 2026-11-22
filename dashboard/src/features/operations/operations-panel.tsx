"use client";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import {
  ActionForm,
  ActionButton,
  Card,
  Field,
  PasswordField,
  Notice,
  ErrorNotice,
  Loading,
  Empty,
  formatTime,
  text,
} from "@/shared/ui/common";
type Access = {
  role: string;
  workspaceIds: string[];
  globalAccounts: boolean;
  globalCatalog: boolean;
  expiresAt: string;
};
type View = {
  workspaces: { id: string; name: string; type: string }[];
  health: {
    workspaceId: string;
    agents: number;
    staleAgents: number;
    failedJobs: number;
    failedDeliveries: number;
  }[];
  versions: {
    workspaceId: string;
    platform: string;
    version: string;
    state: string;
    count: number;
  }[];
  subscriptions: { workspaceId: string; plan: string; status: string }[];
  flags: { scope: string; key: string; enabled: boolean; revision: number }[];
  compatibility: {
    key: string;
    kind: string;
    label: string;
    status: string;
    evidence: string;
    revision: number;
    checkedAt: string;
  }[];
  audit: {
    id: string;
    action: string;
    occurredAt: string;
    workspaceId: string | null;
  }[];
  notice: string;
};
export function OperationsPanel() {
  const access = useResource<Access>("/operations/access", true),
    view = useResource<View>(access.data ? "/operations" : null, true);
  const users = useResource<
    { id: string; displayName: string; status: string }[]
  >(
    access.data?.globalAccounts && access.data.role === "ADMIN"
      ? "/operations/users"
      : null,
  );
  if (access.loading || view.loading) return <Loading />;
  if (access.error)
    return (
      <>
        <Notice>
          Workspace ownership does not grant platform-operator access. Grants
          are explicitly scoped and expire.
        </Notice>
        <ErrorNotice error={access.error} />
      </>
    );
  if (view.error) return <ErrorNotice error={view.error} />;
  if (!view.data || !access.data)
    return <Empty title="Operator data unavailable" />;
  const data = view.data,
    g = access.data;
  async function mutate(path: string, body: unknown) {
    await api("/operations" + path, "POST", body);
    view.reload();
    users.reload();
  }
  async function diagnostics(id: string) {
    const value = await api(`/operations/workspaces/${id}/diagnostics`);
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "netsentry-redacted-diagnostics.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <div className="stack">
      <Card title="Platform operations">
        <Notice>{data.notice}</Notice>
        <p>
          {g.role} · grant expires {formatTime(g.expiresAt)}
        </p>
        {data.workspaces.map((w) => (
          <div className="row" key={w.id}>
            <strong>
              {w.name} · {w.type}
            </strong>
            {data.health
              .filter((h) => h.workspaceId === w.id)
              .map((h) => (
                <p key={h.workspaceId}>
                  {h.agents} agents · {h.staleAgents} stale/missing contacts ·{" "}
                  {h.failedJobs} failed jobs · {h.failedDeliveries} failed
                  deliveries
                </p>
              ))}
            <ActionButton action={() => diagnostics(w.id)}>
              Export redacted diagnostics
            </ActionButton>
          </div>
        ))}
      </Card>
      <Card title="Agent version health">
        {data.versions.map((v, i) => (
          <p key={i}>
            {v.workspaceId} · {v.platform} · {v.version ?? "Unreported"} ·{" "}
            {v.state} · {v.count}
          </p>
        ))}
      </Card>
      <Card title="Scoped subscription administration">
        {data.subscriptions.map((s) => (
          <p key={s.workspaceId}>
            {s.workspaceId} · {s.plan} · {s.status}
          </p>
        ))}
        <p>
          Paid entitlement changes require authenticated billing events;
          operator roles do not fabricate live payment.
        </p>
      </Card>
      {g.role === "ADMIN" && (
        <Card title="Feature configuration">
          <p>
            Disabling a feature blocks future cloud actions. Enabling it cannot
            grant roles, consent, paid entitlements or OS authorization.
          </p>
          <ActionForm
            submit="Save feature setting"
            reset
            action={async (f) => {
              const wid = text(f, "workspace"),
                key = text(f, "key"),
                scope = text(f, "scope");
              const old = data.flags.find(
                (r) =>
                  r.scope === (scope === "global" ? "global" : wid) &&
                  r.key === key,
              );
              await mutate("/flags", {
                scope,
                workspaceId: wid,
                key,
                enabled: f.has("enabled"),
                expectedRevision: old?.revision ?? 0,
                password: String(f.get("password") ?? ""),
              });
            }}
          >
            <Field label="Feature scope">
              <select name="scope">
                <option value="workspace">Scoped workspace</option>
                {g.globalCatalog && (
                  <option value="global">Global feature setting</option>
                )}
              </select>
            </Field>
            <Field label="Workspace for setting">
              <select name="workspace" required>
                {data.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Feature key">
              <select name="key">
                {[
                  "network",
                  "developer",
                  "advanced_apps",
                  "family",
                  "business",
                ].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <label>
              <input name="enabled" type="checkbox" /> Enable subject to all
              other gates
            </label>
            <Password />
          </ActionForm>
          <ul>
            {data.flags.map((f) => (
              <li key={f.scope + f.key}>
                {f.scope} · {f.key} · {f.enabled ? "Enabled" : "Disabled"} ·
                revision {f.revision}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {g.role === "ADMIN" && g.globalCatalog && (
        <Card title="Compatibility and category records">
          <p>
            Records document operator evidence. They do not enable a router
            adapter, certify hardware or change application classification
            automatically. Do not include secrets.
          </p>
          <ActionForm
            submit="Save compatibility evidence"
            reset
            action={async (f) => {
              const key = text(f, "key");
              await mutate("/compatibility", {
                key,
                kind: text(f, "kind"),
                label: text(f, "label"),
                status: text(f, "status"),
                evidence: text(f, "evidence"),
                expectedRevision:
                  data.compatibility.find((c) => c.key === key)?.revision ?? 0,
                password: String(f.get("password") ?? ""),
              });
            }}
          >
            <Field label="Compatibility key">
              <input name="key" required pattern="[a-z0-9][a-z0-9_.-]{1,79}" />
            </Field>
            <Field label="Record kind">
              <select name="kind">
                {["router", "device", "agent", "category"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="Record label">
              <input name="label" required maxLength={100} />
            </Field>
            <Field label="Evidence status">
              <select name="status">
                {["unverified", "candidate", "verified", "unsupported"].map(
                  (k) => (
                    <option key={k}>{k}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Evidence and limitations">
              <input name="evidence" required maxLength={500} />
            </Field>
            <Password />
          </ActionForm>
        </Card>
      )}
      <Card title="Compatibility evidence">
        {data.compatibility.map((c) => (
          <p key={c.key}>
            {c.label} · {c.kind} · {c.status} · {c.evidence} ·{" "}
            {formatTime(c.checkedAt)}
          </p>
        ))}
      </Card>
      {g.role === "ADMIN" && g.globalAccounts && (
        <Card title="Account administration">
          <Notice>
            Suspension revokes sessions and rejects subsequent authenticated
            account/device/agent calls. It does not erase data or recall an
            offline action.
          </Notice>
          {users.data?.map((u) => (
            <ActionForm
              key={u.id + u.status}
              submit="Update account status"
              reset
              action={async (f) => {
                if (
                  !window.confirm(`Change account status for ${u.displayName}?`)
                )
                  return "No change made.";
                await mutate(`/users/${u.id}/status`, {
                  status: text(f, "status"),
                  password: String(f.get("password") ?? ""),
                });
              }}
            >
              <p>
                {u.displayName} · {u.status}
              </p>
              <Field label={`Status for ${u.displayName}`}>
                <select name="status" defaultValue={u.status}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </Field>
              <Password />
            </ActionForm>
          ))}
        </Card>
      )}
      <Card title="Operator audit review">
        {data.audit.map((a) => (
          <p key={a.id}>
            {formatTime(a.occurredAt)} · {a.action.replaceAll("_", " ")} ·{" "}
            {a.workspaceId ?? "Operator scope"}
          </p>
        ))}
      </Card>
    </div>
  );
}
function Password() {
  return (
    <PasswordField
      label="Confirm operator password"
      name="password"
      autoComplete="current-password"
      required
      maxLength={128}
    />
  );
}
