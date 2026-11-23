"use client";
import { useState } from "react";
import { api } from "@/shared/api";
import { useResource } from "@/shared/use-resource";
import type { Member, UsageNetwork } from "@/shared/types";
import type { PageContext } from "@/features/workspace/types";
import { ChildPanel } from "./child-panel";
import { ProfileForm } from "./profile-form";
import type { Profile } from "./types";
import {
  ActionForm,
  Card,
  Field,
  Notice,
  Empty,
  ErrorNotice,
  Loading,
  text,
} from "@/shared/ui/common";

export function FamilyPanel(context: PageContext & { tab: string }) {
  const { tab } = context;
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
      {tab === "sharing" && (
        <Card title="Family-sharing disclosure">
          <p>{family.data?.disclosure.text}</p>
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
        </Card>
      )}
      {tab === "profiles" && (
        <>
          <Card title="Your family profiles">
            {family.data?.profiles.length ? (
              <Field label="Child profile">
                <select
                  value={id}
                  onChange={(e) => setSelected(e.target.value)}
                >
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
            <p>
              Invite guardians and child accounts from Team. Owners/admins
              assign explicit profile grants after the invitation is accepted.
              Child accounts use the Member role.
            </p>
            {family.data?.canCreate && (
              <details>
                <summary>Create a child profile</summary>
                <ProfileForm
                  members={members.data ?? []}
                  networks={networks.data ?? []}
                  action={async (input) => {
                    const p = await api<Profile>(
                      `${path}/profiles`,
                      "POST",
                      input,
                    );
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
      )}
    </>
  );
}
