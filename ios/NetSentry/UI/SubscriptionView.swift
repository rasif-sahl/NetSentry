import SwiftUI

struct SubscriptionView: View {
    @EnvironmentObject private var model: AppModel
    var body: some View {
        AppForm {
            Section("Subscription status") {
                Text(
                    "Subscription details are read-only. Purchases are currently unavailable. Your existing device permissions and monitoring settings apply."
                ).font(.footnote)
                AppAction("Refresh subscription") {
                    model.run { try await $0.refreshSubscription() }
                }
                if model.snapshot?.subscription.isNull ?? true {
                    Text(
                        "No subscription details loaded. Refresh to view your workspace edition and limits."
                    ).foregroundStyle(.secondary)
                }
                if let s = model.snapshot, !s.subscription.isNull {
                    Text(
                        "\(s.subscription["edition"].text) · \(s.subscription["status"].text) · \(s.subscription["mode"].text)"
                    )
                    Text(
                        s.subscription["enforced"].flag
                            ? "Edition limits are enforced alongside authorization."
                            : "Pre-release evaluation: commercial limits are not enforced.")
                    ServerDetails(
                        title: "Allocation and retention setting limits",
                        value: s.subscription["limits"])
                }
            }
        }
    }
}
