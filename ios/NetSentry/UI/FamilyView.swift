import SwiftUI

struct FamilyView: View {
    @EnvironmentObject private var model: AppModel
    @State private var accepted = false, direct = false
    @State private var minutes = 15, reason = ""
    @State private var decisionID = "", decision = ""
    var body: some View {
        Form {
            Section("Family workspace") {
                Button("Refresh family") { model.run { try await $0.familyOverview() } }
                Text("Server roles and profile grants govern these views. Server policies and Android identifiers never authorize Apple controls or select Apple applications.").font(.footnote)
                ForEach(model.snapshot?.family["profiles"].values ?? [], id: \.self) { p in Button(p["name"].text) { model.run { try await $0.familyOverview(profileID: p["id"].text) } } }
                if let s = model.snapshot {
                    ServerDetails(title: "Family overview and grants", value: s.family)
                    ServerDetails(title: "Selected profile, reports, policy and suggestions", value: s.child)
                    Toggle("I accept family-sharing-v1 for my paired device", isOn: $accepted)
                    Button("Share this paired device with selected profile") { model.run { try await $0.shareWithChild(accepted: accepted) } }.disabled(!accepted || s.device == nil)
                    if let d = s.device { Button("Withdraw this device's family sharing", role: .destructive) { model.privacyAction { try await $0.withdrawFamily(deviceID: d.id) } } }
                }
            }
            Section("Time requests") {
                Stepper("\(minutes) minutes", value: $minutes, in: 1...120)
                TextField("Reason", text: $reason)
                Toggle("Guardian direct override", isOn: $direct)
                Button("Submit request") { let id = UUID().uuidString.lowercased(); model.run { try await $0.familyTime(id: id, minutes: minutes, reason: reason, direct: direct) } }
                Text("The server checks your authority and current policy revision. Approval changes the server policy only; it does not prove a restriction changed on iOS.").font(.footnote)
                ForEach(model.snapshot?.child["requests"].values ?? [], id: \.self) { request in
                    ServerDetails(title: "Time request", value: request)
                    ForEach(["approved", "rejected", "cancelled"], id: \.self) { verb in Button(verb.capitalized) { decisionID = request["id"].text; decision = verb } }
                }
            }
            Section("Local Apple controls") { LocalScreenView() }
        }
        .confirmationDialog("Confirm \(decision)?", isPresented: Binding(get: { !decision.isEmpty }, set: { if !$0 { decision = "" } })) {
            Button("Confirm") { let id = decisionID, verb = decision; decision = ""; model.run { try await $0.familyDecision(id: id, decision: verb) } }
        }
    }
}
