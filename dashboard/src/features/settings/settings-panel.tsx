"use client";
import { Monitor, UserRound } from "lucide-react";
import { api, download } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Retention, Session, User, Workspace } from "@/shared/types";
import { NotificationPreferencesPanel } from "@/features/alerts/alerts-panel";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import {
  ActionButton,
  ActionForm,
  Card,
  ErrorNotice,
  Field,
  PasswordField,
  Loading,
  Notice,
  formatTime,
  number,
  text,
} from "@/shared/ui/common";
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
const retentionFields = [
  ["rawDays", "Raw observations", 90],
  ["aggregateDays", "Aggregates and gaps", 730],
  ["alertDays", "Alerts and deliveries", 90],
  ["diagnosticDays", "Diagnostics", 30],
] as const;

export function SettingsPanel({
  user,
  workspace,
  permissions,
  updateUser,
  accountDeleted,
  tab,
}: {
  user: User;
  workspace?: Workspace;
  permissions?: string[];
  updateUser: (user: User) => void;
  accountDeleted: () => void;
  tab: string;
}) {
  const sessions = useResource<Session[]>(
    tab === "sessions" ? "/auth/sessions" : null,
  );
  const privacy = useResource<
    { id: string; kind: string; createdAt: string }[]
  >(tab === "privacy" ? "/privacy/history" : null);
  const auditBase =
    workspace && permissions?.includes("audit:read")
      ? `/workspaces/${workspace.id}/monitoring`
      : undefined;
  const retention = useResource<Retention>(
    tab === "workspace" && auditBase ? `${auditBase}/retention` : null,
  );
  const diagnostics = useResource<Diagnostics>(
    tab === "workspace" && auditBase ? `${auditBase}/diagnostics` : null,
    true,
  );
  return (
    <>
      {tab === "profile" && (
        <div className="grid gap-4 min-[651px]:grid-cols-2">
          <Card
            title="Your profile"
            icon={<UserRound size={20} />}
            className="flex flex-col"
          >
            <dl className="mb-4 flex-1 space-y-3">
              <div>
                <dt className="text-xs font-semibold text-text-secondary">
                  Display name
                </dt>
                <dd>{user.displayName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-text-secondary">
                  Account email
                </dt>
                <dd className="break-all">{user.email}</dd>
                <dd className="text-xs font-semibold text-primary-hover">
                  {user.emailVerifiedAt ? "Verified" : "Unverified"}
                </dd>
              </div>
            </dl>
            <ActionFormDialog
              label="Edit profile"
              submit="Update profile"
              action={async (form) => {
                updateUser(
                  await api<User>("/auth/me", "PATCH", {
                    displayName: text(form, "displayName"),
                  }),
                );
                return "Changes saved.";
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
            </ActionFormDialog>
          </Card>
          <Card
            title="Appearance and accessibility"
            icon={<Monitor size={20} />}
            className="flex flex-col"
          >
            <dl className="mb-4 flex-1 space-y-3">
              <div>
                <dt className="text-xs font-semibold text-text-secondary">
                  Color theme
                </dt>
                <dd className="capitalize">
                  {(user.preferences.theme ?? "SYSTEM").toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-text-secondary">
                  Reduced motion
                </dt>
                <dd>{user.preferences.reducedMotion ? "On" : "Off"}</dd>
              </div>
            </dl>
            <ActionFormDialog
              label="Edit display preferences"
              submit="Save display preferences"
              action={async (form) => {
                updateUser(
                  await api<User>("/auth/preferences", "PATCH", {
                    theme: text(form, "theme"),
                    reducedMotion: form.has("reducedMotion"),
                  }),
                );
                return "Changes saved.";
              }}
            >
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">
                  Color theme
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
                  {(["System", "Light", "Dark"] as const).map((theme) => (
                    <label key={theme} className="relative cursor-pointer">
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="theme"
                        value={theme.toUpperCase()}
                        defaultChecked={
                          (user.preferences.theme ?? "SYSTEM") ===
                          theme.toUpperCase()
                        }
                      />
                      <span className="flex min-h-11 items-center justify-center rounded-md px-1 text-sm font-semibold text-text peer-checked:bg-primary peer-checked:text-[color:var(--on-primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-primary">
                        {theme}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="relative flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold">
                Reduce motion
                <input
                  className="peer sr-only"
                  type="checkbox"
                  role="switch"
                  name="reducedMotion"
                  defaultChecked={user.preferences.reducedMotion}
                />
                <span
                  aria-hidden="true"
                  className="relative h-6 w-11 shrink-0 rounded-full bg-border after:absolute after:start-1 after:top-1 after:size-4 after:rounded-full after:bg-surface after:content-[''] peer-checked:bg-primary peer-checked:after:start-6 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
                />
              </label>
            </ActionFormDialog>
          </Card>
        </div>
      )}
      {tab === "notifications" && <NotificationPreferencesPanel />}
      {tab === "sessions" && (
        <>
          <Card title="Account sessions">
            <ErrorNotice error={sessions.error} />
            {sessions.loading && <Loading />}
            <p>
              Revoke a session to end its access. Revoking this browser’s
              current session will require signing in again.
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
                      Reported address {session.ipAddress ?? "unavailable"} ·
                      last used {formatTime(session.lastUsedAt)}
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
        </>
      )}
      {tab === "privacy" && (
        <>
          <Card title="Export your personal data">
            <p>
              Confirm your current password to download your profile, device
              records, monitoring observations, preferences and privacy history.
              The file contains personal data; store it carefully.
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
              <PasswordField
                label="Current password for export"
                name="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
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
            {privacy.data?.length === 0 && (
              <p>No privacy actions recorded yet.</p>
            )}
          </Card>
          <Card title="Delete your account">
            <Notice>
              Account deletion removes your personal records and revokes
              account/device access. Transfer ownership of shared workspaces
              containing other people first. Downloaded exports and backup
              expiry follow their separate retention rules.
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
                <PasswordField
                  label="Current password for account deletion"
                  name="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
                <Field label="Type DELETE to confirm">
                  <input
                    name="confirmation"
                    pattern="DELETE"
                    required
                    autoComplete="off"
                  />
                </Field>
                <label className="check">
                  <input type="checkbox" required />I understand account
                  deletion cannot be undone.
                </label>
              </ActionForm>
            </details>
          </Card>
        </>
      )}
      {tab === "workspace" && (
        <>
          {auditBase ? (
            <>
              <Card title="Workspace data retention">
                <ErrorNotice error={retention.error} />
                {retention.loading && <Loading />}
                {retention.data && (
                  <>
                    <p>
                      Raw observations and aggregates expire independently.
                      Minimal synchronization indexes remain for aggregate
                      retention plus one day.
                    </p>
                    <small>
                      Policy effective{" "}
                      {retention.data.effectiveAt
                        ? formatTime(retention.data.effectiveAt)
                        : "default policy (no override)"}
                      . Cleanup requires scheduled monitoring maintenance.
                    </small>
                    <dl className="details-grid">
                      {retentionFields.map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>{retention.data![key]} days</dd>
                        </div>
                      ))}
                    </dl>
                    {workspace?.role === "OWNER" && (
                      <ActionFormDialog
                        label="Edit retention policy"
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
                          await api(`${auditBase}/retention`, "PATCH", policy);
                          retention.reload();
                          return "Retention policy updated. Shortened retention applies on the next cleanup pass.";
                        }}
                      >
                        <div className="field-row">
                          {retentionFields.map(([key, label, max]) => (
                            <Field label={`${label} (days)`} key={key}>
                              <input
                                type="number"
                                name={key}
                                required
                                min={1}
                                max={max}
                                step={1}
                                defaultValue={retention.data![key]}
                              />
                            </Field>
                          ))}
                        </div>
                        <label className="check">
                          <input type="checkbox" required />I understand shorter
                          retention can permanently remove existing data.
                        </label>
                      </ActionFormDialog>
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
                      Android push: {diagnostics.data.pushProviders.android} ·
                      iOS push: {diagnostics.data.pushProviders.ios}
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
        </>
      )}
    </>
  );
}
