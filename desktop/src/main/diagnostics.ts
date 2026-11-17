import {
  diagnosticCodes,
  diagnosticMessage,
  failureCode,
  isDiagnosticCode,
  agentCodes,
  type DiagnosticCode,
} from "./diagnostic-codes.js";
import type { BackgroundView } from "./background-service.js";
export type DiagnosticCheck = {
  code: DiagnosticCode;
  message: string;
  nextStep: string;
};
export type DiagnosticReport = {
  schemaVersion: 1;
  checkedAt: string;
  environment: { platform: string; architecture: string; appVersion: string };
  checks: DiagnosticCheck[];
  canRepair: boolean;
  outcome?: DiagnosticCode;
};
export interface DiagnosticPorts {
  trusted(): Promise<void>;
  service(): Promise<BackgroundView>;
  agent(repair: boolean): Promise<DiagnosticCode[]>;
}
export function parseAgentDiagnostics(value: unknown): DiagnosticCode[] {
  if (!value || typeof value !== "object")
    throw new Error("Invalid diagnostic result.");
  const result = value as { schemaVersion?: unknown; codes?: unknown };
  if (
    Object.keys(value).sort().join(",") !== "codes,schemaVersion" ||
    result.schemaVersion !== 1 ||
    !Array.isArray(result.codes) ||
    result.codes.length < 1 ||
    result.codes.length > 4 ||
    result.codes.some(
      (code) => !isDiagnosticCode(code) || !agentCodes.has(code),
    ) ||
    new Set(result.codes).size !== result.codes.length
  )
    throw new Error("Invalid diagnostic result.");
  const codes = result.codes as DiagnosticCode[];
  const sockets = new Set([
    "SOCKET_ABSENT",
    "SOCKET_STALE",
    "SOCKET_LIVE",
    "SOCKET_UNSAFE",
    "SOCKET_UNKNOWN",
    "SOCKET_CHANGED",
    "SOCKET_REPAIRED",
  ]);
  if (
    codes.length > 1 &&
    (!sockets.has(codes[0]) ||
      (codes.length === 2
        ? codes[1] !== "CONFIG_INVALID"
        : codes.length !== 3 ||
          !["LOCAL_BACKGROUND_DISABLED", "LOCAL_BACKGROUND_ENABLED"].includes(
            codes[1],
          ) ||
          ![
            "CREDENTIALS_UNAVAILABLE",
            "PAIRING_REQUIRED",
            "PAIRING_REJECTED",
            "PAIRING_STALE",
            "CONFIG_INVALID",
            "WORKSPACE_BACKGROUND_DENIED",
            "WORKSPACE_BACKGROUND_ALLOWED",
            "BACKEND_UNAVAILABLE",
            "BACKEND_REJECTED",
          ].includes(codes[2])))
  )
    throw new Error("Inconsistent diagnostic result.");
  return codes;
}
export class DesktopDiagnostics {
  constructor(
    private readonly ports: DiagnosticPorts,
    private readonly environment: DiagnosticReport["environment"],
  ) {}
  async scan(): Promise<DiagnosticReport> {
    const codes: DiagnosticCode[] = [];
    const report = (): DiagnosticReport => ({
      schemaVersion: 1,
      checkedAt: new Date().toISOString(),
      environment: { ...this.environment },
      checks: [...new Set(codes)].map((code) => ({
        code,
        message: diagnosticCodes[code][0],
        nextStep: diagnosticCodes[code][1],
      })),
      canRepair:
        codes.includes("TRUSTED_APP") &&
        codes.includes("SERVICE_ABSENT") &&
        codes.includes("SOCKET_STALE") &&
        !codes.includes("CONFIG_INVALID") &&
        !codes.includes("OPERATION_FAILED"),
    });
    // The owned service can be inspected even when executing its binary is unsafe.
    try {
      const service = await this.ports.service();
      codes.push(
        !service.verified
          ? "SERVICE_CONFLICT"
          : service.recoveryRequired
            ? "SERVICE_INCOMPLETE"
            : service.running
              ? "SERVICE_RUNNING"
              : service.registered || service.loaded
                ? "SERVICE_REGISTERED"
                : "SERVICE_ABSENT",
      );
    } catch {
      codes.push("SERVICE_CONFLICT");
    }
    try {
      await this.ports.trusted();
      codes.push("TRUSTED_APP");
    } catch (error) {
      codes.push(failureCode(error));
      return report();
    }
    try {
      codes.push(
        ...parseAgentDiagnostics({
          schemaVersion: 1,
          codes: await this.ports.agent(false),
        }),
      );
    } catch {
      codes.push("OPERATION_FAILED");
    }
    return report();
  }
  async repair(confirm: () => Promise<boolean>): Promise<DiagnosticReport> {
    const before = await this.scan();
    if (!before.canRepair) return { ...before, outcome: "REPAIR_BLOCKED" };
    if (!(await confirm())) return { ...before, outcome: "REPAIR_CANCELLED" };
    // Recheck placement/trust, service state and socket after the native dialog.
    const current = await this.scan();
    if (!current.canRepair) return { ...current, outcome: "REPAIR_BLOCKED" };
    let outcome: DiagnosticCode = "OPERATION_FAILED";
    try {
      const codes = parseAgentDiagnostics({
        schemaVersion: 1,
        codes: await this.ports.agent(true),
      });
      if (codes.length === 1) outcome = codes[0];
    } catch {}
    return { ...(await this.scan()), outcome };
  }
}
// Export a positive allowlist, never logs, paths, backend errors, IDs or tokens.
export function redactedReport(report: DiagnosticReport): string {
  return (
    JSON.stringify(
      {
        schemaVersion: 1,
        checkedAt: report.checkedAt,
        environment: {
          platform: report.environment.platform,
          architecture: report.environment.architecture,
          appVersion: report.environment.appVersion,
        },
        checks: report.checks.map((check) => {
          const code = isDiagnosticCode(check.code)
            ? check.code
            : "OPERATION_FAILED";
          return {
            code,
            message: diagnosticCodes[code][0],
            nextStep: diagnosticCodes[code][1],
          };
        }),
        canRepair: report.canRepair,
        ...(report.outcome && isDiagnosticCode(report.outcome)
          ? {
              outcome: report.outcome,
              outcomeMessage: diagnosticMessage(report.outcome),
            }
          : {}),
      },
      null,
      2,
    ) + "\n"
  );
}
