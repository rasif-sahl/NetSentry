import SwiftUI
import UniformTypeIdentifiers

struct ExportDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var text: String
    init(text: String) { self.text = text }
    init(configuration: ReadConfiguration) throws { text = String(data: configuration.file.regularFileContents ?? Data(), encoding: .utf8) ?? "" }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: Data(text.utf8)) }
}
struct AccountSettingsView: View {
    var section: String = ""
    @EnvironmentObject private var model: AppModel
    @State private var name = "", password = "", theme = "SYSTEM"
    @State private var reducedMotion = false, inApp = true, emailAlerts = false, deleting = false, exporting = false
    var body: some View {
        Form {
            if section.isEmpty || section == "Profile & appearance" {
                Section("Profile and appearance") {
                    TextField("Display name", text: $name)
                    Button("Save name") { model.run { try await $0.updateProfile(name) } }
                    Button("Send verification email") { model.run { try await $0.verificationEmail() } }
                    Picker("Theme", selection: $theme) { ForEach(["SYSTEM", "LIGHT", "DARK"], id: \.self) { Text($0) } }
                    Toggle("Reduce motion", isOn: $reducedMotion)
                    Button("Save appearance") { model.run { try await $0.appearance(theme: theme, reducedMotion: reducedMotion) } }
                }
            }
            if section.isEmpty || section == "Notification preferences" {
                Section("Notifications") {
                    Toggle("In-app notifications", isOn: $inApp)
                    Toggle("Opt in to email alerts", isOn: $emailAlerts)
                    Text("Email alert delivery is disabled. Saving this preference sends no email.").font(.footnote)
                    Button("Save notification preference") { model.run { try await $0.notificationPreference(inApp: inApp, email: emailAlerts) } }
                    Text("APNs registration, provider delivery and physical-device checks are pending. This build does not request push permission.").font(.footnote)
                }
            }
            if section.isEmpty || section == "Sessions" {
                Section("Sessions") {
                    Button("List sessions") { model.run { model.sessions = try await $0.sessions() } }
                    ServerDetails(title: "Signed-in sessions", value: model.sessions)
                    Button("Revoke other sessions") { model.run { try await $0.revokeOtherSessions(); model.sessions = try await $0.sessions() } }
                    Button("Sign out", role: .destructive) { model.privacyAction { try await $0.signOut() } }
                }
            }
            if section.isEmpty || section == "Privacy & account" {
                Section("Personal data") {
                    SecureField("Password for export or deletion", text: $password).textContentType(.password)
                    Button("Prepare personal export") { let secret = password; password = ""; model.run { model.exportText = try await $0.exportPersonal(password: secret).pretty } }
                    if !model.exportText.isEmpty { Button("Save export JSON") { exporting = true }; Button("Discard prepared export") { model.exportText = "" } }
                    Button("Delete account", role: .destructive) { deleting = true }
                    Text("Exports contain private data. Save only to a destination you trust. Local Apple selections are erased before sign-out or privacy actions, even if the server is unreachable.").font(.footnote)
                    Button("Stop local controls and clear credentials", role: .destructive) { model.recoverLocal() }
                }
            }
        }
        .onAppear { name = model.snapshot?.user["displayName"].text ?? ""; theme = model.snapshot?.user["preferences"]["theme"].text ?? "SYSTEM"; reducedMotion = model.snapshot?.user["preferences"]["reducedMotion"].flag ?? false; inApp = model.snapshot?.preferences["inApp"].flag ?? true; emailAlerts = model.snapshot?.preferences["email"].flag ?? false }
        .confirmationDialog("Permanently delete your account and its personal data?", isPresented: $deleting) { Button("Delete account", role: .destructive) { let secret = password; password = ""; model.privacyAction { try await $0.deleteAccount(password: secret) } } }
        .fileExporter(isPresented: $exporting, document: ExportDocument(text: model.exportText), contentType: .json, defaultFilename: "netsentry-personal-export") { result in if case .failure(let error) = result { model.message = error.localizedDescription } }
    }
}
