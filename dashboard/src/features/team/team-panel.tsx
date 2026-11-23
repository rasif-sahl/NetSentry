"use client";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Invitation, Member } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import {
  ActionButton,
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
                          <ActionFormDialog
                            label="Edit member role"
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
                          </ActionFormDialog>
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
              <ActionFormDialog
                submit="Create invitation"
                primary
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
              </ActionFormDialog>
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
              <ActionFormDialog
                label="Transfer workspace ownership"
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
              </ActionFormDialog>
            </Card>
          )}
        </>
      )}
    </>
  );
}
