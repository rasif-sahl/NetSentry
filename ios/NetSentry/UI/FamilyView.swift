import SwiftUI

struct FamilyView: View {
    var section: String = ""
    @EnvironmentObject private var model: AppModel
    @State private var accepted = false, direct = false
    @State private var minutes = 15, reason = ""
    @State private var decisionID = "", decision = ""
    var body: some View {
        AppForm {
            if section != "Local Apple Screen Time controls" {
                Section("Family workspace") {
                    AppAction("Refresh family") { model.run { try await $0.familyOverview() } }
                    Text(
                        "Server roles and profile grants govern these views. Server policies and Android identifiers never authorize Apple controls or select Apple applications."
                    ).font(.footnote)
                    if (model.snapshot?.family["profiles"].values ?? []).isEmpty {
                        Text(
                            "No authorized child profiles loaded. Refresh family to view profiles you can access."
                        ).foregroundStyle(.secondary)
                    }
                    ForEach(model.snapshot?.family["profiles"].values ?? [], id: \.self) { p in
                        AppAction(p["name"].text) {
                            model.run { try await $0.familyOverview(profileID: p["id"].text) }
                        }
                    }
                    if let s = model.snapshot {
                        if section.isEmpty || section == "Child profiles" {
                            ServerDetails(title: "Family overview and grants", value: s.family)
                        }
                        if section.isEmpty || section == "Wellbeing reports & policy status" {
                            ServerDetails(
                                title: "Selected profile, reports, policy and suggestions",
                                value: s.child)
                        }
                        if section.isEmpty || section == "Sharing & consent" {
                            Toggle(
                                "I accept family-sharing-v1 for my paired device", isOn: $accepted)
                            AppAction(
                                "Share this paired device with selected profile", primary: true
                            ) {
                                model.run { try await $0.shareWithChild(accepted: accepted) }
                            }.disabled(!accepted || s.device == nil)
                            if let d = s.device {
                                AppAction(
                                    "Withdraw this device's family sharing", role: .destructive
                                ) {
                                    model.privacyAction {
                                        try await $0.withdrawFamily(deviceID: d.id)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if section.isEmpty || section == "Time requests & decisions" {
                Section("Time requests") {
                    Stepper("\(minutes) minutes", value: $minutes, in: 1...120)
                    TextField("Reason", text: $reason)
                    Toggle("Guardian direct override", isOn: $direct)
                    AppAction("Submit request", primary: true) {
                        let id = UUID().uuidString.lowercased();
                        model.run {
                            try await $0.familyTime(
                                id: id, minutes: minutes, reason: reason, direct: direct)
                        }
                    }
                    Text(
                        "The server checks your authority and current policy revision. Approval changes the server policy only; it does not prove a restriction changed on iOS."
                    ).font(.footnote)
                    ForEach(model.snapshot?.child["requests"].values ?? [], id: \.self) { request in
                        ServerDetails(title: "Time request", value: request)
                        ForEach(["approved", "rejected", "cancelled"], id: \.self) { verb in
                            AppAction(verb.capitalized) {
                                decisionID = request["id"].text; decision = verb
                            }
                        }
                    }
                }
            }
            if section.isEmpty || section == "Local Apple Screen Time controls" {
                Section("Local Apple controls") { LocalScreenView() }
            }
        }
        .task {
            if section != "Local Apple Screen Time controls" && !model.busy {
                model.run { try await $0.familyOverview() }
            }
        }
        .confirmationDialog(
            "Confirm \(decision)?",
            isPresented: Binding(get: { !decision.isEmpty }, set: { if !$0 { decision = "" } })
        ) {
            Button("Confirm") {
                let id = decisionID, verb = decision; decision = "";
                model.run { try await $0.familyDecision(id: id, decision: verb) }
            }
        }
    }
}
