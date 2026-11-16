import SwiftUI

@main
struct NetSentryApp: App {
    @StateObject private var model = AppModel()
    var body: some Scene { WindowGroup { SetupView().environmentObject(model) } }
}
