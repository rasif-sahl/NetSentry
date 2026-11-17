import { useEffect, useState } from "react";
import type { RemotePreferences } from "../main/service-types";
export function RemoteSharing({ enabled }: { enabled: boolean }) {
  const [preferences, setPreferences] = useState<RemotePreferences>();
  const [sharing, setSharing] = useState(false);
  const [control, setControl] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (enabled)
      window.netsentry
        ?.getRemotePreferences()
        .then((result) => {
          if (active && result.ok) {
            setPreferences(result.data);
            setSharing(result.data.sharing);
            setControl(result.data.control);
          }
        })
        .catch(() => {
          if (active) setMessage("Remote settings unavailable.");
        });
    return () => {
      active = false;
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <section
      className="mt-8 rounded-2xl border border-line bg-surface p-6 max-[700px]:p-[18px]"
      aria-labelledby="remote-heading"
    >
      <h2 id="remote-heading">Remote service access</h2>
      <p>
        Sharing sends up to 32 owned service summaries, project labels,
        runtimes, PIDs/start times and ports to workspace viewers. Paths,
        arguments and traffic are excluded. The paired computer owner must
        separately configure this computer’s sharing policy and named
        controllers.
      </p>
      <p>
        Command/audit records are retained for seven days, subject to the
        configured cleanup job. Cached service summaries expire quickly.
      </p>
      <p>
        Remote shutdown requires a current authorized controller, an unexpired
        command, this computer’s explicit consent and native identity checks. A
        sleeping/offline computer cannot execute immediately. Remote and local
        shutdown settings are separate.
      </p>
      {preferences && !preferences.supported && (
        <p>Native remote shutdown is unavailable on this platform.</p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            const result = await window.netsentry?.setRemotePreferences(
              sharing,
              control,
              accepted,
            );
            if (result?.ok) {
              setPreferences(result.data);
              setMessage(
                "Remote preferences saved. Review the paired computer and controller grants in the web dashboard.",
              );
            } else
              setMessage(
                "Could not save remote preferences. Check disclosure acceptance and agent availability.",
              );
          } catch {
            setMessage("Agent unavailable.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          <label>
            <input
              type="checkbox"
              checked={sharing}
              disabled={busy}
              onChange={(event) => {
                setSharing(event.target.checked);
                if (!event.target.checked) setControl(false);
              }}
            />{" "}
            Share service summaries with my workspace
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={control}
              disabled={busy || !sharing || !preferences?.supported}
              onChange={(event) => setControl(event.target.checked)}
            />{" "}
            Allow explicitly authorized remote shutdown
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(event) => setAccepted(event.target.checked)}
            />{" "}
            I accept the service-sharing disclosure (developer-sharing-v1)
          </label>
        </p>
        <button disabled={busy || ((sharing || control) && !accepted)}>
          Save remote preferences
        </button>
      </form>
      <p role="status">{message}</p>
      <p>
        Disabling sharing stops uploads; cached summaries expire.
        Revocation/unpairing clears local command receipts and resets remote
        consent. These sharing choices leave service registration to the Run at
        login controls.
      </p>
    </section>
  );
}
