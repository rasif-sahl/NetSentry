"use client";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Member, UsageNetwork } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import { familyConsent, FamilyConsent } from "./family-consent";
import { PolicyForm } from "./policy-form";
import { ProfileForm } from "./profile-form";
import type { FamilyView } from "./types";
import {
  ActionButton,
  Card,
  Field,
  Empty,
  ErrorNotice,
  Loading,
  formatTime,
  text,
} from "@/shared/ui/common";

const avatarSymbols: Record<string, string> = {
  star: "⭐",
  leaf: "🌿",
  fox: "🦊",
  owl: "🦉",
  rocket: "🚀",
  sun: "☀️",
};
export function ChildPanel({
  context,
  path,
  elevated,
  members,
  networks,
  reloadFamily,
}: {
  context: PageContext;
  path: string;
  elevated: boolean;
  members: Member[];
  networks: UsageNetwork[];
  reloadFamily: () => void;
}) {
  const resource = useResource<FamilyView>(path, true),
    v = resource.data;
  const reload = () => {
    resource.reload();
    reloadFamily();
  };
  return (
    <>
      <ErrorNotice error={resource.error} />
      {resource.loading && <Loading />}
      {v && (
        <>
          <Card title={`${v.profile.name} · family overview`}>
            <p>
              Avatar:{" "}
              <span
                role="img"
                aria-label={`${v.profile.avatar} avatar`}
                style={{ fontSize: "2rem" }}
              >
                {avatarSymbols[v.profile.avatar] ?? "⭐"}
              </span>{" "}
              · age band: {v.profile.ageBand} ·{" "}
              {v.profile.archived ? "archived" : "active"}
            </p>
            <button className="button" onClick={resource.reload}>
              Refresh child profile
            </button>
            <p>
              Policy intent:{" "}
              <strong>{v.desired.state.replaceAll("_", " ")}</strong>. Revision{" "}
              {v.policy?.revision ?? 0} · timezone{" "}
              {v.policy?.timezone ?? context.workspace.timezone}.
            </p>
            <p>
              Reasons: {v.desired.reasons.join(", ") || "none observed"}.
              Warnings: {v.desired.warnings.join(", ") || "none observed"}.
            </p>
            {v.overrideUntil && (
              <p>
                Approved exception until {formatTime(v.overrideUntil)}. This
                does not confirm any device change.
              </p>
            )}
            <ul className="item-list">
              {v.devices.map((d) => (
                <li key={d.deviceId}>
                  <strong>{d.name}</strong> · {d.platform} · device report:{" "}
                  {d.enforcement}
                  <p>
                    Sharing accepted {formatTime(d.consentedAt)} · receipt{" "}
                    {formatTime(d.receivedAt)}
                  </p>
                  <ActionButton
                    confirm="Withdraw family sharing for this device? Personal measurements remain separate."
                    action={async () => {
                      await api(`${path}/devices/${d.deviceId}`, "DELETE");
                      resource.reload();
                    }}
                  >
                    Withdraw family sharing
                  </ActionButton>
                </li>
              ))}
            </ul>
            {!v.devices.length && (
              <Empty title="No current consented devices">
                The device owner must accept sharing for the current profile
                revision and device generation.
              </Empty>
            )}
            <ActionFormDialog
              submit="Consent to sharing your device"
              action={async (f) => {
                await api(`${path}/devices`, "POST", {
                  deviceId: text(f, "deviceId"),
                  ...familyConsent,
                });
                resource.reload();
                return "Sharing accepted. Family reports start on the first full local day after consent; collection permissions remain separate.";
              }}
            >
              <Field label="Your active device">
                <select name="deviceId" required>
                  <option value="">Choose your device</option>
                  {context.devices
                    .filter(
                      (d) =>
                        d.registeredById === context.user.id &&
                        d.state === "ACTIVE",
                    )
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </Field>
              <FamilyConsent />
            </ActionFormDialog>
            {elevated && (
              <details>
                <summary>Edit profile, guardian grants or archive</summary>
                <ProfileForm
                  key={v.profile.revision}
                  profile={v.profile}
                  members={members}
                  networks={networks}
                  action={async (input) => {
                    await api(path, "PATCH", input);
                    reload();
                  }}
                />
                <ActionButton
                  confirm="Erase this child profile, policies, assignments, requests and family history? Personal device records remain."
                  action={async () => {
                    await api(path, "DELETE");
                    reloadFamily();
                  }}
                >
                  Erase child profile
                </ActionButton>
              </details>
            )}
          </Card>
          <Card title="Weekly wellbeing observations">
            <p>
              {v.report.from} through {v.report.to} ·{" "}
              {v.report.confidence.replaceAll("_", " ")}.
            </p>
            <p>
              Current seven days: {Math.round(v.report.currentWeekMinutes)}{" "}
              observed minutes. Previous seven days:{" "}
              {Math.round(v.report.previousWeekMinutes)} minutes. Comparable
              change:{" "}
              {v.report.comparisonPercent === null
                ? "unavailable"
                : `${Math.round(v.report.comparisonPercent)}%`}
              .
            </p>
            <p>
              Education: {Math.round(v.report.educationMinutes)} minutes ·
              entertainment: {Math.round(v.report.entertainmentMinutes)}{" "}
              minutes, based on available app categories.
            </p>
            <p>{v.report.evidence}</p>
            <details>
              <summary>Application and category trends</summary>
              <p>
                Observed minutes across consented devices; missing windows are
                unknown. These figures are descriptive, not wellbeing scores.
              </p>
              {(["applicationTrends", "categoryTrends"] as const).map(
                (kind) => (
                  <div className="table-scroll" key={kind}>
                    <h3>
                      {kind === "applicationTrends"
                        ? "Applications"
                        : "Categories"}
                    </h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Name or ID</th>
                          <th>Current seven days</th>
                          <th>Previous seven days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.report[kind].map((t) => (
                          <tr key={t.id}>
                            <td>{t.id}</td>
                            <td>{Math.round(t.currentMinutes)} min</td>
                            <td>{Math.round(t.previousMinutes)} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
              )}
            </details>
            <ul>
              {v.report.suggestions.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Local day</th>
                    <th>Observed minutes</th>
                    <th>Coverage minutes</th>
                    <th>Late-night app minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {v.report.days.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{Math.round(d.minutes)}</td>
                      <td>{Math.round(d.coverageMinutes)}</td>
                      <td>{Math.round(d.lateNightMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ActionFormDialog
              submit="Send insight feedback"
              action={async (f) => {
                await api(`${path}/feedback`, "POST", {
                  rating: text(f, "rating"),
                  note: text(f, "note"),
                });
                resource.reload();
                return "Feedback saved.";
              }}
            >
              <Field label="Insight feedback">
                <select name="rating">
                  <option value="helpful">Helpful</option>
                  <option value="not_helpful">Not helpful</option>
                  <option value="not_enough_data">Not enough data</option>
                </select>
              </Field>
              <Field label="Optional feedback note">
                <textarea name="note" maxLength={300} />
              </Field>
            </ActionFormDialog>
          </Card>
          {v.canManage && !v.profile.archived && (
            <Card title="Family policy">
              <PolicyForm
                key={v.policy?.revision ?? 0}
                initial={v.policy?.rules}
                ageBand={v.profile.ageBand}
                save={async (rules) => {
                  await api(`${path}/policy`, "POST", {
                    expectedRevision: v.policy?.revision ?? 0,
                    rules,
                    ...familyConsent,
                  });
                  resource.reload();
                }}
              />
            </Card>
          )}
          <Card title="Time requests and guardian decisions">
            {v.policy &&
              !v.profile.archived &&
              (v.canManage || v.canRequest) && (
                <TimeRequest
                  key={v.policy.revision}
                  direct={v.canManage}
                  send={async (input) => {
                    await api(
                      `${path}/${v.canManage ? "overrides" : "requests"}`,
                      "POST",
                      { ...input, policyRevision: v.policy!.revision },
                    );
                    resource.reload();
                  }}
                />
              )}
            <ul className="item-list">
              {v.requests.map((r) => (
                <li key={r.id}>
                  <strong>{r.reason}</strong> · {r.minutes} minutes · {r.state}{" "}
                  · {formatTime(r.requestedAt)}
                  {r.overrideUntil && (
                    <p>Recorded exception end: {formatTime(r.overrideUntil)}</p>
                  )}
                  {r.state === "pending" && (
                    <>
                      {v.canManage
                        ? ["approved", "rejected"].map((decision) => (
                            <ActionButton
                              key={decision}
                              action={async () => {
                                await api(`${path}/requests/${r.id}`, "PATCH", {
                                  decision,
                                });
                                resource.reload();
                              }}
                            >
                              {decision === "approved"
                                ? "Approve request"
                                : "Reject request"}
                            </ActionButton>
                          ))
                        : v.canRequest && (
                            <ActionButton
                              action={async () => {
                                await api(`${path}/requests/${r.id}`, "PATCH", {
                                  decision: "cancelled",
                                });
                                resource.reload();
                              }}
                            >
                              Cancel request
                            </ActionButton>
                          )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Family activity timeline">
            <ul className="item-list">
              {v.timeline.map((e) => (
                <li key={e.id}>
                  <strong>{e.kind.replaceAll("_", " ")}</strong> ·{" "}
                  {formatTime(e.occurredAt)}
                  <p>
                    {e.detail.status ? `Device report: ${e.detail.status}` : ""}
                    {e.detail.decision ? `Decision: ${e.detail.decision}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
function TimeRequest({
  direct,
  send,
}: {
  direct: boolean;
  send: (input: {
    id: string;
    reason: string;
    minutes: number;
  }) => Promise<void>;
}) {
  const [id, setId] = useState(() => crypto.randomUUID());
  return (
    <ActionFormDialog
      submit={direct ? "Grant temporary exception" : "Request more time"}
      action={async (f) => {
        await send({
          id,
          reason: text(f, "reason"),
          minutes: Number(f.get("minutes")),
        });
        setId(crypto.randomUUID());
        return direct
          ? "Exception recorded. Device enforcement remains unsupported."
          : "Request recorded for an authorized guardian.";
      }}
    >
      <Field label="Requested minutes">
        <input
          name="minutes"
          type="number"
          min={1}
          max={120}
          required
          defaultValue={15}
        />
      </Field>
      <Field label="Reason for time request">
        <input name="reason" maxLength={200} required />
      </Field>
    </ActionFormDialog>
  );
}
