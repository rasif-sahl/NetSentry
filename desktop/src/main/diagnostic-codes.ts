// Public, fixed vocabulary. Never include OS/backend error text in reports.
export const diagnosticCodes = {
  TRUSTED_APP: ["Signed app and agent verified.", ""],
  PLATFORM_UNSUPPORTED: [
    "This operation requires the packaged macOS application.",
    "Use the supported macOS desktop build.",
  ],
  APP_PLACEMENT: [
    "The app is outside its supported Applications location.",
    "Remove any old service, then install NetSentry.app in Applications.",
  ],
  SIGNING_REQUIRED: [
    "The app or bundled agent could not be verified.",
    "Use a trusted signed build with the configured signing team. Unsigned previews cannot run recovery.",
  ],
  STATE_MISSING: [
    "Agent state has not been initialized.",
    "Initialize and pair the agent in the foreground.",
  ],
  STATE_UNSAFE: [
    "Private agent state has unsafe permissions or a linked path.",
    "Review state ownership and permissions manually; no automatic repair is offered.",
  ],
  LOCK_UNAVAILABLE: [
    "The agent runtime lock could not be verified.",
    "Review private state permissions before retrying.",
  ],
  RUNTIME_BUSY: [
    "Another agent or lifecycle helper holds the installation lock.",
    "Stop the foreground agent normally or remove its background service, then retry. Other checks were skipped.",
  ],
  SOCKET_ABSENT: ["No local socket remains.", "No socket repair is needed."],
  SOCKET_STALE: [
    "A private socket remains without a listener.",
    "Remove any registered background service, then use Repair stale socket.",
  ],
  SOCKET_LIVE: [
    "A process is listening on the socket.",
    "Recovery will not stop or replace it. Stop the process normally and retry.",
  ],
  SOCKET_UNSAFE: [
    "The socket path is not an owned private socket.",
    "Inspect the conflict manually. Files and symlinks are never removed by recovery.",
  ],
  SOCKET_UNKNOWN: [
    "The socket's listener state could not be established.",
    "Retry after resolving permissions or system errors; recovery is blocked.",
  ],
  SOCKET_CHANGED: [
    "The socket changed during inspection.",
    "No repair was performed. Refresh diagnostics.",
  ],
  SOCKET_REPAIRED: [
    "The unchanged stale socket was removed.",
    "Start the foreground agent or explicitly register its background service when ready.",
  ],
  CONFIG_INVALID: [
    "Agent configuration could not be validated.",
    "Review the private configuration; recovery does not reset it.",
  ],
  CREDENTIALS_UNAVAILABLE: [
    "Pairing credentials could not be read or validated.",
    "Review Keychain access and pairing in the foreground. No credential was changed.",
  ],
  PAIRING_REQUIRED: [
    "A matching paired identity is required.",
    "Pair the foreground agent with the intended workspace.",
  ],
  PAIRING_REJECTED: [
    "The backend rejected this paired identity or its access.",
    "Review device revocation and workspace access, then reconcile in the foreground.",
  ],
  PAIRING_STALE: [
    "The pairing generation needs reconciliation.",
    "Run the foreground agent to reconcile before retrying background startup.",
  ],
  LOCAL_BACKGROUND_DISABLED: [
    "Local background consent is off.",
    "Register/Start requires a separate explicit confirmation; diagnostics never enables it.",
  ],
  LOCAL_BACKGROUND_ENABLED: [
    "Local background consent is on.",
    "Workspace authorization and module permissions are still required.",
  ],
  WORKSPACE_BACKGROUND_DENIED: [
    "The workspace has not authorized background operation.",
    "Ask an authorized workspace administrator to review the device's background grant.",
  ],
  WORKSPACE_BACKGROUND_ALLOWED: [
    "A fresh matching workspace background grant was verified.",
    "This does not grant module or process shutdown permission.",
  ],
  BACKEND_UNAVAILABLE: [
    "The backend connection or configuration response could not be verified.",
    "Check connectivity, HTTPS and backend health, then retry.",
  ],
  BACKEND_REJECTED: [
    "The backend did not accept the configuration check.",
    "Review backend availability or rate limits, then retry.",
  ],
  SERVICE_RUNNING: [
    "The managed service process is running.",
    "Remove the background service before attempting socket recovery.",
  ],
  SERVICE_REGISTERED: [
    "A background service remains registered or loaded.",
    "Remove it before recovery to prevent login startup racing with repair.",
  ],
  SERVICE_INCOMPLETE: [
    "Partial service registration records remain.",
    "Use Remove background service to clear owned records, then register again explicitly. Pairing and stored data are preserved.",
  ],
  SERVICE_ABSENT: [
    "No managed background service is registered or loaded.",
    "",
  ],
  SERVICE_CONFLICT: [
    "Service ownership or operating-system state could not be verified.",
    "Review the job, plist and receipt manually; automatic cleanup is blocked.",
  ],
  START_FAILED: [
    "Service startup was not confirmed.",
    "Run diagnostics; after resolving the cause, explicitly choose Start.",
  ],
  STOP_FAILED: [
    "Service removal was not confirmed.",
    "Refresh status before retrying removal. Ownership evidence has been retained.",
  ],
  OPERATION_FAILED: [
    "The operation could not be verified.",
    "Refresh diagnostics before retrying. No unknown process or file will be removed.",
  ],
  REPAIR_CANCELLED: [
    "Socket recovery was cancelled.",
    "No socket was changed.",
  ],
  REPAIR_BLOCKED: [
    "Socket recovery is blocked by current diagnostics.",
    "Resolve the reported conditions, then check again.",
  ],
  EXPORT_SAVED: ["Redacted diagnostics were saved.", ""],
  EXPORT_CANCELLED: ["Diagnostic export was cancelled.", ""],
  EXPORT_FAILED: [
    "The report could not be saved.",
    "Choose a new writable file name. Existing files are not overwritten.",
  ],
} as const;
export type DiagnosticCode = keyof typeof diagnosticCodes;
export function isDiagnosticCode(value: unknown): value is DiagnosticCode {
  return typeof value === "string" && Object.hasOwn(diagnosticCodes, value);
}
export class DiagnosticFailure extends Error {
  constructor(readonly code: DiagnosticCode) {
    super(code);
  }
}
export function failureCode(error: unknown): DiagnosticCode {
  return error instanceof DiagnosticFailure ? error.code : "OPERATION_FAILED";
}
export function diagnosticMessage(code: DiagnosticCode) {
  return diagnosticCodes[code].filter(Boolean).join(" ");
}
// CLI output is projected into this subset, never trusted as arbitrary messages.
export const agentCodes = new Set<DiagnosticCode>([
  "PLATFORM_UNSUPPORTED",
  "STATE_MISSING",
  "STATE_UNSAFE",
  "LOCK_UNAVAILABLE",
  "RUNTIME_BUSY",
  "SOCKET_ABSENT",
  "SOCKET_STALE",
  "SOCKET_LIVE",
  "SOCKET_UNSAFE",
  "SOCKET_UNKNOWN",
  "SOCKET_CHANGED",
  "SOCKET_REPAIRED",
  "CONFIG_INVALID",
  "CREDENTIALS_UNAVAILABLE",
  "PAIRING_REQUIRED",
  "PAIRING_REJECTED",
  "PAIRING_STALE",
  "LOCAL_BACKGROUND_DISABLED",
  "LOCAL_BACKGROUND_ENABLED",
  "WORKSPACE_BACKGROUND_DENIED",
  "WORKSPACE_BACKGROUND_ALLOWED",
  "BACKEND_UNAVAILABLE",
  "BACKEND_REJECTED",
]);
