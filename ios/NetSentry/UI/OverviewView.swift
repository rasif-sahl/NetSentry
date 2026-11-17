import SwiftUI

struct OverviewView: View {
    var section: String = ""
    @EnvironmentObject private var model: AppModel
    @State private var deviceName = "My iPhone", accepted = false
    @State private var deviceID = "", period = "day", metric = "screen_time_seconds"
    @State private var actionDevice = "", action = ""
    var body: some View {
        AppForm {
            if let s = model.snapshot {
                if section.isEmpty || section == "Workspace selection" {
                    Section("Workspace") {
                        Text(s.user["displayName"].text)
                        ForEach(s.workspaces, id: \.self) { workspace in
                            Button(
                                "\(workspace["name"].text) · \(workspace["type"].text)\(s.workspaceID == workspace["id"].text ? " ✓" : "")"
                            ) {
                                model.local.stop(eraseSelection: true);
                                model.run { try await $0.selectWorkspace(workspace["id"].text) }
                            }
                        }
                    }
                }
                if section.isEmpty || section == "This phone" || section == "Permissions & consent"
                {
                    Section("This installation") {
                        if let binding = s.device {
                            Text("Paired · \(binding.id)").font(.caption)
                            Button("Send metadata heartbeat") {
                                model.run { try await $0.heartbeat() }
                            }
                            Text(
                                "Metadata only. No usage collection or monitoring consent is enabled by this action."
                            ).font(.footnote)
                        } else {
                            TextField("Device name", text: $deviceName)
                            ServerDetails(title: "Read enrolment disclosure", value: s.disclosures)
                            Toggle(
                                "I accept device-enrolment-v1 for this installation",
                                isOn: $accepted)
                            Button("Pair this iOS installation") {
                                model.run {
                                    try await $0.enrol(name: deviceName, accepted: accepted)
                                }
                            }.disabled(!accepted || s.workspaceID.isEmpty)
                        }
                        if section == "Permissions & consent" {
                            Text(
                                "Pairing does not authorize monitoring. Local Screen Time requires separate Apple authorization and provisioning."
                            ).font(.footnote)
                            ForEach(s.devices, id: \.self) { d in
                                ServerDetails(
                                    title: d["name"].text + " · capabilities and consent", value: d)
                            }
                        }
                        Text(
                            "Mobile and Wi-Fi byte totals cannot be collected generally on iOS. Local Screen Time reports stay in Apple's report extension. Missing data means unavailable, not zero."
                        ).font(.footnote)
                    }
                }
                if section.isEmpty || section == "Device inventory" {
                    Section("Devices and privacy") {
                        if s.devices.isEmpty {
                            Text("No devices available.").foregroundStyle(.secondary)
                        }
                        ForEach(s.devices, id: \.self) { d in
                            VStack(alignment: .leading) {
                                Text(
                                    "\(d["name"].text) · \(d["platform"].text) · \(d["state"].text)"
                                )
                                ServerDetails(title: "Capabilities and consent", value: d)
                                ForEach(
                                    ["pause", "revoke", "unenrol", "erase", "remove"], id: \.self
                                ) { verb in
                                    Button(verb.capitalized, role: .destructive) {
                                        actionDevice = d["id"].text; action = verb
                                    }
                                }
                            }
                        }
                    }
                }
                if section.isEmpty || section == "Usage reports" {
                    Section("Server reports") {
                        Picker("Device", selection: $deviceID) {
                            Text("Choose a device").tag("");
                            ForEach(s.devices, id: \.self) {
                                Text($0["name"].text).tag($0["id"].text)
                            }
                        }
                        Picker("Period", selection: $period) {
                            ForEach(["day", "week", "month"], id: \.self) { Text($0) }
                        }
                        Picker("Metric", selection: $metric) {
                            ForEach(
                                [
                                    "screen_time_seconds", "application_foreground_seconds",
                                    "mobile_data_bytes", "wifi_data_bytes",
                                ], id: \.self
                            ) { Text($0.replacingOccurrences(of: "_", with: " ")) }
                        }
                        Button("Load report") {
                            model.run {
                                try await $0.usage(
                                    deviceID: deviceID, period: period, metric: metric)
                            }
                        }.disabled(deviceID.isEmpty)
                        Text(
                            "Server observations from authorized supported devices. Review sources, declared gaps, estimates and workspace timezone below."
                        ).font(.footnote)
                        ServerDetails(title: "Report, comparison and quality", value: s.report)
                    }
                }
                if section.isEmpty || section == "Alerts & rules"
                    || section == "In-app notifications"
                {
                    Section(section == "In-app notifications" ? "Notifications" : "Alerts") {
                        Button("Refresh alerts and notifications") {
                            model.run { try await $0.loadAlerts() }
                        }
                        if section != "In-app notifications" {
                            NavigationLink("Create an alert rule") { AlertRuleView() }
                            ForEach(s.alerts, id: \.self) { a in
                                ServerDetails(
                                    title: a["state"].text + " " + a["id"].text, value: a);
                                Button("Acknowledge alert") {
                                    model.run { try await $0.acknowledge(a["id"].text) }
                                }
                            }
                            ForEach(s.rules, id: \.self) { r in
                                ServerDetails(title: "Rule", value: r);
                                Button("Remove rule", role: .destructive) {
                                    actionDevice = r["id"].text; action = "remove rule"
                                }
                            }
                        }
                        if section != "Alerts & rules" {
                            ServerDetails(title: "Notifications", value: .array(s.notifications))
                        }
                    }
                }
            }
        }
        .confirmationDialog(
            "Confirm \(action)? This may stop sharing or erase server data.",
            isPresented: Binding(get: { !action.isEmpty }, set: { if !$0 { action = "" } })
        ) {
            Button("Confirm \(action)", role: .destructive) {
                let verb = action, id = actionDevice; action = "";
                model.privacyAction {
                    if verb == "remove rule" {
                        try await $0.removeRule(id)
                    } else {
                        try await $0.deviceAction(verb, id: id)
                    }
                }
            }
        }
    }
}
