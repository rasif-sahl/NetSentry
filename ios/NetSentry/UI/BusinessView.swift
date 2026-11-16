import SwiftUI

struct BusinessView: View {
    @EnvironmentObject private var model: AppModel
    @State private var reviewing: JSONValue?
    var body: some View {
        Form {
            Section("Business organization") {
                Button("Refresh organization") { model.run { try await $0.businessOverview() } }
                Text("Choose a Business workspace. Organization administration is available in the web dashboard. Sharing does not enable monitoring or grant Apple permissions.").font(.footnote)
                if let s = model.snapshot, !s.business.isNull {
                    Text(s.business["organization"]["name"].text).font(.headline)
                    Text(s.business["qualityNote"].text).font(.footnote)
                    Text(s.business["disclosure"]["text"].text).font(.footnote)
                    let profiles = s.business["employees"].values.filter { $0["userId"].text == s.user["id"].text }.map { $0["id"].text }
                    ForEach(s.business["assignments"].values.filter { profiles.contains($0["employeeId"].text) }, id: \.self) { assignment in
                        if let device = s.business["devices"].values.first(where: { $0["id"].text == assignment["deviceId"].text }) {
                            Text("\(device["name"].text) · \(device["platform"].text) · custody: \(device["ownership"].text) · generation \(device["generation"].integer ?? 0)")
                            ServerDetails(title: "Reporting checks (not security certification)", value: device["compliance"])
                            Text(assignment["consentedAt"].isNull ? "Sharing awaiting acceptance" : "Report access begins \(assignment["reportFrom"].text)")
                            Button("Review and accept organization sharing") { reviewing = .object(["assignment": assignment, "device": device]) }.disabled(device["state"].text != "ACTIVE")
                            Button("Withdraw sharing", role: .destructive) { model.privacyAction { try await $0.withdrawBusinessSharing(deviceID: device["id"].text) } }
                        }
                    }
                }
            }
        }
        .confirmationDialog("Accept business-sharing-v1 for this assignment and displayed device generation? Monitoring remains separate.", isPresented: Binding(get: { reviewing != nil }, set: { if !$0 { reviewing = nil } })) {
            if let value = reviewing {
                Button("Accept organization sharing") { reviewing = nil; model.run { try await $0.acceptBusinessSharing(deviceID: value["device"]["id"].text, revision: value["assignment"]["revision"].integer ?? 0, generation: value["device"]["generation"].integer ?? 0, accepted: true) } }
            }
        }
    }
}
