"use client";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import {
  ActionButton,
  ActionForm,
  Card,
  Field,
  Notice,
  formatTime,
  text,
} from "@/shared/ui/common";
import { DepartmentField } from "./department-field";
import type { BusinessSectionProps } from "./types";
import type { Member } from "@/shared/types";

export function EmployeeAccess({
  data,
  options,
  can,
  mutate,
  members,
  userId,
  workspaceRole,
}: BusinessSectionProps & {
  members?: Member[];
  userId: string;
  workspaceRole: string;
}) {
  return (
    <>
      <Card title="Employees and offboarding">
        <p>
          Invite a verified member in Team first. Employee enrolment records an
          organizational relationship; device collection and organization
          sharing still need separate consent.
        </p>
        {data.employees.map((e) => (
          <div key={e.id} className="row">
            <strong>{e.displayName}</strong>
            <p>
              {e.offboardedAt
                ? `Offboarded ${formatTime(e.offboardedAt)}`
                : (options?.departments.find((d) => d.id === e.departmentId)
                    ?.name ?? "No department")}
            </p>
            {can("members:manage") && (
              <>
                <ActionForm
                  key={e.revision}
                  submit={
                    e.offboardedAt
                      ? "Restore invited employee"
                      : "Update employee department"
                  }
                  action={async (f) => {
                    await mutate(`/employees/${e.id}`, "PATCH", {
                      expectedRevision: e.revision,
                      ...(text(f, "department")
                        ? { departmentId: text(f, "department") }
                        : {}),
                    });
                    return "Updated. Device sharing must be accepted again.";
                  }}
                >
                  <DepartmentField
                    departments={options?.departments ?? []}
                    value={e.departmentId ?? ""}
                  />
                </ActionForm>
                {!e.offboardedAt && e.userId !== userId && (
                  <ActionButton
                    confirm={`Offboard ${e.displayName}? This removes organization membership, revokes organization device/agent credentials and ends sharing. Personal data and unrelated organizations are preserved.`}
                    action={async () => {
                      await mutate(`/employees/${e.id}/offboard`, "POST", {
                        confirmation: "OFFBOARD",
                      });
                    }}
                  >
                    Offboard employee
                  </ActionButton>
                )}
              </>
            )}
          </div>
        ))}
        {can("members:manage") && (
          <ActionFormDialog
            submit="Enrol employee"
            primary
            action={async (f) => {
              await mutate("/employees", "POST", {
                userId: text(f, "member"),
                ...(text(f, "department")
                  ? { departmentId: text(f, "department") }
                  : {}),
              });
              return "Employee enrolled.";
            }}
          >
            <Field label="Organization member">
              <select name="member" required>
                <option value="" disabled>
                  Choose current member
                </option>
                {members?.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName} · {m.role}
                  </option>
                ))}
              </select>
            </Field>
            <DepartmentField departments={options?.departments ?? []} />
          </ActionFormDialog>
        )}
      </Card>
      <Card title="Device assignment and employee sharing">
        <Notice>{data.disclosure.text}</Notice>
        {data.devices.map((d) => {
          const a = data.assignments.find((a) => a.deviceId === d.id),
            e = data.employees.find((e) => e.id === a?.employeeId);
          return (
            <div key={d.id} className="row">
              <strong>{d.name}</strong>
              <p>
                {d.platform} · {d.state} · custody: {d.ownership} · generation{" "}
                {d.generation}
              </p>
              <p>
                Reporting checks: {d.compliance.state.replaceAll("_", " ")}{" "}
                {d.compliance.checks
                  .map((c) => c.replaceAll("_", " "))
                  .join(", ")}
                . Metadata {formatTime(d.lastSeenAt)}.
              </p>
              <p>
                {e?.displayName ?? "No visible employee assignment"} ·{" "}
                {a?.consentedAt && a.generation === d.generation
                  ? `Sharing accepted; reports from ${a.reportFrom}`
                  : "Sharing unavailable or awaiting acceptance"}
              </p>
              {can("devices:manage") && (
                <ActionFormDialog
                  submit="Assign employee device"
                  action={async (f) => {
                    await mutate(`/devices/${d.id}/assignment`, "POST", {
                      employeeId: text(f, "employee"),
                      expectedRevision: a?.revision ?? 0,
                    });
                    return "Assigned. The employee must review and accept sharing.";
                  }}
                >
                  <Field label={`Employee for ${d.name}`}>
                    <select
                      name="employee"
                      required
                      defaultValue={a?.employeeId ?? ""}
                    >
                      <option value="" disabled>
                        Choose employee
                      </option>
                      {data.employees
                        .filter((e) => !e.offboardedAt)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.displayName}
                          </option>
                        ))}
                    </select>
                  </Field>
                </ActionFormDialog>
              )}
              {a && e?.userId === userId && d.state === "ACTIVE" && (
                <ActionButton
                  confirm={`Accept business-sharing-v1 for ${d.name}? ${data.disclosure.text}`}
                  action={async () => {
                    await mutate(`/devices/${d.id}/sharing`, "POST", {
                      expectedRevision: a.revision,
                      generation: d.generation,
                      accepted: true,
                      disclosureVersion: "business-sharing-v1",
                    });
                  }}
                >
                  Accept organization sharing
                </ActionButton>
              )}
              {a &&
                (can("devices:manage") ||
                  e?.userId === userId ||
                  d.registeredById === userId) && (
                  <ActionButton
                    confirm="Withdraw sharing? This ends organization report access. It does not erase your personal observations."
                    action={async () => {
                      await mutate(`/devices/${d.id}/assignment`, "DELETE");
                    }}
                  >
                    Withdraw device sharing
                  </ActionButton>
                )}
              {workspaceRole === "OWNER" &&
                d.registeredById === userId &&
                d.ownership !== "organization" && (
                  <ActionButton
                    confirm={data.custodyDisclosure.text}
                    action={async () => {
                      await mutate(`/devices/${d.id}/custody`, "POST", {
                        accepted: true,
                        disclosureVersion: "business-custody-v1",
                      });
                    }}
                  >
                    Declare company-owned device
                  </ActionButton>
                )}
              {can("devices:manage") && d.state === "ACTIVE" && (
                <ActionButton
                  confirm="Remotely unenrol this device? Credentials and monitoring consent will be revoked; personal measurements will be retained for their owner's privacy controls."
                  action={async () => {
                    await mutate(`/devices/${d.id}/unenrol`, "POST", {
                      confirmation: "UNENROL",
                    });
                  }}
                >
                  Remotely unenrol device
                </ActionButton>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}
