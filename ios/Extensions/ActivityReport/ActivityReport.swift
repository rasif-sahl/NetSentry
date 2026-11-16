import SwiftUI
import DeviceActivity

@main
struct NetSentryActivityReport: DeviceActivityReportExtension {
    var body: some DeviceActivityReportScene { SummaryScene { SummaryView(summary: $0) } }
}
struct ReportSummary { let seconds: TimeInterval; let segments: Int }
struct SummaryScene: DeviceActivityReportScene {
    let context: DeviceActivityReport.Context = .netSentrySummary
    let content: (ReportSummary) -> SummaryView
    func makeConfiguration(representing data: DeviceActivityResults<DeviceActivityData>) async -> ReportSummary {
        var seconds: TimeInterval = 0, segments = 0
        for await activity in data { for await segment in activity.activitySegments { seconds += segment.totalActivityDuration; segments += 1 } }
        return ReportSummary(seconds: seconds, segments: segments)
    }
}
struct SummaryView: View {
    let summary: ReportSummary
    var body: some View {
        VStack(alignment: .leading) {
            Text("Apple authorized activity").font(.headline)
            if summary.segments == 0 { Text("No activity segments available in this authorized scope.") }
            else { Text(Duration.seconds(summary.seconds).formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))); Text("\(summary.segments) reported segments; combined scopes can overlap.").font(.caption) }
        }.padding()
    }
}
