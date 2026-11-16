"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import type { Member } from "@/lib/types";
import type { PageContext } from "./dashboard-shell";
import {
  ActionForm,
  ActionButton,
  Card,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  formatTime,
} from "../ui/common";
type Service = {
  serviceId: string;
  observationId: string;
  pid: number;
  startedAt: string;
  observedAt: string;
  runtime: string;
  project: string;
  ports: number[];
  canStop: boolean;
  childCount: number;
};
type Computer = {
  id: string;
  name: string;
  platform: string;
  state: string;
  ownerId: string;
  connection: string;
  sharingAllowed: boolean;
  controllers: string[];
  canManage: boolean;
  canControl: boolean;
  localControlReady: boolean;
  platformSupported: boolean;
  reportedAt: string | null;
  total: number;
  services: Service[];
};
type Command = {
  id: string;
  requestId: string;
  requesterId: string;
  target: Service;
  mode: string;
  includeChildren: boolean;
  state: string;
  outcome: string | null;
  requestedAt: string;
  expiresAt: string;
  startedAt: string | null;
  audit: { id: string; event: string; outcome: string; occurredAt: string }[];
};
export function DeveloperPanel(context: PageContext) {
  const path = `/workspaces/${context.workspace.id}`;
  const resource = useResource<Computer[]>(`${path}/developer`);
  const disclosure = useResource<{ version: string; text: string }>(
    "/agents/developer-disclosure",
  );
  const members = useResource<Member[]>(`${path}/members`);
  const reloadComputers = resource.reload;
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine)
        reloadComputers();
    }, 5000);
    return () => clearInterval(id);
  }, [reloadComputers]);
  return (
    <>
      <Notice>
        Remote actions require explicit computer consent and named controller
        grants. Sleeping, disconnected or revoked computers are unavailable.
        Acceptance is not confirmed shutdown; inspect the recorded outcome.
        Android/iOS UI and physical-device checks remain later phases.
      </Notice>
      <details>
        <summary>Service-sharing disclosure</summary>
        <ErrorNotice error={disclosure.error} />
        <p>{disclosure.data?.text || "Loading disclosure…"}</p>
      </details>
      <Card title="Paired developer computers">
        <button className="button" onClick={() => resource.reload()}>
          Refresh computers
        </button>
        <ErrorNotice error={resource.error} />
        {resource.loading && <Loading />}
        {resource.data?.length === 0 && (
          <Empty title="No paired computers">
            Pair the Go agent with the desktop first. Then enable sharing
            locally and grant workspace access here.
          </Empty>
        )}
        {resource.data?.map((computer) => (
          <ComputerPanel
            key={`${context.workspace.id}/${computer.id}`}
            computer={computer}
            path={path}
            userId={context.user.id}
            members={members.data || []}
            permissions={context.permissions}
            refresh={resource.reload}
          />
        ))}
      </Card>
    </>
  );
}
function ComputerPanel({
  computer: c,
  path,
  userId,
  members,
  permissions,
  refresh,
}: {
  computer: Computer;
  path: string;
  userId: string;
  members: Member[];
  permissions: string[];
  refresh: () => void;
}) {
  const base = `${path}/agents/${c.id}`;
  const history = useResource<Command[]>(`${base}/commands`);
  const [selected, setSelected] = useState<{
    target: Service;
    mode: "graceful" | "force";
    requestId: string;
  }>();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const reloadHistory = history.reload;
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") reloadHistory();
    }, 5000);
    return () => clearInterval(id);
  }, [reloadHistory]);
  const stale = selected
    ? now - Date.parse(selected.target.observedAt) > 10000
    : true;
  return (
    <article className="card">
      <h3>{c.name}</h3>
      <p>
        {c.platform} · {c.connection} · {c.state.toLowerCase()}
      </p>
      <p>
        Last service report:{" "}
        {c.reportedAt ? formatTime(c.reportedAt) : "Not reported"}.{" "}
        {c.localControlReady
          ? "Computer remote consent reported."
          : "Remote shutdown is not enabled on the computer."}
      </p>
      {!c.platformSupported && (
        <p>Native remote capabilities have not been reported as available.</p>
      )}
      {c.canManage && permissions.includes("services:control") && (
        <details>
          <summary>Sharing and controller grants</summary>
          <ActionForm
            key={`${c.sharingAllowed}/${c.controllers.join()}`}
            submit="Save developer sharing policy"
            action={async (form) => {
              await api(`${base}/developer-policy`, "PATCH", {
                sharingAllowed: form.get("sharing") === "on",
                controllers:
                  form.get("sharing") === "on"
                    ? form.getAll("controllers")
                    : [],
                accepted: form.get("accepted") === "on",
                disclosureVersion: "developer-sharing-v1",
              });
              refresh();
              history.reload();
              return "Policy updated. Current pending commands are invalidated; the agent must publish a fresh report.";
            }}
          >
            <Notice>
              This shares up to 32 service summaries with workspace viewers.
              Controllers must additionally have an owner/admin role and
              explicit consent on the computer. No arbitrary shell command can
              be sent.
            </Notice>
            <Field label="Allow service sharing">
              <input
                type="checkbox"
                name="sharing"
                defaultChecked={c.sharingAllowed}
              />
            </Field>
            {members
              .filter((m) => ["OWNER", "ADMIN"].includes(m.role))
              .map((m) => (
                <Field
                  key={m.userId}
                  label={`Allow ${m.displayName} (${m.role}) to request shutdown`}
                >
                  <input
                    type="checkbox"
                    name="controllers"
                    value={m.userId}
                    defaultChecked={c.controllers.includes(m.userId)}
                  />
                </Field>
              ))}
            <Field label="I accept developer-sharing-v1">
              <input type="checkbox" name="accepted" required />
            </Field>
          </ActionForm>
        </details>
      )}
      {!c.services.length && (
        <Empty
          title={
            c.connection === "revoked"
              ? "Pairing revoked"
              : c.connection !== "online"
                ? "Computer unavailable"
                : "No shared development services"
          }
        />
      )}
      {c.total > c.services.length && (
        <Notice>
          Showing the first {c.services.length} of {c.total} owned listeners.
          Additional services are outside the current sharing limit.
        </Notice>
      )}
      <ul className="item-list">
        {c.services.map((s) => (
          <li key={s.serviceId}>
            <div>
              <strong>
                {s.project} · {s.runtime}
              </strong>
              <small>
                PID {s.pid} · Ports {s.ports.join(", ")} · Started{" "}
                {formatTime(s.startedAt)}
              </small>
              <small>
                Observed {formatTime(s.observedAt)} · {s.childCount} captured
                descendants
              </small>
            </div>
            <div className="actions">
              <button
                className="button"
                disabled={
                  !c.canControl ||
                  !s.canStop ||
                  now - Date.parse(s.observedAt) > 10000
                }
                onClick={() =>
                  setSelected({
                    target: s,
                    mode: "graceful",
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                Request graceful stop
              </button>
              <button
                className="button danger"
                disabled={
                  !c.canControl ||
                  !s.canStop ||
                  now - Date.parse(s.observedAt) > 10000
                }
                onClick={() =>
                  setSelected({
                    target: s,
                    mode: "force",
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                Request force-stop
              </button>
            </div>
          </li>
        ))}
      </ul>
      {selected && (
        <Card
          title={
            selected.mode === "force"
              ? "Confirm remote force-stop"
              : "Confirm remote graceful stop"
          }
        >
          <p>
            {selected.target.project} · PID {selected.target.pid} · Ports{" "}
            {selected.target.ports.join(", ")}. This targets the captured
            process and all its listeners. A supervisor may replace it.
          </p>
          <Notice tone={selected.mode === "force" ? "error" : "info"}>
            {selected.mode === "force"
              ? "SIGKILL may discard unfinished work. This is a separate explicit action."
              : "SIGTERM may be ignored. A delivery acknowledgement is not success."}
          </Notice>
          {stale ? (
            <Notice tone="error">
              The selected report expired. Refresh and choose the service again.
            </Notice>
          ) : (
            <ActionForm
              submit="Confirm remote command"
              action={async (form) => {
                const result = await api<Command>(`${base}/commands`, "POST", {
                  requestId: selected.requestId,
                  serviceId: selected.target.serviceId,
                  observationId: selected.target.observationId,
                  mode: selected.mode,
                  includeChildren: form.get("children") === "on",
                });
                history.reload();
                return `Command ${result.state}. Refresh command history for the agent-confirmed outcome; do not assume shutdown.`;
              }}
            >
              <Field label="Include captured descendants (maximum 16)">
                <input
                  name="children"
                  type="checkbox"
                  disabled={selected.target.childCount > 16}
                />
              </Field>
              <Field label="I confirm this exact target and action">
                <input type="checkbox" required />
              </Field>
            </ActionForm>
          )}
          <button
            className="button secondary"
            onClick={() => setSelected(undefined)}
          >
            Close confirmation
          </button>
        </Card>
      )}
      <h4>Remote command history</h4>
      <button className="button secondary" onClick={() => history.reload()}>
        Refresh commands
      </button>
      <ErrorNotice error={history.error} />
      {history.data?.length === 0 && <p>No remote commands yet.</p>}
      <ul className="item-list">
        {history.data?.map((command) => (
          <li key={command.id}>
            <div>
              <strong>
                {command.target.project} · PID {command.target.pid} ·{" "}
                {command.mode}
              </strong>
              <small>
                {command.state} · {command.outcome || "Outcome not confirmed"} ·
                Expires {formatTime(command.expiresAt)}
              </small>
              <small>
                {command.startedAt
                  ? "Execution started; cancellation cannot undo it."
                  : "Execution has not been authorized to start."}
              </small>
              <details>
                <summary>Audit events</summary>
                <ol>
                  {command.audit.map((a) => (
                    <li key={a.id}>
                      {a.event} {a.outcome} · {formatTime(a.occurredAt)}
                    </li>
                  ))}
                </ol>
              </details>
            </div>
            {["pending", "accepted"].includes(command.state) &&
              !command.startedAt &&
              c.canControl &&
              (command.requesterId === userId || c.ownerId === userId) && (
                <ActionButton
                  action={async () => {
                    await api(`${base}/commands/${command.id}/cancel`, "POST");
                    history.reload();
                    return;
                  }}
                >
                  Cancel command
                </ActionButton>
              )}
          </li>
        ))}
      </ul>
    </article>
  );
}
