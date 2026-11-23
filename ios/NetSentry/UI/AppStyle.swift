import SwiftUI

/// Semantic system colors preserve the approved iOS appearance in light and dark modes.
enum AppAppearance {
    static let accent = Color(uiColor: .systemBlue)
    static let background = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let hairline = Color.primary.opacity(0.06)
}

enum AppSpacing {
    static let rowHeight: CGFloat = 48
    static let rowInset: CGFloat = 10
    static let horizontalInset: CGFloat = 16
    static let actionGap: CGFloat = 8
    static let sectionGap: CGFloat = 12
}

struct AppAction: View {
    let title: String
    let role: ButtonRole?
    let primary: Bool
    let action: () -> Void

    init(
        _ title: String, role: ButtonRole? = nil, primary: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.role = role
        self.primary = primary
        self.action = action
    }

    var body: some View {
        Button(title, role: role, action: action)
            .buttonStyle(FormActionStyle(primary: primary, destructive: role == .destructive))
    }
}

private struct FormActionStyle: ButtonStyle {
    let primary: Bool
    let destructive: Bool
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(primary ? .semibold : .regular))
            .foregroundStyle(destructive ? Color.red : AppAppearance.accent)
            .multilineTextAlignment(.leading)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, minHeight: AppSpacing.rowHeight, alignment: .leading)
            .contentShape(Rectangle())
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.65 : 1)
    }
}

/// Shared grouped forms retain native input, picker, toggle and destructive-button behavior.
struct AppForm<Content: View>: View {
    private let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        Form { content }
            .formStyle(.grouped)
            .environment(\.defaultMinListRowHeight, AppSpacing.rowHeight)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(AppAppearance.background)
            .tint(AppAppearance.accent)
    }
}

struct AppMenuRow: View {
    let title: String
    var body: some View {
        NavigationLink(value: title) {
            Text(title)
                .font(.body)
                .foregroundStyle(.primary)
                .padding(.vertical, 4)
                .fixedSize(horizontal: false, vertical: true)
        }
        .listRowBackground(AppAppearance.card)
        .listRowInsets(
            EdgeInsets(
                top: AppSpacing.rowInset, leading: AppSpacing.horizontalInset,
                bottom: AppSpacing.rowInset, trailing: AppSpacing.horizontalInset
            ))
    }
}

struct AppStatusNotice: View {
    let message: String
    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.actionGap) {
            Image(systemName: "info.circle").foregroundStyle(AppAppearance.accent)
                .accessibilityHidden(true)
            Text(message).font(.callout).foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppAppearance.card, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(
                AppAppearance.hairline, lineWidth: 1)
        )
        .padding(.horizontal, AppSpacing.horizontalInset)
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.updatesFrequently)
    }
}

struct AppFloatingNavigation: View {
    @Binding var selected: MobileTab
    var body: some View {
        HStack(spacing: 2) {
            ForEach(MobileTab.allCases) { tab in
                Button {
                    selected = tab
                } label: {
                    VStack(spacing: 5) {
                        Image(systemName: tab.icon).font(.system(size: 19)).accessibilityHidden(
                            true)
                        Text(tab.rawValue).font(.caption2).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .foregroundStyle(selected == tab ? AppAppearance.accent : Color.secondary)
                    .background(
                        selected == tab ? AppAppearance.accent.opacity(0.12) : Color.clear,
                        in: RoundedRectangle(cornerRadius: 20, style: .continuous)
                    )
                    .contentShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.rawValue)
                .accessibilityAddTraits(selected == tab ? .isSelected : [])
                .accessibilityIdentifier("mobile.tab.\(tab.rawValue.lowercased())")
            }
        }
        .padding(8)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous).stroke(
                AppAppearance.hairline, lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
        .padding(.horizontal, AppSpacing.horizontalInset)
        .padding(.top, AppSpacing.actionGap)
        .padding(.bottom, AppSpacing.sectionGap)
    }
}

extension View {
    func appPageStyle() -> some View {
        self.tint(AppAppearance.accent)
            .background(AppAppearance.background)
            .toolbarBackground(AppAppearance.background, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }
}
