import { useEffect, useState } from "react";
import type { NetworkPreferences } from "../main/service-types";
export function NetworkSharing({ enabled }: { enabled: boolean }) {
  const [preferences, setPreferences] = useState<NetworkPreferences>();
  const [sharing, setSharing] = useState(false);
  const [networkId, setNetworkId] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (enabled)
      window.netsentry
        ?.getNetworkPreferences()
        .then((result) => {
          if (active && result.ok) {
            setPreferences(result.data);
            setSharing(result.data.sharing);
            setNetworkId(result.data.networkId);
          }
        })
        .catch(() => {
          if (active) setMessage("Network preferences unavailable.");
        });
    return () => {
      active = false;
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <section aria-labelledby="network-sharing-heading">
      <h2 id="network-sharing-heading">Network observation sharing</h2>
      <p>
        Copy the named network UUID from the web dashboard. The workspace must
        separately assign this agent to that same network. Sharing is off
        initially and never enables developer process control.
      </p>
      <p>
        With consent, the agent reads passive IPv4 interface/gateway/neighbor
        caches and may query an explicitly assigned read-only OpenWrt router
        over verified HTTPS. Addresses and hardware identifiers go to workspace
        network viewers. No active probes, packet content, per-device bandwidth
        or device blocking are implemented.
      </p>
      <p>
        Snapshots can be incomplete or cached; absence is not proof that a
        device is offline. WAN API/link health does not prove internet access.
        Actual router/model/firmware compatibility remains pending hardware
        tests. Samples/events follow thirty-day maintenance retention; bounded
        inventory stays until erasure.
      </p>
      {preferences && !preferences.supported && (
        <p>Passive network collection is unavailable on this platform.</p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            const result = await window.netsentry?.setNetworkPreferences(
              sharing,
              sharing ? networkId.trim() : "",
              accepted,
            );
            if (result?.ok) {
              setPreferences(result.data);
              setSharing(result.data.sharing);
              setNetworkId(result.data.networkId);
              setMessage(
                "Network preferences saved. Backend authorization and the named network must also match. Stopping schedules acknowledgement of withdrawn sharing; erasure is separate.",
              );
            } else
              setMessage(
                "Could not save network preferences. Check the UUID, disclosure and agent connection.",
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
            Named network UUID{" "}
            <input
              value={networkId}
              onChange={(event) => setNetworkId(event.target.value)}
              disabled={busy}
              maxLength={36}
            />
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={sharing}
              onChange={(event) => setSharing(event.target.checked)}
              disabled={busy || !preferences?.supported}
            />{" "}
            Share observations of this named network
          </label>
        </p>
        <p>
          <label>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              disabled={busy}
            />{" "}
            I accept network-sharing-v1 and have authority to monitor this
            network
          </label>
        </p>
        <button
          disabled={busy || (sharing && (!accepted || !networkId.trim()))}
        >
          Save network preferences
        </button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
