import { useState } from "react";
import type { DiagnosticReport } from "../main/diagnostics";
import { diagnosticMessage } from "../main/diagnostic-codes";
export function Diagnostics() {
  const [report, setReport] = useState<DiagnosticReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function action(value: "check" | "repair" | "export") {
    setBusy(true);
    setError("");
    try {
      const next = await window.netsentry?.desktopDiagnostics?.(value);
      if (next) setReport(next);
      else setError("Diagnostics are available in the desktop application.");
    } catch {
      setError(
        "Diagnostics could not complete. Retry after any other desktop operation finishes.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="desktop-card" aria-labelledby="diagnostics-heading">
      <h2 id="diagnostics-heading">Diagnostics and recovery</h2>
      <p>
        Check app trust, service ownership, runtime lock, local socket and
        background eligibility. Checks may request Keychain access and contact
        the paired backend; they never enable monitoring or change consent.
      </p>
      <p>
        Remove a registered background service before recovery. Repair only
        removes a verified stale socket; it never starts or stops processes.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button disabled={busy} onClick={() => void action("check")}>
          Check desktop diagnostics
        </button>
        <button
          disabled={busy || !report?.canRepair}
          onClick={() => void action("repair")}
        >
          Repair stale socket
        </button>
        <button
          disabled={busy || !report}
          onClick={() => void action("export")}
        >
          Export redacted diagnostics
        </button>
      </div>
      <p role="status">
        {busy
          ? "Checking desktop diagnostics…"
          : error ||
            (report?.outcome
              ? diagnosticMessage(report.outcome)
              : "Checks run only when you request them.")}
      </p>
      {report && (
        <>
          <p>Last checked: {new Date(report.checkedAt).toLocaleString()}</p>
          <ul className="mt-4 space-y-3">
            {report.checks.map((check) => (
              <li key={check.code}>
                <strong>{check.message}</strong>
                {check.nextStep && <p>{check.nextStep}</p>}
                <span className="text-xs text-muted">{check.code}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        Exports contain fixed check results, time and app/platform versions.
        They exclude credentials, device/workspace identifiers, addresses,
        project names, filesystem paths and raw logs.
      </p>
    </section>
  );
}
