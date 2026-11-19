"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
  ActionForm,
  Card,
  Field,
  Notice,
  Empty,
  Loading,
  ErrorNotice,
  formatTime,
  text,
} from "@/shared/ui/common";
type Entitlements = {
  edition: string;
  status: string;
  mode: string;
  enforced: boolean;
  revision: number;
  periodEnd: string | null;
  trialEndsAt: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
  limits: Record<string, unknown>;
  features: Record<string, boolean>;
};
type View = {
  entitlements: Entitlements;
  catalog: Record<
    string,
    {
      label: string;
      workspaceTypes: string[];
      devices: number;
      members: number;
      networks: number;
      rawDays: number;
      aggregateDays: number;
    }
  >;
  usage: Record<string, number>;
  payments: {
    id: string;
    amountMinor: string;
    currency: string;
    status: string;
    paidAt: string;
    provider: string;
  }[];
  requests: {
    id: string;
    requestId: string;
    status: string;
    plan: string;
    interval: string;
    createdAt: string;
  }[];
  notice: string;
};
export function BillingPanel({ workspace, permissions }: PageContext) {
  const base = `/workspaces/${workspace.id}/billing`,
    owner = permissions.includes("billing:manage");
  const state = useResource<View>(owner ? base : null, true),
    access = useResource<Entitlements>(
      owner ? null : base + "/entitlements",
      true,
    );
  const [requestId, setRequestId] = useState("");
  const current = state.data?.entitlements ?? access.data;
  async function action(path: string, body: unknown) {
    await api(base + path, "POST", body);
    state.reload();
    access.reload();
  }
  if (state.loading || access.loading) return <Loading />;
  if (state.error || access.error)
    return <ErrorNotice error={state.error ?? access.error} />;
  if (!current) return <Empty title="Subscription unavailable" />;
  return (
    <div className="stack">
      <Card title="Subscription and editions">
        <Notice>
          {current.mode === "sandbox"
            ? "Provider-neutral sandbox: no real charge, external billing provider or native purchase is connected."
            : "Live billing is unconfigured. Subscription purchases are unavailable."}
        </Notice>
        <p>
          Edition: {current.edition} · status: {current.status} · revision{" "}
          {current.revision}
        </p>
        <p>
          {current.enforced
            ? "Edition limits are enforced alongside existing permissions."
            : "Pre-release evaluation: commercial limits are not enforced. Feature configuration and all permissions still apply."}
        </p>
        <p>
          Period ends {formatTime(current.periodEnd)} · trial ends{" "}
          {formatTime(current.trialEndsAt)} · grace ends{" "}
          {formatTime(current.graceUntil)}
        </p>
        <ul>
          {Object.entries(current.features).map(([key, value]) => (
            <li key={key}>
              {key.replaceAll("_", " ")}:{" "}
              {value
                ? "Available subject to permission, consent and platform support"
                : "Unavailable"}
            </li>
          ))}
        </ul>
      </Card>
      {state.data && (
        <>
          <Card title="Usage and capacity">
            <p>
              Current allocation counts, not measured traffic or time.
              Downgrades do not erase existing data.
            </p>
            {Object.entries(state.data.usage).map(([name, count]) => (
              <p key={name}>
                {name}: {count} /{" "}
                {String(current.limits[name] ?? "Unavailable")}
              </p>
            ))}
            <p>
              Retention setting limits: {String(current.limits.rawDays)} raw
              days / {String(current.limits.aggregateDays)} aggregate days.
              Existing retention is not shortened automatically.
            </p>
          </Card>
          <Card title="Sandbox billing portal">
            <Notice>{state.data.notice}</Notice>
            {current.mode === "sandbox" && (
              <>
                <ActionForm
                  key={current.revision}
                  submit="Prepare sandbox plan change"
                  action={async (f) => {
                    const id = crypto.randomUUID();
                    await action("/checkout", {
                      requestId: id,
                      expectedRevision: current.revision,
                      plan: text(f, "plan"),
                      interval: text(f, "interval"),
                    });
                    setRequestId(id);
                    return "Request prepared. Review it, then explicitly simulate payment.";
                  }}
                >
                  <Field label="Edition">
                    <select name="plan">
                      {Object.entries(state.data.catalog)
                        .filter(
                          ([key, p]) =>
                            key !== "free" &&
                            p.workspaceTypes.includes(workspace.type),
                        )
                        .map(([key, p]) => (
                          <option key={key} value={key}>
                            {p.label}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Billing interval">
                    <select name="interval">
                      <option value="monthly">Monthly sandbox period</option>
                      <option value="annual">Annual sandbox period</option>
                    </select>
                  </Field>
                </ActionForm>
                {requestId && (
                  <ActionButton
                    confirm="Simulate a successful sandbox payment? No money will move."
                    action={async () => {
                      await action("/sandbox/confirm", { requestId });
                      setRequestId("");
                    }}
                  >
                    Simulate sandbox payment
                  </ActionButton>
                )}
                <ActionButton
                  confirm="Start a one-time, 14-day sandbox trial? No payment method or future automatic charge is created."
                  action={async () => {
                    await action("/trial", {
                      requestId: crypto.randomUUID(),
                      expectedRevision: current.revision,
                      plan:
                        workspace.type === "BUSINESS"
                          ? "business"
                          : workspace.type === "FAMILY"
                            ? "family"
                            : "premium",
                      interval: "monthly",
                    });
                  }}
                >
                  Start sandbox trial
                </ActionButton>
                <ActionButton
                  confirm="Schedule cancellation at the current period end? No data is deleted."
                  action={async () => {
                    await action("/cancel", {
                      expectedRevision: current.revision,
                    });
                  }}
                >
                  Cancel at period end
                </ActionButton>
                {current.cancelAtPeriodEnd && (
                  <ActionButton
                    confirm="Resume this sandbox subscription?"
                    action={async () => {
                      await action("/resume", {
                        expectedRevision: current.revision,
                      });
                    }}
                  >
                    Resume sandbox subscription
                  </ActionButton>
                )}
                <p>Pending requests</p>
                {state.data.requests
                  .filter((r) => r.status === "pending")
                  .map((r) => (
                    <div className="row" key={r.id}>
                      <p>
                        {r.plan} · {r.interval} · prepared{" "}
                        {formatTime(r.createdAt)}
                      </p>
                      <ActionButton
                        confirm="Confirm this reviewed sandbox request? No real charge occurs."
                        action={async () => {
                          await action("/sandbox/confirm", {
                            requestId: r.requestId,
                          });
                        }}
                      >
                        Confirm prepared sandbox request
                      </ActionButton>
                    </div>
                  ))}
              </>
            )}
          </Card>
          <Card title="Sandbox payment history">
            {state.data.payments.length === 0 ? (
              <Empty title="No sandbox payments recorded" />
            ) : (
              state.data.payments.map((p) => (
                <p key={p.id}>
                  {formatTime(p.paidAt)} · {p.amountMinor} {p.currency} test
                  minor units · {p.status} · {p.provider}
                </p>
              ))
            )}
            <p>
              No card details, real invoices, taxes or offered prices are
              represented.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
