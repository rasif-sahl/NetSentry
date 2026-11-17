import DeviceActivity

final class ActivityMonitor: DeviceActivityMonitor {
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity); ScreenTimeStore.callback(activity: activity)
    }
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity);
        ScreenTimeStore.callback(activity: activity, ended: true)
    }
    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name, activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity);
        guard event.rawValue == "netsentry.threshold" else { return };
        ScreenTimeStore.callback(activity: activity, threshold: true)
    }
    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity);
        ScreenTimeStore.callback(activity: activity, warning: true)
    }
    override func eventWillReachThresholdWarning(
        _ event: DeviceActivityEvent.Name, activity: DeviceActivityName
    ) {
        super.eventWillReachThresholdWarning(event, activity: activity);
        ScreenTimeStore.callback(activity: activity, warning: true)
    }
}
