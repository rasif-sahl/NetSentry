import SwiftUI

struct SetupView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var phase
    var body: some View {
        Group {
            if model.snapshot?.signedIn == true {
                SignedInNavigation()
                .id((model.snapshot?.user["id"].text ?? "") + "/" + (model.snapshot?.workspaceID ?? ""))
            } else {
                NavigationStack {
                    VStack(spacing: 0) {
                        NavigationStatus()
                        SignInView().disabled(model.busy)
                    }.navigationTitle("NetSentry")
                }
            }
        }
        .preferredColorScheme(model.snapshot?.user["preferences"]["theme"].text == "DARK" ? .dark : model.snapshot?.user["preferences"]["theme"].text == "LIGHT" ? .light : nil)
        .transaction { if model.snapshot?.user["preferences"]["reducedMotion"].flag == true { $0.disablesAnimations = true } }
        .task { await model.bootstrap() }
        .onChange(of: phase) { _, value in
            if value == .active {
                model.local.reconcile()
                if model.snapshot?.signedIn == true { model.run { try await $0.refresh() } }
            }
        }
    }
}

private enum MobileTab: String, CaseIterable, Identifiable {
    case home = "Home", usage = "Usage", family = "Family", computers = "Computers", more = "More"
    var id: String { rawValue }
    var icon: String {
        switch self {
        case .home: "house"
        case .usage: "chart.bar"
        case .family: "person.2"
        case .computers: "desktopcomputer"
        case .more: "ellipsis"
        }
    }
    var destinations: [String] {
        switch self {
        case .home: ["Workspace selection", "This phone", "Device inventory", "Permissions & consent"]
        case .usage: ["Usage reports", "Alerts & rules", "In-app notifications"]
        case .family: ["Child profiles", "Wellbeing reports & policy status", "Sharing & consent", "Time requests & decisions", "Local Apple Screen Time controls"]
        case .computers: ["Paired computers & services", "Command history"]
        case .more: ["Business", "Subscription", "Profile & appearance", "Notification preferences", "Privacy & account", "Sessions"]
        }
    }
}

private struct NavigationStatus: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        if model.busy { ProgressView().accessibilityLabel("Contacting NetSentry") }
        if !model.message.isEmpty {
            Text(model.message).font(.callout).foregroundStyle(.red).padding().accessibilityAddTraits(.updatesFrequently)
        }
    }
}

private struct SignedInNavigation: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var phase
    @State private var selected: MobileTab = .home
    var body: some View {
        TabView(selection: $selected) {
            ForEach(MobileTab.allCases) { tab in
                MobileMenu(tab: tab)
                    .tabItem { Label(tab.rawValue, systemImage: tab.icon) }
                    .tag(tab)
            }
        }
        .task(id: "\(selected.rawValue)-\(phase)") {
            while !Task.isCancelled && phase == .active && selected == .computers {
                if model.snapshot?.signedIn == true && !model.busy { model.run { try await $0.desktop() } }
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }
}

private struct MobileMenu: View {
    @EnvironmentObject private var model: AppModel
    let tab: MobileTab
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                NavigationStatus()
                List(tab.destinations, id: \.self) { destination in
                    NavigationLink(destination, value: destination)
                }
            }
            .navigationTitle(tab.rawValue)
            .navigationDestination(for: String.self) { destination in
                VStack(spacing: 0) {
                    NavigationStatus()
                    screen(destination).disabled(model.busy)
                }
                .navigationTitle(destination)
                .navigationBarTitleDisplayMode(.inline)
            }
            .toolbar { Button("Refresh") { model.run { try await $0.refresh() } }.disabled(model.busy) }
        }
    }
    @ViewBuilder private func screen(_ destination: String) -> some View {
        switch tab {
        case .home, .usage: OverviewView(section: destination)
        case .family: FamilyView(section: destination)
        case .computers: ComputersView(historyOnly: destination == "Command history")
        case .more:
            switch destination {
            case "Business": BusinessView()
            case "Subscription": SubscriptionView()
            default: AccountSettingsView(section: destination)
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
