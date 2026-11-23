import SwiftUI
import FamilyControls
import DeviceActivity

struct LocalScreenView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        LocalControlsForm(
            controller: model.local,
            scope: (model.snapshot?.user["id"].text ?? "") + "/"
                + (model.snapshot?.workspaceID ?? ""),
            available: model.snapshot?.signedIn == true
                && !(model.snapshot?.workspaceID.isEmpty ?? true))
    }
}
private struct LocalControlsForm: View {
    @ObservedObject var controller: LocalScreenController
    let scope: String, available: Bool
    @State private var child = false, picker = false, accepted = false, threshold = false
    @State private var start = Date().addingTimeInterval(60), end = Date().addingTimeInterval(3660),
        minutes = 30
    var body: some View {
        Text(controller.status).font(.footnote)
        #if NETSENTRY_SCREEN_TIME
            Toggle("Request Apple child authorization", isOn: $child)
            Text(
                "Individual authorization is for self-management. Child authorization requires Apple's Family Sharing approval; your NetSentry role cannot grant it."
            ).font(.footnote)
            AppAction("Request authorization from Apple") {
                Task { await controller.authorize(child: child) }
            }.disabled(!available)
            AppAction("Choose applications, categories or websites") { picker = true }.disabled(
                AuthorizationCenter.shared.authorizationStatus != .approved || !available
            )
            .familyActivityPicker(isPresented: $picker, selection: $controller.selection)
            DatePicker("Start", selection: $start)
            DatePicker("End (within 24 hours)", selection: $end)
            Toggle("Shield after an activity threshold", isOn: $threshold)
            if threshold { Stepper("\(minutes) minutes", value: $minutes, in: 1...1440) }
            Text(
                "This is a local, nonrepeating window of at least 15 minutes. Apple may include earlier authorized activity in threshold calculations. No exact post-consent usage or server policy enforcement is promised."
            ).font(.footnote)
            Toggle("I accept local Apple controls for my selections", isOn: $accepted)
            AppAction("Request local schedule", primary: true) {
                controller.start(
                    scope: scope, start: start, end: end,
                    thresholdMinutes: threshold ? minutes : nil, accepted: accepted)
            }.disabled(!available || !accepted)
            if AuthorizationCenter.shared.authorizationStatus == .approved {
                DeviceActivityReport(
                    .netSentrySummary,
                    filter: DeviceActivityFilter(
                        segment: .daily(
                            during: Calendar.current.dateInterval(of: .day, for: Date())!),
                        users: .all, devices: .all)
                ).frame(minHeight: 160)
                Text(
                    "Apple-authorized report scope, rendered privately by the report extension. It is not uploaded to NetSentry or guaranteed to represent only this device."
                ).font(.footnote)
            }
        #else
            Text(
                "Family Controls is disabled in this build. Separate Apple approval, provisioning and device validation are required."
            ).font(.footnote)
        #endif
        AppAction("Stop controls and erase selections", role: .destructive) {
            controller.stop(eraseSelection: true)
        }
    }
}
