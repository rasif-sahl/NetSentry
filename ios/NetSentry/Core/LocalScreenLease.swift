import Foundation

/// Local controls expire within a day. A reboot or clock discontinuity invalidates
/// the lease rather than extending a restriction from an old session.
struct LocalScreenLease: Codable, Equatable, Sendable {
    let id: UUID
    let scope: String
    let createdAt: Date
    let createdUptime: TimeInterval
    let start: Date
    let end: Date
    let thresholdMinutes: Int?
    func valid(now: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime) -> Bool {
        let elapsed = uptime - createdUptime
        let parts = scope.split(separator: "/")
        return parts.count == 2 && parts.allSatisfy { UUID(uuidString: String($0)) != nil } && elapsed >= 0 && abs(now.timeIntervalSince(createdAt) - elapsed) < 60 &&
            start >= createdAt.addingTimeInterval(-5) && end.timeIntervalSince(start) >= 900 &&
            end.timeIntervalSince(createdAt) <= 86400 && now < end &&
            (thresholdMinutes == nil || (1...1440).contains(thresholdMinutes!))
    }
    func active(now: Date = Date(), uptime: TimeInterval = ProcessInfo.processInfo.systemUptime) -> Bool { valid(now: now, uptime: uptime) && now >= start }
}
