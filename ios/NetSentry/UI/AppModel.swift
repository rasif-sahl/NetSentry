import SwiftUI

@MainActor
final class AppModel: ObservableObject {
    @Published var snapshot: ClientSnapshot?
    @Published var busy = false
    @Published var message = ""
    @Published var exportText = ""
    @Published var sessions: JSONValue = .null
    @Published var repository: ClientRepository?
    let local = LocalScreenController()
    private let vault = KeychainVault(service: "com.netsentry.native.client")
    init() { do { repository = try ClientRepository(vault: vault) } catch { message = error.localizedDescription } }
    func run(_ operation: @escaping (ClientRepository) async throws -> Void) {
        guard !busy, let repository else { return }
        busy = true; message = ""
        Task {
            do { try await operation(repository) } catch { message = error.localizedDescription }
            let next = await repository.snapshot()
            if (snapshot != nil && (snapshot?.user["id"].text != next.user["id"].text || snapshot?.workspaceID != next.workspaceID)) || !next.signedIn { exportText = ""; sessions = .null; local.stop(eraseSelection: true) }
            snapshot = next; local.bind(scope: next.signedIn && !next.workspaceID.isEmpty ? next.user["id"].text + "/" + next.workspaceID : ""); busy = false
        }
    }
    func bootstrap() async {
        guard let repository else { return }; let saved = await repository.snapshot(); snapshot = saved
        local.bind(scope: saved.signedIn && !saved.workspaceID.isEmpty ? saved.user["id"].text + "/" + saved.workspaceID : "")
        if saved.signedIn { run { try await $0.refresh() } }
    }
    func recoverLocal() {
        local.stop(eraseSelection: true)
        do { try vault.clear(); repository = try ClientRepository(vault: vault); snapshot = nil; message = "Local credentials cleared. Server sessions may still exist; revoke them from a signed-in device." } catch { message = error.localizedDescription }
    }
    func privacyAction(_ operation: @escaping (ClientRepository) async throws -> Void) { local.stop(eraseSelection: true); exportText = ""; run(operation) }
}
