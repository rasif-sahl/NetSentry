"use client";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import type { Member, UsageNetwork } from "@/shared/types";
import { ActionForm, Field, text } from "@/shared/ui/common";
import { familyConsent, FamilyConsent } from "./family-consent";
import type { Profile } from "./types";

export function ProfileForm({
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
  const Form = profile ? ActionForm : ActionFormDialog;
  return (
    <Form
      submit={
        profile
          ? "Save profile and renew sharing consent"
          : "Create child profile"
      }
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
          ...familyConsent,
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
      <FamilyConsent />
    </Form>
  );
}
