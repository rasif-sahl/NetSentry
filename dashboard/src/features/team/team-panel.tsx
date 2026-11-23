"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Invitation, Member, Workspace } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
  ActionForm,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  formatTime,
  text,
} from "@/shared/ui/common";
export function TeamPanel({
  context,
  workspacesChanged,
  tab,
}: {
  context: PageContext;
  workspacesChanged: () => void;
  tab: string;
}) {
  const { workspace, user, permissions } = context;
  const base = `/workspaces/${workspace.id}`;
  const canManage = permissions.includes("members:manage");
  const members = useResource<Member[]>(
    tab === "members" ? `${base}/members` : null,
    true,
  );
  const invitations = useResource<Invitation[]>(
    tab === "members" && canManage && workspace.type !== "PERSONAL"
      ? `${base}/invitations`
      : null,
  );
  const [issued, setIssued] = useState<{
    invitation: Invitation;
    token: string;
  }>();
  const roles = [
    "VIEWER",
    ...(workspace.type === "BUSINESS"
      ? ["EMPLOYEE", "ANALYST", "NETWORK_ADMIN"]
      : ["MEMBER"]),
    ...(workspace.type === "FAMILY" && workspace.role === "OWNER"
      ? ["GUARDIAN"]
      : []),
    ...(workspace.role === "OWNER" ? ["ADMIN"] : []),
  ];
  function reload() {
    members.reload();
    invitations.reload();
    workspacesChanged();
  }
  return (
    <>
      {tab === "members" && (
        <>
          <Card title="Workspace members">
            <ErrorNotice error={members.error} />
            {members.loading && <Loading />}
            {members.data?.length ? (
              <ul className="item-list">
                {members.data.map((member) => (
                  <li key={member.userId}>
                    <div>
                      <strong>
                        {member.displayName}
                        {member.userId === user.id ? " (you)" : ""}
                      </strong>
                      <small>
                        {member.email} · {member.role}
                      </small>
                    </div>
                    {canManage &&
                      member.role !== "OWNER" &&
                      member.userId !== user.id &&
                      (workspace.role === "OWNER" ||
                        !["ADMIN", "GUARDIAN"].includes(member.role)) && (
                        <details>
                          <summary>Manage member</summary>
                          <ActionForm
                            submit="Change member role"
                            action={async (form) => {
                              await api(
                                `${base}/members/${member.userId}`,
                                "PATCH",
                                { role: text(form, "role") },
                              );
                              reload();
                              return "Role updated. Lost permissions invalidate affected access and alerts.";
                            }}
                          >
                            <Field label={`Role for ${member.displayName}`}>
                              <select name="role" defaultValue={member.role}>
                                {roles.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <label className="check">
                              <input type="checkbox" required />I understand
                              this may revoke devices or delete queued alerts.
                            </label>
                          </ActionForm>
                          <ActionButton
                            className="button danger"
                            action={async () => {
                              await api(
                                `${base}/members/${member.userId}`,
                                "DELETE",
                                {},
                              );
                              reload();
                            }}
                            confirm={`Remove ${member.displayName} from this workspace and revoke their associated access?`}
                          >
                            Remove member
                          </ActionButton>
                        </details>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              members.data && <Empty title="No members available" />
            )}
            {workspace.role !== "OWNER" && (
              <ActionButton
                className="button danger"
                action={async () => {
                  await api(`${base}/members/${user.id}`, "DELETE", {});
                  reload();
                }}
                confirm="Leave this workspace? Its device access and pending alerts will be revoked."
              >
                Leave workspace
              </ActionButton>
            )}
          </Card>
          {canManage && workspace.type !== "PERSONAL" && (
            <Card title="Invite someone">
              <p>
                Invitations are bound to the recipient’s verified email and
                expire after seven days. Share the token yourself; no invitation
                message is sent here.
              </p>
              <ActionForm
                submit="Create invitation"
                reset
                action={async (form) => {
                  setIssued(
                    await api(`${base}/invitations`, "POST", {
                      email: text(form, "email"),
                      role: text(form, "role"),
                    }),
                  );
                  invitations.reload();
                  return "Invitation created. Its token is shown once below.";
                }}
              >
                <Field label="Recipient email">
                  <input type="email" name="email" required maxLength={254} />
                </Field>
                <Field label="Invitation role">
                  <select name="role">
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>
              </ActionForm>
              {issued && (
                <Notice>
                  <strong>Invitation for {issued.invitation.email}</strong>
                  <p className="code" data-testid="invitation-token">
                    {issued.token}
                  </p>
                  <small>
                    Share privately. Expires{" "}
                    {formatTime(issued.invitation.expiresAt)}.
                  </small>
                  <div className="button-row align-end">
                    <button
                      type="button"
                      className="button accent"
                      onClick={() => setIssued(undefined)}
                    >
                      Hide token
                    </button>
                  </div>
                </Notice>
              )}
              <ErrorNotice error={invitations.error} />
              <ul className="item-list">
                {invitations.data?.map((invite) => (
                  <li key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <small>
                        {invite.role} ·{" "}
                        {invite.revokedAt
                          ? "Revoked"
                          : invite.acceptedAt
                            ? "Accepted"
                            : `Expires ${formatTime(invite.expiresAt)}`}
                      </small>
                    </div>
                    {!invite.revokedAt && !invite.acceptedAt && (
                      <ActionButton
                        action={async () => {
                          await api(
                            `${base}/invitations/${invite.id}`,
                            "DELETE",
                            {},
                          );
                          if (issued?.invitation.id === invite.id)
                            setIssued(undefined);
                          invitations.reload();
                        }}
                      >
                        Revoke invitation
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {workspace.role === "OWNER" && workspace.type !== "PERSONAL" && (
            <Card title="Transfer workspace ownership">
              <p>
                Choose an existing verified member. You will become an
                administrator; review the new owner carefully.
              </p>
              <ActionForm
                submit="Transfer ownership"
                action={async (form) => {
                  await api(`${base}/owner`, "POST", {
                    userId: text(form, "userId"),
                  });
                  reload();
                  return "Workspace ownership transferred.";
                }}
              >
                <Field label="New owner">
                  <select name="userId" required>
                    <option value="">Choose a member</option>
                    {members.data
                      ?.filter((member) => member.userId !== user.id)
                      .map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.displayName} · {member.email}
                        </option>
                      ))}
                  </select>
                </Field>
                <label className="check">
                  <input type="checkbox" required />I understand I will give up
                  workspace ownership.
                </label>
              </ActionForm>
            </Card>
          )}
        </>
      )}
      {tab === "workspaces" && (
        <>
          <div className="two-columns">
            <Card title="Create a workspace">
              <ActionForm
                submit="Create workspace"
                reset
                action={async (form) => {
                  await api<Workspace>("/workspaces", "POST", {
                    name: text(form, "name"),
                    type: text(form, "type"),
                    timezone: text(form, "timezone"),
                  });
                  workspacesChanged();
                  return "Workspace created. Select it from the workspace menu.";
                }}
              >
                <Field label="Workspace name">
                  <input name="name" required maxLength={100} />
                </Field>
                <Field label="Workspace type">
                  <select name="type">
                    <option value="FAMILY">Family</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </Field>
                <Field label="Workspace timezone">
                  <input
                    name="timezone"
                    required
                    defaultValue={
                      Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                  />
                </Field>
              </ActionForm>
            </Card>
            <Card title="Join a workspace">
              <ActionForm
                submit="Accept invitation"
                reset
                action={async (form) => {
                  await api("/workspaces/invitations/accept", "POST", {
                    token: text(form, "token"),
                  });
                  workspacesChanged();
                  return "Invitation accepted. Select the workspace from the workspace menu.";
                }}
              >
                <Field label="Invitation token">
                  <input
                    name="token"
                    required
                    pattern="[A-Za-z0-9_-]{43}"
                    autoComplete="off"
                  />
                </Field>
              </ActionForm>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
