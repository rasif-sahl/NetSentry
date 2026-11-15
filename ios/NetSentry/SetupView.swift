import SwiftUI

struct SetupView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("NetSentry")
                .font(.largeTitle.bold())
            Text("Set up NetSentry")
                .font(.title2)
            Text("Device pairing and monitoring will be available after setup. Nothing is being monitored yet.")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
