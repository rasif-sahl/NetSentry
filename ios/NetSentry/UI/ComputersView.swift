import SwiftUI

struct ComputersView: View {
    var historyOnly = false
    @EnvironmentObject private var model: AppModel
    @State private var selected: RemoteService?
    @State private var computerID = "", mode = "graceful"
    @State private var children = false
    var body: some View {
        AppForm {
            Section {
                Text("Refresh and confirm the exact project and PID. The computer must be online with current server grants and local control enabled. Requests are never queued offline.").font(.footnote)
                Button("Refresh computers and command history") { model.run { try await $0.desktop() } }
            }
            if historyOnly, let pending = model.snapshot?.pendingStop {
                Section("Unresolved confirmed request") {
                    Text("\(pending.mode) · \(pending.service.project) · PID \(pending.service.pid)")
                    Text(pending.requestID).font(.caption).textSelection(.enabled)
                    Text("Check history before doing anything else. A lost response does not mean the server rejected the stop. Retry sends the same body and ID only while its original observation is fresh.").font(.footnote)
                    Button("Retry exact confirmed request") { model.run { try await $0.submitStop(pending) } }
                    Button("Dismiss local intent") { model.run { try await $0.dismissPendingStop() } }
                    Text("Dismissing does not cancel a command on the server.").font(.footnote)
                }
            }
            if model.snapshot?.computers.isEmpty ?? true {
                Section { Text("No paired computers available.").foregroundStyle(.secondary) }
            }
            ForEach(model.snapshot?.computers ?? [], id: \.id) { computer in
                Section("\(computer.name) · \(computer.connection)") {
                    Text("\(computer.platform) · remote control \(computer.canControl && computer.localControlReady && computer.sharingAllowed && computer.platformSupported ? "permitted by current snapshot" : "unavailable")").font(.caption)
                    if !historyOnly {
                        ForEach(computer.services, id: \.serviceId) { service in
                            VStack(alignment: .leading, spacing: 10) {
                                Text(service.project.isEmpty ? "Unidentified project" : service.project).font(.headline)
                                Text("\(service.runtime) · PID \(service.pid) · ports \(service.ports.map(String.init).joined(separator: ", "))")
                                Text("Observed \(service.observedAt) · \(service.childCount) children").font(.caption)
                                Button("Review graceful stop") { choose(service, computer: computer.id, force: false) }.disabled(!service.canStop || !computer.canControl)
                                Button("Review force stop", role: .destructive) { choose(service, computer: computer.id, force: true) }.disabled(!service.canStop || !computer.canControl)
                            }
                        }
                    }
                    if historyOnly {
                        if (model.snapshot?.commands[computer.id] ?? []).isEmpty { Text("No commands yet.").foregroundStyle(.secondary) }
                        ForEach(model.snapshot?.commands[computer.id] ?? [], id: \.self) { command in
                            ServerDetails(title: "\(command["state"].text) · \(command["mode"].text)", value: command)
                            if ["pending", "accepted"].contains(command["state"].text) { Button("Cancel pending command") { model.run { try await $0.cancelCommand(agentID: computer.id, commandID: command["id"].text) } } }
                        }
                    }
                    if !historyOnly && computer.services.isEmpty { Text("No services in the current inventory. This does not establish that the computer has no running servers.").font(.footnote) }
                }
            }
        }
        .sheet(item: Binding(get: { selected.map(Selection.init) }, set: { selected = $0?.service })) { item in
            NavigationStack {
                AppForm {
                    Text("\(mode.capitalized) stop: \(item.service.project)").font(.headline)
                    Text("PID \(item.service.pid) · started \(item.service.startedAt) · ports \(item.service.ports.map(String.init).joined(separator: ", "))")
                    if mode == "force" { Text("Force stop can lose unsaved work and interrupt requests.").foregroundStyle(.red) }
                    Toggle("Include observed children", isOn: $children).disabled(item.service.childCount > 16)
                    Button("Confirm \(mode) stop", role: .destructive) {
                        let service = item.service, id = computerID, chosenMode = mode, include = children
                        selected = nil
                        model.run { repo in let intent = try await repo.prepareStop(computerID: id, service: service, mode: chosenMode, children: include, confirmed: true); try await repo.submitStop(intent) }
                    }
                    Button("Cancel") { selected = nil }
                    Text("If the observation is older than 10 seconds, cancel and refresh. No server command or arbitrary PID can be entered here.").font(.footnote)
                }
                .navigationTitle("Confirm remote action")
                .navigationBarTitleDisplayMode(.inline)
                .appPageStyle()
            }
        }
    }
    private func choose(_ service: RemoteService, computer: String, force: Bool) { computerID = computer; mode = force ? "force" : "graceful"; children = false; selected = service }
    private struct Selection: Identifiable { let service: RemoteService; var id: String { service.observationId + service.serviceId } }
}
