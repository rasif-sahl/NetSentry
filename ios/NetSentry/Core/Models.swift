import Foundation

struct AccountSession: Codable, Equatable, Sendable {
    var accessToken: String
    var refreshToken: String
    var user: JSONValue
    var userID: String { user["id"].text }
    func validate() throws {
        _ = try Wire.uuid(userID)
        guard accessToken.count >= 32, accessToken.count <= 4096, refreshToken.count >= 32, refreshToken.count <= 4096 else { throw ClientError.invalid("Invalid account session.") }
    }
}
struct DeviceBinding: Codable, Equatable, Sendable {
    var id: String; var workspaceID: String; var ownerID: String; var token: String; var generation: Int
    func validate() throws {
        _ = try Wire.uuid(id); _ = try Wire.uuid(workspaceID); _ = try Wire.uuid(ownerID)
        guard token.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil, generation > 0 else { throw ClientError.invalid("Invalid device binding.") }
    }
}
struct RemoteService: Codable, Equatable, Sendable {
    let serviceId: String, observationId: String
    let pid: Int
    let startedAt: String, observedAt: String, runtime: String, project: String
    let ports: [Int]; let canStop: Bool; let childCount: Int
    func validate() throws {
        _ = try Wire.uuid(observationId)
        guard serviceId.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
              pid > 1, pid <= Int32.max, ports.count <= 8, ports.allSatisfy({ (1...65535).contains($0) }),
              Set(ports).count == ports.count, (0...8192).contains(childCount), runtime.count <= 30, project.count <= 100,
              Wire.date(startedAt) != nil, Wire.date(observedAt) != nil else { throw ClientError.invalid("Invalid remote service observation.") }
    }
}
struct PairedComputer: Codable, Equatable, Sendable {
    let id: String, name: String, platform: String, connection: String
    let canControl: Bool, canManage: Bool, sharingAllowed: Bool, localControlReady: Bool, platformSupported: Bool
    let reportedAt: String?; let services: [RemoteService]
    func validate() throws { _ = try Wire.uuid(id); guard services.count <= 32 else { throw ClientError.invalid("Service inventory limit exceeded.") }; for s in services { try s.validate() } }
}
struct RemoteIntent: Codable, Equatable, Sendable {
    let userID: String, workspaceID: String, agentID: String, requestID: String
    let service: RemoteService
    let mode: String, includeChildren: Bool, confirmedAt: Date
    var body: JSONValue { .object(["requestId": .string(requestID), "serviceId": .string(service.serviceId), "observationId": .string(service.observationId), "mode": .string(mode), "includeChildren": .bool(includeChildren)]) }
    func validate(now: Date, computer: PairedComputer) throws {
        _ = try Wire.uuid(userID); _ = try Wire.uuid(workspaceID); _ = try Wire.uuid(agentID); _ = try Wire.uuid(requestID)
        try service.validate()
        guard ["graceful", "force"].contains(mode), computer.id == agentID, computer.canControl,
              computer.connection == "online", computer.sharingAllowed, computer.localControlReady, computer.platformSupported,
              service.canStop, computer.services.contains(service), !includeChildren || service.childCount <= 16,
              let observed = Wire.date(service.observedAt), now >= observed, now.timeIntervalSince(observed) <= 10,
              now >= confirmedAt, now.timeIntervalSince(confirmedAt) <= 10 else {
            throw ClientError.invalid("Refresh the computer, review its current grants and select a fresh service.")
        }
    }
}
struct StoredClientState: Codable, Sendable {
    var schemaVersion = 1
    var installationID = UUID().uuidString.lowercased()
    var base = ""
    var session: AccountSession?
    var workspaceID = ""
    var device: DeviceBinding?
    var pendingStop: RemoteIntent?
}
struct ScopeTicket: Equatable, Sendable { let epoch: Int; let userID: String; let workspaceID: String }
struct ClientSnapshot: Sendable {
    let signedIn: Bool, base: String, user: JSONValue, workspaceID: String
    let workspaces: [JSONValue], devices: [JSONValue], computers: [PairedComputer]
    let commands: [String: [JSONValue]], report: JSONValue, rules: [JSONValue], alerts: [JSONValue], notifications: [JSONValue]
    let disclosures: JSONValue, preferences: JSONValue, subscription: JSONValue, business: JSONValue, family: JSONValue, child: JSONValue
    let pendingStop: RemoteIntent?, device: DeviceBinding?
}
