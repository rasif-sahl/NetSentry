import SwiftUI

/// Semantic system colors preserve the approved iOS appearance in light and dark modes.
enum AppAppearance {
    static let accent = Color(uiColor: .systemBlue)
    static let background = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let hairline = Color.primary.opacity(0.06)
}

/// Shared grouped forms retain native input, picker, toggle and destructive-button behavior.
struct AppForm<Content: View>: View {
    private let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        Form { content }
            .formStyle(.grouped)
            .environment(\.defaultMinListRowHeight, 48)
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
        .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
    }
}

struct AppStatusNotice: View {
    let message: String
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
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
        .padding(.horizontal, 16)
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
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
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
