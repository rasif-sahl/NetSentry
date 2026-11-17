import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import Darwin

/// Selection tokens and a bounded local lease only. Report measurements never
/// enter this store. The App Group identifier is supplied by real provisioning.
struct LocalScreenState: Codable {
    var selection = FamilyActivitySelection()
    var scope = ""
    var lease: LocalScreenLease?
    var thresholdReached = false
    var warningAt: Date?
}
enum ScreenTimeStore {
    static let settings = ManagedSettingsStore(named: ManagedSettingsStore.Name("netsentry.local"))
    static let center = DeviceActivityCenter()
    static func activity(_ id: UUID) -> DeviceActivityName {
        DeviceActivityName("netsentry.local." + id.uuidString)
    }
    static func container() throws -> URL {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "NetSentryAppGroup") as? String,
            group.hasPrefix("group."), !group.contains("$("),
            let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
        else {
            throw ClientError.unavailable(
                "A provisioned App Group is required for local Apple controls.")
        }
        return url
    }
    static func transaction<T>(_ operation: (inout LocalScreenState) throws -> T) throws -> T {
        let directory = try container(),
            lockURL = directory.appendingPathComponent("local-controls.lock")
        let fd = open(lockURL.path, O_CREAT | O_RDWR | O_NOFOLLOW, S_IRUSR | S_IWUSR)
        guard fd >= 0 else { throw ClientError.unavailable("Cannot open local control lock.") }
        defer { close(fd) }
        var acquired = false
        for _ in 0..<50 {
            if flock(fd, LOCK_EX | LOCK_NB) == 0 { acquired = true; break }; usleep(10000)
        }
        guard acquired else { throw ClientError.unavailable("Local controls are busy; try again.") }
        defer { flock(fd, LOCK_UN) }
        let file = directory.appendingPathComponent("local-controls.json")
        var state = LocalScreenState()
        if FileManager.default.fileExists(atPath: file.path) {
            let data = try Data(contentsOf: file)
            guard data.count <= 262144 else {
                throw ClientError.invalid("Invalid local control state.")
            }
            do { state = try JSONDecoder().decode(LocalScreenState.self, from: data) } catch {
                clearSettings(); state = LocalScreenState()
            }
        }
        let result: T
        do { result = try operation(&state) } catch {
            clearSettings();
            try? JSONEncoder().encode(LocalScreenState()).write(
                to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]);
            throw error
        }
        let data = try JSONEncoder().encode(state)
        guard data.count <= 262144 else { throw ClientError.invalid("Too many selections.") }
        try data.write(
            to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        return result
    }
    static func clearSettings() {
        settings.clearAllSettings();
        center.stopMonitoring(
            center.activities.filter { $0.rawValue.hasPrefix("netsentry.local.") })
    }
    static func reset(eraseSelection: Bool) throws {
        do {
            try transaction { state in
                state.lease = nil; state.thresholdReached = false; state.warningAt = nil;
                if eraseSelection { state.selection = FamilyActivitySelection(); state.scope = "" };
                clearSettings()
            }
        } catch {
            clearSettings()
            throw error
        }
    }
    static func apply(_ state: LocalScreenState) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved, let lease = state.lease,
            state.scope == lease.scope, lease.active(),
            lease.thresholdMinutes == nil || state.thresholdReached
        else { settings.clearAllSettings(); return }
        settings.shield.applications =
            state.selection.applicationTokens.isEmpty ? nil : state.selection.applicationTokens
        settings.shield.applicationCategories =
            state.selection.categoryTokens.isEmpty ? nil : .specific(state.selection.categoryTokens)
        settings.shield.webDomains =
            state.selection.webDomainTokens.isEmpty ? nil : state.selection.webDomainTokens
        settings.shield.webDomainCategories =
            state.selection.categoryTokens.isEmpty ? nil : .specific(state.selection.categoryTokens)
    }
    static func callback(
        activity: DeviceActivityName, ended: Bool = false, threshold: Bool = false,
        warning: Bool = false
    ) {
        do {
            try transaction { state in
                guard let lease = state.lease, activity == self.activity(lease.id) else { return }
                guard AuthorizationCenter.shared.authorizationStatus == .approved else {
                    state = LocalScreenState(); settings.clearAllSettings(); return
                }
                guard !ended, state.scope == lease.scope, lease.valid() else {
                    state.lease = nil; settings.clearAllSettings(); return
                }
                if threshold { state.thresholdReached = true };
                if warning { state.warningAt = Date() }
                apply(state)
            }
        } catch { clearSettings() }
    }
}
