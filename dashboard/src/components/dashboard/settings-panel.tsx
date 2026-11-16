"use client";
import { api, download } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Retention, Session, User } from "@/lib/types";
import type { PageContext } from "./dashboard-shell";
import { NotificationPreferencesPanel } from "./alerts-panel";
import {
  ActionButton,
  ActionForm,
  Card,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  formatTime,
  number,
  text,
} from "../ui/common";
type Diagnostics = {
  runs: {
    id: string;
    kind: string;
    status: string;
    errorCode: string | null;
    createdAt: string;
  }[];
  deliveries: { status: string; count: number }[];
  pushProviders: { android: string; ios: string };
};
export function SettingsPanel(context: PageContext) {
  const { user, workspace, permissions, updateUser, accountDeleted } = context;
  const sessions = useResource<Session[]>("/auth/sessions");
  const privacy =
    useResource<{ id: string; kind: string; createdAt: string }[]>(
      "/privacy/history",
    );
  const base = `/workspaces/${workspace.id}/monitoring`;
  const audit = permissions.includes("audit:read");
  const retention = useResource<Retention>(audit ? `${base}/retention` : null);
  const diagnostics = useResource<Diagnostics>(
    audit ? `${base}/diagnostics` : null,
    true,
  );
  return (
    <>
      <div className="two-columns">
        <Card title="Your profile">
          <ActionForm
            submit="Update profile"
            action={async (form) => {
              updateUser(
                await api<User>("/auth/me", "PATCH", {
                  displayName: text(form, "displayName"),
                }),
              );
            }}
          >
            <Field label="Display name">
              <input
                name="displayName"
                required
                minLength={2}
                maxLength={100}
                defaultValue={user.displayName}
              />
            </Field>
            <Field label="Account email">
              <input type="email" readOnly value={user.email} />
            </Field>
            <span className="badge">
              {user.emailVerifiedAt
                ? "Email verified"
                : "Email verification required"}
            </span>
          </ActionForm>
        </Card>
        <Card title="Appearance and accessibility">
          <ActionForm
            submit="Save display preferences"
            action={async (form) => {
              updateUser(
                await api<User>("/auth/preferences", "PATCH", {
                  theme: text(form, "theme"),
                  reducedMotion: form.has("reducedMotion"),
                }),
              );
            }}
          >
            <Field label="Color theme">
              <select
                name="theme"
                defaultValue={user.preferences.theme ?? "SYSTEM"}
              >
                <option value="SYSTEM">System</option>
                <option value="LIGHT">Light</option>
                <option value="DARK">Dark</option>
              </select>
            </Field>
            <label className="check">
              <input
                type="checkbox"
                name="reducedMotion"
                defaultChecked={user.preferences.reducedMotion}
              />
              Reduce motion
            </label>
          </ActionForm>
        </Card>
      </div>
      <NotificationPreferencesPanel />
      <Card title="Account sessions">
        <ErrorNotice error={sessions.error} />
        {sessions.loading && <Loading />}
        <p>
          Revoke a session to end its access. Revoking this browser’s current
          session will require signing in again.
        </p>
        <ActionButton
          action={async () => {
            await api("/auth/sessions", "DELETE", {});
            sessions.reload();
          }}
          confirm="Revoke every session except this browser’s current session?"
        >
          Sign out other sessions
        </ActionButton>
        <ul className="item-list">
          {sessions.data?.map((session) => (
            <li key={session.id}>
              <div>
                <strong>{session.userAgent ?? "Unknown client"}</strong>
                <small>
                  Reported address {session.ipAddress ?? "unavailable"} · last
                  used {formatTime(session.lastUsedAt)}
                </small>
                <small>
                  {session.revokedAt
                    ? "Revoked"
                    : "Expires " + formatTime(session.expiresAt)}
                </small>
              </div>
              {!session.revokedAt && (
                <ActionButton
                  action={async () => {
                    await api(`/auth/sessions/${session.id}`, "DELETE", {});
                    sessions.reload();
                  }}
                  confirm="Revoke this session? If it belongs to this browser, you will need to sign in again."
                >
                  Revoke session
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Export your personal data">
        <p>
          Confirm your current password to download your profile, device
          records, monitoring observations, preferences and privacy history. The
          file contains personal data; store it carefully.
        </p>
        <ActionForm
          submit="Download personal data"
          reset
          action={async (form) => {
            const data = await api("/privacy/export", "POST", {
              password: String(form.get("password")),
            });
            download(
              JSON.stringify(data, null, 2),
              "netsentry-personal-data.json",
              "application/json",
            );
            privacy.reload();
            return "Your personal export is ready to download.";
          }}
        >
          <Field label="Current password for export">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </Field>
        </ActionForm>
      </Card>
      <Card title="Privacy history">
        <ErrorNotice error={privacy.error} />
        <ul className="item-list">
          {privacy.data?.map((event) => (
            <li key={event.id}>
              <div>
                <strong>{event.kind.replaceAll("_", " ")}</strong>
                <small>{formatTime(event.createdAt)}</small>
              </div>
            </li>
          ))}
        </ul>
        {privacy.data?.length === 0 && <p>No privacy actions recorded yet.</p>}
      </Card>
      {audit ? (
        <>
          <Card title="Workspace data retention">
            <ErrorNotice error={retention.error} />
            {retention.loading && <Loading />}
            {retention.data && (
              <>
                <p>
                  Raw observations and aggregates expire independently. Minimal
                  synchronization indexes remain for aggregate retention plus
                  one day.
                </p>
                <small>
                  Policy effective{" "}
                  {retention.data.effectiveAt
                    ? formatTime(retention.data.effectiveAt)
                    : "default policy (no override)"}
                  . Cleanup requires scheduled monitoring maintenance.
                </small>
                {workspace.role === "OWNER" ? (
                  <ActionForm
                    submit="Update retention policy"
                    action={async (form) => {
                      const policy = {
                        rawDays: number(form, "rawDays"),
                        aggregateDays: number(form, "aggregateDays"),
                        alertDays: number(form, "alertDays"),
                        diagnosticDays: number(form, "diagnosticDays"),
                      };
                      if (policy.aggregateDays < policy.rawDays)
                        throw new Error(
                          "Aggregate retention must cover raw retention.",
                        );
                      await api(`${base}/retention`, "PATCH", policy);
                      retention.reload();
                      return "Retention policy updated. Shortened retention applies on the next cleanup pass.";
                    }}
                  >
                    <div className="field-row">
                      {[
                        ["rawDays", "Raw observations", 90],
                        ["aggregateDays", "Aggregates and gaps", 730],
                        ["alertDays", "Alerts and deliveries", 90],
                        ["diagnosticDays", "Diagnostics", 30],
                      ].map(([key, label, max]) => (
                        <Field label={`${label} (days)`} key={key}>
                          <input
                            type="number"
                            name={String(key)}
                            required
                            min={1}
                            max={Number(max)}
                            step={1}
                            defaultValue={
                              retention.data![key as keyof Retention] as number
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <label className="check">
                      <input type="checkbox" required />I understand shorter
                      retention can permanently remove existing data.
                    </label>
                  </ActionForm>
                ) : (
                  <dl className="details-grid">
                    {Object.entries(retention.data)
                      .filter(([key]) => key.endsWith("Days"))
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value} days</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </>
            )}
          </Card>
          <Card title="Monitoring diagnostics">
            <ErrorNotice error={diagnostics.error} />
            {diagnostics.loading && <Loading />}
            {diagnostics.data && (
              <>
                <p>
                  Android push: {diagnostics.data.pushProviders.android} · iOS
                  push: {diagnostics.data.pushProviders.ios}
                </p>
                <small>
                  Latest 100 operational outcomes. Refreshed{" "}
                  {formatTime(diagnostics.updatedAt)}.
                </small>
                <div className="button-row">
                  {diagnostics.data.deliveries.map((delivery) => (
                    <span key={delivery.status} className="badge">
                      {delivery.status}: {delivery.count}
                    </span>
                  ))}
                </div>
                <div className="table-scroll">
                  <table>
                    <caption>
                      Safe job outcomes; no raw credentials or provider
                      exception contents.
                    </caption>
                    <thead>
                      <tr>
                        <th>Operation</th>
                        <th>Outcome</th>
                        <th>Code</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.data.runs.map((run) => (
                        <tr key={run.id}>
                          <td>{run.kind.replaceAll("_", " ")}</td>
                          <td>{run.status}</td>
                          <td>{run.errorCode ?? "—"}</td>
                          <td>{formatTime(run.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      ) : (
        <Notice>
          Workspace retention and operational diagnostics require audit
          permission. Your personal profile and privacy controls remain
          available.
        </Notice>
      )}
      <Card title="Delete your account">
        <Notice>
          Account deletion removes your personal records and revokes
          account/device access. Transfer ownership of shared workspaces
          containing other people first. Downloaded exports and backup expiry
          follow their separate retention rules.
        </Notice>
        <details>
          <summary>Review permanent account deletion</summary>
          <ActionForm
            submit="Permanently delete account"
            action={async (form) => {
              await api("/privacy/account", "DELETE", {
                password: String(form.get("password")),
                confirmation: text(form, "confirmation"),
              });
              accountDeleted();
            }}
          >
            <Field label="Current password for account deletion">
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </Field>
            <Field label="Type DELETE to confirm">
              <input
                name="confirmation"
                pattern="DELETE"
                required
                autoComplete="off"
              />
            </Field>
            <label className="check">
              <input type="checkbox" required />I understand account deletion
              cannot be undone.
            </label>
          </ActionForm>
        </details>
      </Card>
    </>
  );
}
