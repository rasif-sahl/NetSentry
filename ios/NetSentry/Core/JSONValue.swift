import Foundation

enum ClientError: Error, LocalizedError, Equatable {
    case invalid(String), unavailable(String), denied, signedOut, changedScope, http(Int, String)
    var errorDescription: String? {
        switch self {
        case .invalid(let text), .unavailable(let text): return text
        case .denied: return "Access changed. Refresh your workspace and permissions."
        case .signedOut: return "Sign in again; the session could not be renewed."
        case .changedScope: return "The account or workspace changed. Refresh before continuing."
        case .http(_, let text): return text
        }
    }
}

indirect enum JSONValue: Codable, Hashable, Sendable {
    case object([String: JSONValue]), array([JSONValue]), string(String), number(Double), bool(Bool), null
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let value = try? c.decode(Bool.self) { self = .bool(value) }
        else if let value = try? c.decode(String.self) { self = .string(value) }
        else if let value = try? c.decode(Double.self), value.isFinite { self = .number(value) }
        else if let value = try? c.decode([JSONValue].self) { self = .array(value) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .number(let v): guard v.isFinite else { throw ClientError.invalid("Invalid number.") }; try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
    subscript(_ key: String) -> JSONValue { if case .object(let v) = self { return v[key] ?? .null }; return .null }
    var text: String { if case .string(let v) = self { return v }; return "" }
    var flag: Bool { if case .bool(let v) = self { return v }; return false }
    var values: [JSONValue] { if case .array(let v) = self { return v }; return [] }
    var integer: Int? { if case .number(let v) = self, v.rounded() == v, v >= Double(Int32.min), v <= Double(Int32.max) { return Int(v) }; return nil }
    var isNull: Bool { self == .null }
    func requiredText(_ key: String) throws -> String {
        guard case .string(let value) = self[key], !value.isEmpty else { throw ClientError.invalid("The server returned an incomplete response.") }
        return value
    }
    static func strings(_ values: [String]) -> JSONValue { .array(values.map(JSONValue.string)) }
    static func int(_ value: Int) -> JSONValue { .number(Double(value)) }
    func decoded<T: Decodable>(_ type: T.Type) throws -> T { try JSONDecoder().decode(type, from: JSONEncoder().encode(self)) }
    var pretty: String { let e = JSONEncoder(); e.outputFormatting = [.prettyPrinted, .sortedKeys]; return (try? String(data: e.encode(self), encoding: .utf8)) ?? "Unavailable" }
}

struct APIReply: Sendable { let status: Int; let value: JSONValue }
protocol APITransport: Sendable {
    func send(base: URL, method: String, path: String, query: [String: String], token: String?, body: JSONValue?) async throws -> APIReply
}
protocol PrivateVault: Sendable {
    func read() throws -> Data?
    func write(_ data: Data) throws
    func clear() throws
}
