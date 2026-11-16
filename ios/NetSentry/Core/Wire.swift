import Foundation

enum Wire {
    static func uuid(_ value: String) throws -> String {
        guard let id = UUID(uuidString: value), id.uuidString.lowercased() == value.lowercased() else { throw ClientError.invalid("Invalid identifier.") }; return id.uuidString.lowercased()
    }
    static func base(_ value: String) throws -> URL {
        guard let c = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)), c.scheme == "https", let host = c.host, !host.isEmpty,
              c.user == nil, c.password == nil, c.query == nil, c.fragment == nil,
              c.percentEncodedPath == "/api/v1", c.port == nil || (1...65535).contains(c.port!), let url = c.url else { throw ClientError.invalid("Use an HTTPS API address ending in /api/v1 without credentials or query parameters.") }; return url
    }
    static func url(base: URL, path: String, query: [String: String]) throws -> URL {
        guard path.hasPrefix("/"), !path.contains("//"), !path.contains(".."), path.range(of: "^/[A-Za-z0-9_./-]+$", options: .regularExpression) != nil,
              var c = URLComponents(url: base, resolvingAgainstBaseURL: false) else { throw ClientError.invalid("Invalid API path.") }
        c.percentEncodedPath += path; c.queryItems = query.isEmpty ? nil : query.sorted(by: { $0.key < $1.key }).map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = c.url else { throw ClientError.invalid("Invalid API URL.") }; return url
    }
    static func stamp(_ date: Date = Date()) -> String { let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f.string(from: date) }
    static func date(_ value: String) -> Date? {
        guard value.range(of: "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$", options: .regularExpression) != nil else { return nil }
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f.date(from: value)
    }
    static func dates(period: String, timezone: String, now: Date = Date()) throws -> (String, String) {
        guard let zone = TimeZone(identifier: timezone), ["day", "week", "month"].contains(period) else { throw ClientError.invalid("Choose a valid period and timezone.") }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone; calendar.firstWeekday = 2
        let today = calendar.startOfDay(for: now)
        let start: Date
        if period == "week" { start = calendar.date(byAdding: .day, value: -((calendar.component(.weekday, from: today) + 5) % 7), to: today)! }
        else if period == "month" { start = calendar.date(from: calendar.dateComponents([.year, .month], from: today))! }
        else { start = today }
        let end = calendar.date(byAdding: .day, value: 1, to: today)!
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = zone; f.dateFormat = "yyyy-MM-dd"
        return (f.string(from: start), f.string(from: end))
    }
    static func capabilities(workspaceID: String, deviceID: String, now: Date = Date()) -> JSONValue {
        let at = stamp(now)
        let fields: [(String, String, String)] = [
            ("network.mobile_data", "restricted_by_os", "General iOS device-wide mobile usage export is unavailable."),
            ("network.wifi_data", "restricted_by_os", "General iOS Wi-Fi and per-client usage export is unavailable."),
            ("usage.screen_time", "temporarily_unavailable", "Apple-authorized reports remain inside the Device Activity report extension; native build and device checks are pending."),
            ("policy.app_shield", "temporarily_unavailable", "Local Screen Time source needs separate Apple provisioning, authorization and explicit local consent."),
            ("notifications.push", "temporarily_unavailable", "APNs provider and distribution registration are not configured.")]
        return .object(["schemaVersion": .int(1), "workspaceId": .string(workspaceID), "deviceId": .string(deviceID), "reportedAt": .string(at), "capabilities": .array(fields.map { id, status, reason in
            .object(["id": .string(id), "status": .string(status), "reason": .string(reason), "source": .string("os"), "checkedAt": .string(at), "requiredSetup": .strings(["Review platform-specific setup and physical-device validation"]), "availableActions": .array([])])
        })])
    }
}
