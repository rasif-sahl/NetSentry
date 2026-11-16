import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfiguration: ShieldConfigurationDataSource {
    private var generic: ManagedSettingsUI.ShieldConfiguration {
        ManagedSettingsUI.ShieldConfiguration(backgroundBlurStyle: .systemMaterial, backgroundColor: .systemBackground, title: .init(text: "NetSentry local controls", color: .label), subtitle: .init(text: "Open NetSentry separately to review or stop your local schedule.", color: .secondaryLabel), primaryButtonLabel: .init(text: "Close", color: .white), primaryButtonBackgroundColor: .systemBlue)
    }
    override func configuration(shielding application: Application) -> ManagedSettingsUI.ShieldConfiguration { generic }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ManagedSettingsUI.ShieldConfiguration { generic }
    override func configuration(shielding webDomain: WebDomain) -> ManagedSettingsUI.ShieldConfiguration { generic }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ManagedSettingsUI.ShieldConfiguration { generic }
}
