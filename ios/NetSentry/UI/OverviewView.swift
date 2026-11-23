import Foundation
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
                            ForEach(["day", "week", "month"], id: \.self) { period in
                                Text(period.capitalized).tag(period)
                            }
                        }
                        Picker("Metric", selection: $metric) {
                            ForEach(
                                [
                                    "screen_time_seconds", "application_foreground_seconds",
                                    "mobile_data_bytes", "wifi_data_bytes",
                                ], id: \.self
                            ) { metric in
                                Text(reportMetricName(metric)).tag(metric)
                            }
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
                    }
                    if s.report.isNull {
                        Section("Usage summary") {
                            Text("No usage report loaded.").foregroundStyle(.secondary)
                        }
                    } else {
                        UsageReportSummary(report: s.report, devices: s.devices)
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

private func reportMetricName(_ metric: String) -> String {
    switch metric {
    case "screen_time_seconds": "Screen time"
    case "application_foreground_seconds": "App foreground time"
    case "mobile_data_bytes": "Mobile data"
    case "wifi_data_bytes": "Wi-Fi data"
    default: "Usage"
    }
}

private struct UsageReportSummary: View {
    let report: JSONValue
    let devices: [JSONValue]

    var body: some View {
        Section("Usage summary") {
            if let id = report["deviceIds"].values.first?.text,
                let device = devices.first(where: { $0["id"].text == id }),
                !device["name"].text.isEmpty
            {
                LabeledContent("Device", value: device["name"].text)
            }
            LabeledContent("Metric", value: reportMetricName(report["metric"].text))
            if !report["from"].text.isEmpty, !report["to"].text.isEmpty {
                LabeledContent("From", value: report["from"].text)
                LabeledContent("To (exclusive)", value: report["to"].text)
            }
            if !report["timezone"].text.isEmpty {
                LabeledContent("Timezone", value: report["timezone"].text)
            }
            LabeledContent(
                "Measured total", value: amount(report["comparison"]["currentMeasured"].text))
            LabeledContent("Estimated total", value: estimatedTotal.map(amount) ?? "Unavailable")
            LabeledContent("Measured coverage", value: coverage)
            ServerDetails(title: "Report, comparison and quality", value: report)
        }
    }

    private var estimatedTotal: String? {
        let estimates = report["buckets"].values.compactMap {
            Decimal(string: $0["estimated"].text, locale: Locale(identifier: "en_US_POSIX"))
        }
        guard !estimates.isEmpty else { return nil }
        return NSDecimalNumber(decimal: estimates.reduce(0, +)).stringValue
    }

    private var coverage: String {
        let buckets = report["buckets"].values
        var measured = 0.0
        var expected = 0.0
        for bucket in buckets {
            guard case .number(let covered) = bucket["measuredCoverageMs"],
                case .number(let duration) = bucket["expectedMs"],
                covered >= 0, duration >= 0
            else { return "Unavailable" }
            measured += min(covered, duration)
            expected += duration
        }
        guard expected > 0 else { return "Unavailable" }
        return (measured / expected).formatted(.percent.precision(.fractionLength(0...1)))
    }

    private func amount(_ value: String) -> String {
        guard !value.isEmpty else { return "Unavailable" }
        switch report["metric"].text {
        case "screen_time_seconds", "application_foreground_seconds": return "\(value) s"
        case "mobile_data_bytes", "wifi_data_bytes": return "\(value) bytes"
        default: return value
        }
    }
}
