import Foundation
import Security

/// One bounded, non-synchronizing, device-only credential record. No plaintext fallback.
final class KeychainVault: PrivateVault, @unchecked Sendable {
    private let service: String
    init(service: String) { self.service = service }
    private var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "client-state-v1", kSecAttrSynchronizable as String: false] }
    func read() throws -> Data? {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?; let status = SecItemCopyMatching(q as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data, data.count <= 131072 else { throw ClientError.unavailable("Private storage is unavailable. Unlock this device or clear local credentials.") }
        return data
    }
    func write(_ data: Data) throws {
        guard data.count <= 131072 else { throw ClientError.invalid("Private state limit exceeded.") }
        let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound { status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) }
        guard status == errSecSuccess else { throw ClientError.unavailable("Could not save private credentials. Unlock the device and review server state before retrying an action.") }
    }
    func clear() throws { let status = SecItemDelete(query as CFDictionary); guard status == errSecSuccess || status == errSecItemNotFound else { throw ClientError.unavailable("Could not clear private storage. Unlock this device and retry.") } }
}
