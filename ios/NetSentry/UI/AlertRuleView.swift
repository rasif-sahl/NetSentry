import SwiftUI

struct AlertRuleView: View {
    @EnvironmentObject private var model: AppModel
    @State private var kind = "threshold", metric = "screen_time_seconds", period = "day", quality = "measured", deviceID = ""
    @State private var threshold = 3600.0
    var body: some View {
        Form {
            Picker("Rule", selection: $kind) { Text("Usage threshold").tag("threshold"); Text("Device offline").tag("device_offline"); Text("Permission revoked").tag("permission_revoked"); Text("Not reporting").tag("not_reporting") }
            Picker("Device", selection: $deviceID) { Text("All authorized devices").tag(""); ForEach(model.snapshot?.devices ?? [], id: \.self) { Text($0["name"].text).tag($0["id"].text) } }
            if kind == "threshold" {
                Picker("Metric", selection: $metric) { ForEach(["screen_time_seconds", "application_foreground_seconds", "mobile_data_bytes", "wifi_data_bytes"], id: \.self) { Text($0.replacingOccurrences(of: "_", with: " ")) } }
                Picker("Quality", selection: $quality) { Text("Measured").tag("measured"); Text("Estimated").tag("estimated") }
                Picker("Period", selection: $period) { ForEach(["day", "week", "month"], id: \.self) { Text($0) } }
            }
            if kind != "permission_revoked" { TextField(kind == "threshold" ? "Threshold (seconds or bytes)" : "Delay in seconds", value: $threshold, format: .number).keyboardType(.decimalPad) }
            Text("In-app delivery only. iOS push is unconfigured. Rules evaluate actual server observations; creating a rule does not enable iOS usage collection or local shielding.").font(.footnote)
            Button("Create enabled warning rule") { model.run { try await $0.createRule(kind: kind, metric: metric, threshold: kind == "permission_revoked" ? 1 : threshold, period: period, quality: quality, deviceID: deviceID) } }.disabled(model.busy || (model.snapshot?.workspaceID.isEmpty ?? true))
        }.navigationTitle("Alert rule")
    }
}
