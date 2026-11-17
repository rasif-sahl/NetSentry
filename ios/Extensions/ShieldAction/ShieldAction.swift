import ManagedSettings

final class ShieldAction: ShieldActionDelegate {
    override func handle(
        action: ManagedSettings.ShieldAction, for application: ApplicationToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) { completionHandler(.close) }
    override func handle(
        action: ManagedSettings.ShieldAction, for webDomain: WebDomainToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) { completionHandler(.close) }
    override func handle(
        action: ManagedSettings.ShieldAction, for category: ActivityCategoryToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) { completionHandler(.close) }
}
