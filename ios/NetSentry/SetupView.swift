import SwiftUI

struct SetupView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var phase
    @State private var tab = "Overview"
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if model.busy { ProgressView().accessibilityLabel("Contacting NetSentry") }
                if !model.message.isEmpty { Text(model.message).font(.callout).foregroundStyle(.red).padding().accessibilityAddTraits(.updatesFrequently) }
                if model.snapshot?.signedIn == true {
                    Picker("Section", selection: $tab) { ForEach(["Overview", "Computers", "Family", "Business", "Settings"], id: \.self) { Text($0) } }.pickerStyle(.menu).padding(.horizontal)
                    Group { switch tab {
                    case "Computers": ComputersView()
                    case "Family": FamilyView()
                    case "Business": BusinessView()
                    case "Settings": AccountSettingsView()
                    default: OverviewView()
                    } }.disabled(model.busy)
                } else { SignInView().disabled(model.busy) }
            }
            .navigationTitle("NetSentry")
            .preferredColorScheme(model.snapshot?.user["preferences"]["theme"].text == "DARK" ? .dark : model.snapshot?.user["preferences"]["theme"].text == "LIGHT" ? .light : nil)
            .transaction { if model.snapshot?.user["preferences"]["reducedMotion"].flag == true { $0.disablesAnimations = true } }
            .toolbar { if model.snapshot?.signedIn == true { Button("Refresh") { model.run { try await $0.refresh() } }.disabled(model.busy) } }
            .task { await model.bootstrap() }
            .onChange(of: phase) { _, value in if value == .active { model.local.reconcile(); if model.snapshot?.signedIn == true { model.run { try await $0.refresh() } } } }
            .task(id: "\(tab)-\(phase)") {
                while !Task.isCancelled && phase == .active && tab == "Computers" {
                    if model.snapshot?.signedIn == true && !model.busy { model.run { try await $0.desktop() } }
                    try? await Task.sleep(for: .seconds(5))
                }
            }
        }
    }
}

struct SignInView: View {
    @EnvironmentObject private var model: AppModel
    @State private var base = "https://", email = "", password = "", name = "", token = ""
    @State private var register = false
    var body: some View {
        Form {
            Section("Account") {
                TextField("HTTPS API address ending in /api/v1", text: $base).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                TextField("Email", text: $email).textContentType(.username).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                SecureField("Password", text: $password).textContentType(register ? .newPassword : .password)
                Toggle("Create an account", isOn: $register)
                if register { TextField("Display name", text: $name) }
                Button(register ? "Create account" : "Sign in") { let secret = password; password = ""; model.run { try await $0.authenticate(base: base, email: email, password: secret, name: register ? name : nil) } }
            }
            Section("Recover or verify") {
                TextField("Verification or reset token", text: $token).textInputAutocapitalization(.never).autocorrectionDisabled().privacySensitive()
                Button("Request password reset") { model.run { try await $0.recovery(base: base, action: "forgot", email: email) } }
                Button("Reset password using token") { let secret = password, code = token; password = ""; token = ""; model.run { try await $0.recovery(base: base, action: "reset", token: code, password: secret) } }
                Button("Verify email using token") { let code = token; token = ""; model.run { try await $0.recovery(base: base, action: "verify", token: code) } }
            }
            Section { Text("Pairing is separate from monitoring consent. iOS device-wide mobile/Wi-Fi usage is unavailable. Screen Time requires separate Apple provisioning and authorization.").font(.footnote) }
            Button("Clear local credentials", role: .destructive) { model.recoverLocal() }
        }
    }
}

/// Render quality and gap metadata with the report; never turn absent fields into zero.
struct ServerDetails: View {
    let title: String, value: JSONValue
    var body: some View { DisclosureGroup(title) { DetailValue(value: value, depth: 0) } }
}
private struct DetailValue: View {
    let value: JSONValue, depth: Int
    var body: some View {
        Group {
            switch value {
            case .null: Text("Unavailable").foregroundStyle(.secondary)
            case .string(let text): Text(text.isEmpty ? "Not provided" : text).textSelection(.enabled)
            case .number(let number): Text(number.formatted()).textSelection(.enabled)
            case .bool(let flag): Text(flag ? "Yes" : "No")
            case .array(let values):
                if values.isEmpty { Text("No records available").foregroundStyle(.secondary) }
                else { ForEach(Array(values.enumerated()), id: \.offset) { _, item in AnyView(DetailValue(value: item, depth: depth + 1)).padding(.vertical, 3) } }
            case .object(let fields):
                ForEach(fields.keys.sorted(), id: \.self) { key in
                    if depth < 10 { DisclosureGroup(label(key)) { AnyView(DetailValue(value: fields[key] ?? .null, depth: depth + 1)) } }
                }
            }
        }.font(.callout).frame(maxWidth: .infinity, alignment: .leading)
    }
    private func label(_ key: String) -> String {
        key.replacingOccurrences(of: "([a-z])([A-Z])", with: "$1 $2", options: .regularExpression).replacingOccurrences(of: "_", with: " ").capitalized
    }
}
