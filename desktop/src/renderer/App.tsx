import { Diagnostics } from "./Diagnostics";
import { BackgroundService } from "./BackgroundService";
import { Updates } from "./Updates";
import { Appearance } from "./Appearance";
import { NetworkSharing } from "./NetworkSharing";
import { RemoteSharing } from "./RemoteSharing";
import { Services } from "./Services";
import { useEffect, useState } from "react";
import type { AgentResult, AgentStatus } from "../main/agent-types";
export function App() {
  const [status, setStatus] = useState<AgentStatus>();
  const [message, setMessage] = useState("Checking the local agent…");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function perform(action: () => Promise<AgentResult> | undefined) {
    setBusy(true);
    try {
      const result = await action();
      if (result?.ok) {
        setStatus(result.status);
        setMessage("Local agent connected.");
      } else {
        setStatus(undefined);
        setMessage(
          result?.code === "PAIRING_FAILED"
            ? "Pairing failed. Check the code and backend connection."
            : "Agent unavailable. Initialize and run the Go agent, then retry.",
        );
      }
    } catch {
      setStatus(undefined);
      setMessage("Could not contact the local agent.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void perform(() => window.netsentry?.getAgentStatus());
  }, []);
  return (
    <main className="mx-auto max-w-[760px] px-6 py-16 max-[700px]:px-4 max-[700px]:py-7">
      <p className="text-[0.8rem] font-bold tracking-[0.12em] text-primary">
        NETSENTRY DESKTOP
      </p>
      <h1>Connect this computer</h1>
      <Appearance />
      <Updates />
      <Diagnostics />
      <BackgroundService
        refreshKey={`${status?.backgroundRequested}-${status?.connection}`}
      />
      <p>
        Manage the shared agent’s pairing and local preferences. Inspect
        development services and confirm local shutdown on supported macOS
        agents. Network observation sharing requires separate named-network
        setup below. Remote service access requires separate opt-in.
      </p>
      <p role="status">{message}</p>
      <button
        disabled={busy}
        onClick={() => void perform(() => window.netsentry?.getAgentStatus())}
      >
        Refresh agent status
      </button>
      {status && (
        <>
          <section
            className="mt-8 rounded-2xl border border-line bg-surface p-6 max-[700px]:p-[18px]"
            aria-labelledby="identity"
          >
            <h2 id="identity">Agent identity</h2>
            <p>
              Installation: <code>{status.installationId}</code>
            </p>
            <p>
              Version {status.version} · {status.platform} · Backend{" "}
              {status.connection}
            </p>
            <p>
              Buffered diagnostics: {status.bufferedEvents} · Dropped:{" "}
              {status.droppedEvents}
            </p>
            {status.lastContact && (
              <p>Last backend contact: {status.lastContact}</p>
            )}
            {!status.paired && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const token = code;
                  setCode("");
                  void perform(() => window.netsentry?.pairAgent(token));
                }}
              >
                <label>
                  Single-use workspace enrolment code{" "}
                  <input
                    type="password"
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    maxLength={43}
                    required
                  />
                </label>
                <p>
                  Create a code for this installation in your workspace. Pairing
                  identifies software; it does not authorize server control.
                </p>
                <button disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(code)}>
                  Pair computer
                </button>
              </form>
            )}
          </section>
          <section
            className="mt-8 rounded-2xl border border-line bg-surface p-6 max-[700px]:p-[18px]"
            aria-labelledby="modules"
          >
            <h2 id="modules">Local preferences</h2>
            <p>
              Workspace authorization is also required. Network collection
              remains unavailable. Supported macOS agents can inspect Developer
              Tools services locally.
            </p>
            {(["network", "developer"] as const).map((module) => (
              <p key={module}>
                <label>
                  <input
                    type="checkbox"
                    checked={status.requested[module]}
                    disabled={busy}
                    onChange={(event) =>
                      void perform(() =>
                        window.netsentry?.setAgentModules({
                          ...status.requested,
                          [module]: event.target.checked,
                        }),
                      )
                    }
                  />
                  {module === "network"
                    ? "Network Monitoring"
                    : "Developer Tools"}
                </label>{" "}
                — workspace{" "}
                {status.authorized[module] ? "authorized" : "not authorized"}
              </p>
            ))}
            <label>
              <input
                type="checkbox"
                checked={status.backgroundRequested}
                disabled={busy}
                onChange={(event) =>
                  void perform(() =>
                    window.netsentry?.setAgentBackground(event.target.checked),
                  )
                }
              />{" "}
              Allow background operation locally
            </label>
            <p>
              Workspace background authorization:{" "}
              {status.backgroundAllowed ? "allowed" : "not active"}. This
              permission alone does not install a service. Use Run at login to
              register it; turning this off also removes an owned registration.
            </p>
            <p>
              Remote access is off until explicitly enabled below and authorized
              in the workspace. Revoke pairing or erase agent data from
              workspace settings/API.
            </p>
          </section>
        </>
      )}
      <NetworkSharing
        enabled={Boolean(status?.paired && status.requested.network)}
      />
      <RemoteSharing
        enabled={Boolean(status?.paired && status.requested.developer)}
      />
      <Services
        enabled={Boolean(status?.paired && status.requested.developer)}
        installationId={status?.installationId || ""}
      />
    </main>
  );
}
