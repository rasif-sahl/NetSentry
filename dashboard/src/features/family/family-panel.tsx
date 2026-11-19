"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Member, UsageNetwork } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionForm,
  ActionButton,
  Card,
  Field,
  Notice,
  Empty,
  ErrorNotice,
  Loading,
  formatTime,
  text,
} from "@/shared/ui/common";
type Profile = {
  id: string;
  name: string;
  avatar: string;
  ageBand: string;
  userId: string | null;
  guardians: string[];
  networks: string[];
  archived: boolean;
  revision: number;
};
type Rules = {
  enabled: boolean;
  dailyMinutes: number | null;
  appLimits: { id: string; minutes: number }[];
  categoryLimits: {
    id: string;
    minutes: number;
    purpose?: "education" | "entertainment" | "other";
  }[];
  allowedApps: string[];
  restrictedApps: string[];
  schedules: {
    kind: "bedtime" | "study" | "weekend";
    days: number[];
    start: string;
    end: string;
  }[];
  pauseUntil: string | null;
  networkPause: boolean;
  domains: string[];
  domainCategories: string[];
};
type FamilyView = {
  profile: Profile;
  canManage: boolean;
  canRequest: boolean;
  policy: null | { revision: number; rules: Rules; timezone: string };
  desired: { state: string; reasons: string[]; warnings: string[] };
  overrideUntil: string | null;
  disclosure: { text: string };
  report: {
    from: string;
    to: string;
    confidence: string;
    evidence: string;
    currentWeekMinutes: number;
    previousWeekMinutes: number;
    comparisonPercent: number | null;
    educationMinutes: number;
    entertainmentMinutes: number;
    suggestions: string[];
    applicationTrends: {
      id: string;
      currentMinutes: number;
      previousMinutes: number;
    }[];
    categoryTrends: {
      id: string;
      currentMinutes: number;
      previousMinutes: number;
    }[];
    days: {
      date: string;
      minutes: number;
      coverageMinutes: number;
      lateNightMinutes: number;
    }[];
  };
  devices: {
    deviceId: string;
    name: string;
    platform: string;
    enforcement: string;
    consentedAt: string;
    receivedAt: string | null;
  }[];
  requests: {
    id: string;
    reason: string;
    minutes: number;
    state: string;
    requestedAt: string;
    overrideUntil: string | null;
  }[];
  timeline: {
    id: string;
    kind: string;
    occurredAt: string;
    detail: Record<string, unknown>;
  }[];
};
const avatarSymbols: Record<string, string> = {
  star: "⭐",
  leaf: "🌿",
  fox: "🦊",
  owl: "🦉",
  rocket: "🚀",
  sun: "☀️",
};
const consent = { accepted: true, disclosureVersion: "family-sharing-v1" };
const emptyRules = (): Rules => ({
  enabled: true,
  dailyMinutes: null,
  appLimits: [],
  categoryLimits: [],
  allowedApps: [],
  restrictedApps: [],
  schedules: [],
  pauseUntil: null,
  networkPause: false,
  domains: [],
  domainCategories: [],
});
function Accept() {
  return (
    <label className="check">
      <input type="checkbox" required />I accept the family-sharing disclosure
      and have authority for this change.
    </label>
  );
}
export function FamilyPanel(context: PageContext) {
  const enabled = context.workspace.type === "FAMILY",
    path = `/workspaces/${context.workspace.id}/family`;
  const family = useResource<{
    canCreate: boolean;
    profiles: (Pick<
      Profile,
      "id" | "name" | "avatar" | "ageBand" | "archived" | "revision"
    > & { canManage: boolean })[];
    disclosure: { text: string };
  }>(enabled ? path : null, true);
  const [selected, setSelected] = useState("");
  const id = family.data?.profiles.some((p) => p.id === selected)
    ? selected
    : family.data?.profiles[0]?.id;
  const members = useResource<Member[]>(
    enabled && family.data?.canCreate
      ? `/workspaces/${context.workspace.id}/members`
      : null,
  );
  const networks = useResource<UsageNetwork[]>(
    enabled && family.data?.canCreate
      ? `/workspaces/${context.workspace.id}/monitoring/networks`
      : null,
  );
  if (!enabled)
    return (
      <Empty title="Choose a Family workspace">
        Create a Family workspace in Team, then invite guardians and child
        accounts there. Workspace membership alone does not grant access to a
        child profile.
      </Empty>
    );
  return (
    <>
      <Notice>
        Policies describe requested limits. Current Android consumer usage
        access and the read-only router adapter cannot enforce app, network or
        domain restrictions. No restriction is reported applied. Native builds,
        notifications and real-device enforcement remain pending.
      </Notice>
      <ErrorNotice error={family.error} />
      {family.loading && <Loading />}
      <details>
        <summary>Family-sharing disclosure</summary>
        <p>{family.data?.disclosure.text}</p>
      </details>
      <Card title="Your family profiles">
        {family.data?.profiles.length ? (
          <Field label="Child profile">
            <select value={id} onChange={(e) => setSelected(e.target.value)}>
              {family.data.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.archived ? " (archived)" : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Empty title="No child profiles in your current grant" />
        )}
        <details>
          <summary>Withdraw sharing on your own device</summary>
          <p>
            You can withdraw family sharing for a device you own even if a
            guardian profile grant has been removed. Personal measurements
            remain separate.
          </p>
          <ActionForm
            submit="Withdraw your device's family sharing"
            action={async (f) => {
              await api(
                `/devices/${text(f, "ownDeviceId")}/family-assignment`,
                "DELETE",
              );
              family.reload();
              return "Your device sharing was withdrawn. Refresh any open child profile.";
            }}
          >
            <Field label="Your device for family withdrawal">
              <select name="ownDeviceId" required>
                <option value="">Choose your device</option>
                {context.devices
                  .filter((d) => d.registeredById === context.user.id)
                  .map((d) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </Field>
          </ActionForm>
        </details>
        <p>
          Invite guardians and child accounts from Team. Owners/admins assign
          explicit profile grants after the invitation is accepted. Child
          accounts use the Member role.
        </p>
        {family.data?.canCreate && (
          <details>
            <summary>Create a child profile</summary>
            <ProfileForm
              members={members.data ?? []}
              networks={networks.data ?? []}
              action={async (input) => {
                const p = await api<Profile>(`${path}/profiles`, "POST", input);
                family.reload();
                setSelected(p.id);
              }}
            />
          </details>
        )}
        <ErrorNotice error={members.error} />
        <ErrorNotice error={networks.error} />
      </Card>
      {id && (
        <ChildPanel
          key={`${context.workspace.id}/${id}`}
          context={context}
          path={`${path}/profiles/${id}`}
          elevated={!!family.data?.canCreate}
          members={members.data ?? []}
          networks={networks.data ?? []}
          reloadFamily={family.reload}
        />
      )}
    </>
  );
}
function ProfileForm({
  profile,
  members,
  networks,
  action,
}: {
  profile?: Profile;
  members: Member[];
  networks: UsageNetwork[];
  action: (input: unknown) => Promise<void>;
}) {
  return (
    <ActionForm
      submit={
        profile
          ? "Save profile and renew sharing consent"
          : "Create child profile"
      }
      reset={!profile}
      action={async (f) => {
        await action({
          expectedRevision: profile?.revision ?? 0,
          name: text(f, "name"),
          avatar: text(f, "avatar"),
          ageBand: text(f, "ageBand"),
          userId: text(f, "userId") || null,
          guardians: f.getAll("guardians"),
          networks: f.getAll("networks"),
          archived: f.has("archived"),
          ...consent,
        });
        return "Profile saved. Existing device sharing needs renewed consent after profile changes.";
      }}
    >
      <Field label="Child display name">
        <input
          name="name"
          defaultValue={profile?.name}
          maxLength={80}
          required
        />
      </Field>
      <Field label="Avatar">
        <select name="avatar" defaultValue={profile?.avatar ?? "star"}>
          {["star", "leaf", "fox", "owl", "rocket", "sun"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field
        label="Age band"
        hint="An operator-selected label, not age verification or an automatic restriction."
      >
        <select name="ageBand" defaultValue={profile?.ageBand ?? "teen"}>
          <option value="under_13">Under 13</option>
          <option value="teen">Teen</option>
          <option value="adult">Adult</option>
        </select>
      </Field>
      <Field label="Optional linked child account">
        <select name="userId" defaultValue={profile?.userId ?? ""}>
          <option value="">No linked account</option>
          {members
            .filter((m) => m.role === "MEMBER")
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
        </select>
      </Field>
      <fieldset>
        <legend>Authorized guardians</legend>
        {members
          .filter((m) => ["OWNER", "ADMIN", "GUARDIAN"].includes(m.role))
          .map((m) => (
            <label className="check" key={m.userId}>
              <input
                type="checkbox"
                name="guardians"
                value={m.userId}
                defaultChecked={profile?.guardians.includes(m.userId) ?? false}
              />
              {m.displayName} ({m.role})
            </label>
          ))}
      </fieldset>
      <fieldset>
        <legend>Associated network labels</legend>
        {networks.map((n) => (
          <label className="check" key={n.id}>
            <input
              name="networks"
              type="checkbox"
              value={n.id}
              defaultChecked={profile?.networks.includes(n.id) ?? false}
            />
            {n.name}
          </label>
        ))}
        <p>
          Network labels do not attribute household traffic to a child or grant
          router control.
        </p>
      </fieldset>
      <label className="check">
        <input
          name="archived"
          type="checkbox"
          defaultChecked={profile?.archived ?? false}
        />
        Archive profile
      </label>
      <Accept />
    </ActionForm>
  );
}
function ChildPanel({
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
            <ActionForm
              submit="Consent to sharing your device"
              action={async (f) => {
                await api(`${path}/devices`, "POST", {
                  deviceId: text(f, "deviceId"),
                  ...consent,
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
              <Accept />
            </ActionForm>
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
            <ActionForm
              submit="Send insight feedback"
              reset
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
            </ActionForm>
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
                    ...consent,
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
    <ActionForm
      submit={direct ? "Grant temporary exception" : "Request more time"}
      reset
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
    </ActionForm>
  );
}
function PolicyForm({
  initial,
  ageBand,
  save,
}: {
  initial?: Rules;
  ageBand: string;
  save: (rules: Rules) => Promise<void>;
}) {
  const [schedules, setSchedules] = useState(initial?.schedules ?? []);
  const [openedAt] = useState(() => Date.now());
  const r = initial ?? emptyRules();
  const list = (value: string) => value.split(/[\s,]+/).filter(Boolean);
  return (
    <ActionForm
      submit="Save requested policy"
      action={async (f) => {
        const limits = (name: string) =>
          text(f, name)
            .split(/[\n,]+/)
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => {
              const [id, minutes, purpose, ...extra] = x.split(":");
              if (
                extra.length ||
                (purpose &&
                  (name !== "categoryLimits" ||
                    !["education", "entertainment", "other"].includes(purpose)))
              )
                throw new Error(
                  "Use ID:minutes and an optional education, entertainment or other category purpose.",
                );
              return {
                id: id.trim(),
                minutes: Number(minutes),
                ...(purpose
                  ? {
                      purpose: purpose as
                        "education" | "entertainment" | "other",
                    }
                  : {}),
              };
            });
        await save({
          enabled: f.has("enabled"),
          dailyMinutes: text(f, "dailyMinutes")
            ? Number(f.get("dailyMinutes"))
            : null,
          appLimits: limits("appLimits"),
          categoryLimits: limits("categoryLimits"),
          allowedApps: list(text(f, "allowedApps")),
          restrictedApps: list(text(f, "restrictedApps")),
          schedules,
          pauseUntil: text(f, "pauseUntil")
            ? new Date(String(f.get("pauseUntil"))).toISOString()
            : null,
          networkPause: f.has("networkPause"),
          domains: list(text(f, "domains")),
          domainCategories: list(text(f, "domainCategories")),
        });
        return "Policy saved as requested. No restriction is claimed applied.";
      }}
    >
      <p>
        Suggested starting point for {ageBand.replaceAll("_", " ")}:{" "}
        {ageBand === "under_13"
          ? "60"
          : ageBand === "teen"
            ? "120"
            : "no automatic"}{" "}
        daily minutes. Choose limits with the child; age bands do not
        automatically enable restrictions.
      </p>
      <label className="check">
        <input name="enabled" type="checkbox" defaultChecked={r.enabled} />
        Evaluate this policy
      </label>
      <Field label="Daily observed screen-time allowance (minutes)">
        <input
          type="number"
          name="dailyMinutes"
          min={1}
          max={1440}
          defaultValue={r.dailyMinutes ?? ""}
        />
      </Field>
      <Field
        label="App limits"
        hint="One Android application ID:minutes per line, for example com.example.game:30."
      >
        <textarea
          name="appLimits"
          defaultValue={r.appLimits
            .map((x) => `${x.id}:${x.minutes}`)
            .join("\n")}
        />
      </Field>
      <Field
        label="Category limits"
        hint="One category ID:minutes[:purpose] per line. Optional purpose: education, entertainment or other. Custom category UUIDs are supported; purpose explicitly labels the comparison."
      >
        <textarea
          name="categoryLimits"
          defaultValue={r.categoryLimits
            .map(
              (x) => `${x.id}:${x.minutes}${x.purpose ? ":" + x.purpose : ""}`,
            )
            .join("\n")}
        />
      </Field>
      {(
        [
          "allowedApps",
          "restrictedApps",
          "domains",
          "domainCategories",
        ] as const
      ).map((name) => (
        <Field
          key={name}
          label={
            {
              allowedApps: "Allowed application IDs",
              restrictedApps: "Restricted application IDs",
              domains: "Requested blocked domains",
              domainCategories: "Requested blocked domain categories",
            }[name]
          }
          hint="Separate entries with spaces or commas. These selections are unsupported enforcement intents."
        >
          <textarea name={name} defaultValue={r[name].join(", ")} />
        </Field>
      ))}
      <fieldset>
        <legend>Bedtime, study and weekend schedules</legend>
        {schedules.map((s, index) => (
          <fieldset key={index}>
            <legend>Schedule {index + 1}</legend>
            <Field label={`Schedule ${index + 1} type`}>
              <select
                value={s.kind}
                onChange={(e) =>
                  setSchedules((a) =>
                    a.map((x, i) =>
                      i === index
                        ? { ...x, kind: e.target.value as typeof s.kind }
                        : x,
                    ),
                  )
                }
              >
                {["bedtime", "study", "weekend"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            {(["start", "end"] as const).map((k) => (
              <Field key={k} label={`Schedule ${index + 1} ${k}`}>
                <input
                  type="time"
                  required
                  value={s[k]}
                  onChange={(e) =>
                    setSchedules((a) =>
                      a.map((x, i) =>
                        i === index ? { ...x, [k]: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <div>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, n) => (
                  <label className="check" key={day}>
                    <input
                      type="checkbox"
                      checked={s.days.includes(n)}
                      onChange={(e) =>
                        setSchedules((a) =>
                          a.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  days: e.target.checked
                                    ? [...x.days, n]
                                    : x.days.filter((d) => d !== n),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
            <button
              type="button"
              className="button"
              onClick={() =>
                setSchedules((a) => a.filter((_, i) => i !== index))
              }
            >
              Remove schedule {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="button"
          disabled={schedules.length >= 12}
          onClick={() =>
            setSchedules((a) => [
              ...a,
              {
                kind: "bedtime",
                days: [1, 2, 3, 4, 5],
                start: "21:00",
                end: "07:00",
              },
            ])
          }
        >
          Add schedule
        </button>
        <p>
          Times use the policy timezone shown above. Overnight schedules
          continue into the following day; repeated DST hours follow the same
          local rule.
        </p>
      </fieldset>
      <Field
        label="Temporary device pause until"
        hint="Optional local date/time, at most 24 hours ahead; records an unsupported pause request."
      >
        <input
          type="datetime-local"
          name="pauseUntil"
          defaultValue={
            r.pauseUntil && Date.parse(r.pauseUntil) > openedAt
              ? new Date(
                  Date.parse(r.pauseUntil) -
                    new Date(r.pauseUntil).getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ""
          }
        />
      </Field>
      <label className="check">
        <input
          name="networkPause"
          type="checkbox"
          defaultChecked={r.networkPause}
        />
        Request network pause (unsupported by current router adapter)
      </label>
      <Accept />
    </ActionForm>
  );
}
