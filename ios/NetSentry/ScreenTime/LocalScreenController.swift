import SwiftUI
import FamilyControls
import DeviceActivity
import Combine

@MainActor
final class LocalScreenController: ObservableObject {
    @Published var status = "Local controls are unconfigured."
    @Published var selection = FamilyActivitySelection()
    private var subscription: AnyCancellable?
    init() {
        #if NETSENTRY_SCREEN_TIME
            subscription = AuthorizationCenter.shared.$authorizationStatus.sink { [weak self] _ in
                Task { @MainActor in self?.reconcile() }
            }
        #else
            // A default build never starts monitoring or requests authorization.
            ScreenTimeStore.clearSettings()
        #endif
    }
    func bind(scope: String) {
        #if NETSENTRY_SCREEN_TIME
            do {
                try ScreenTimeStore.transaction { state in
                    if state.scope != scope {
                        state = LocalScreenState(); ScreenTimeStore.clearSettings()
                    }
                }; reconcile()
            } catch { status = error.localizedDescription; ScreenTimeStore.clearSettings() }
        #endif
    }
    func reconcile() {
        #if NETSENTRY_SCREEN_TIME
            do {
                try ScreenTimeStore.transaction { state in
                    guard AuthorizationCenter.shared.authorizationStatus == .approved else {
                        state = LocalScreenState(); selection = FamilyActivitySelection();
                        ScreenTimeStore.clearSettings();
                        status = "Apple authorization is unavailable or revoked."; return
                    }
                    if let lease = state.lease, !lease.valid() {
                        state.lease = nil; ScreenTimeStore.clearSettings()
                    }
                    selection = state.selection; ScreenTimeStore.apply(state)
                    status =
                        state.lease == nil
                        ? "Authorized; no local schedule requested."
                        : "Local schedule requested until \(state.lease!.end.formatted()). Verify its behavior on this device."
                }
            } catch { ScreenTimeStore.clearSettings(); status = error.localizedDescription }
        #else
            status =
                "Family Controls is disabled in this build. Separate Apple approval, provisioning and device validation are required."
        #endif
    }
    func authorize(child: Bool) async {
        #if NETSENTRY_SCREEN_TIME
            do {
                _ = try ScreenTimeStore.container();
                try await AuthorizationCenter.shared.requestAuthorization(
                    for: child ? .child : .individual);
                reconcile()
            } catch { status = error.localizedDescription }
        #else
            reconcile()
        #endif
    }
    func start(scope: String, start: Date, end: Date, thresholdMinutes: Int?, accepted: Bool) {
        #if NETSENTRY_SCREEN_TIME
            do {
                let lease = LocalScreenLease(
                    id: UUID(), scope: scope, createdAt: Date(),
                    createdUptime: ProcessInfo.processInfo.systemUptime, start: start, end: end,
                    thresholdMinutes: thresholdMinutes)
                guard accepted, lease.valid(),
                    AuthorizationCenter.shared.authorizationStatus == .approved,
                    !selection.applicationTokens.isEmpty || !selection.categoryTokens.isEmpty
                        || !selection.webDomainTokens.isEmpty
                else {
                    throw ClientError.invalid(
                        "Authorize with Apple, select applications and accept a 15-minute to 24-hour local control window."
                    )
                }
                let chosen = selection
                try ScreenTimeStore.transaction { state in
                    ScreenTimeStore.clearSettings();
                    state = LocalScreenState(selection: chosen, scope: scope, lease: lease)
                    let calendar = Calendar.current
                    let schedule = DeviceActivitySchedule(
                        intervalStart: calendar.dateComponents(
                            [.year, .month, .day, .hour, .minute, .second], from: start),
                        intervalEnd: calendar.dateComponents(
                            [.year, .month, .day, .hour, .minute, .second], from: end),
                        repeats: false, warningTime: DateComponents(minute: 1))
                    var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
                    if let minutes = thresholdMinutes {
                        events[DeviceActivityEvent.Name("netsentry.threshold")] =
                            DeviceActivityEvent(
                                applications: chosen.applicationTokens,
                                categories: chosen.categoryTokens,
                                webDomains: chosen.webDomainTokens,
                                threshold: DateComponents(minute: minutes))
                    }
                    do {
                        try ScreenTimeStore.center.startMonitoring(
                            ScreenTimeStore.activity(lease.id), during: schedule, events: events);
                        ScreenTimeStore.apply(state)
                    } catch { state.lease = nil; ScreenTimeStore.clearSettings(); throw error }
                }
                reconcile()
            } catch { stop(eraseSelection: false); status = error.localizedDescription }
        #else
            reconcile()
        #endif
    }
    func stop(eraseSelection: Bool) {
        do {
            try ScreenTimeStore.reset(eraseSelection: eraseSelection);
            if eraseSelection { selection = FamilyActivitySelection() };
            status = "Requested removal of NetSentry local controls. Verify on the physical device."
        } catch {
            ScreenTimeStore.clearSettings();
            status = "Cleanup requested; verification needed. " + error.localizedDescription
        }
    }
}
