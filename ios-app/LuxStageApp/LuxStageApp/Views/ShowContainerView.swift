import SwiftUI

/// Wrapper um ShowDetailView mit eigener 4-Tab-Leiste.
/// Ersetzt den NavigationLink-Destination direkt.
struct ShowContainerView: View {
    let showId: String

    @Environment(PocketBaseClient.self) private var pb
    @State private var show: Show?
    @State private var selectedTab: Tab = .show
    @State private var oscSettings = OSCSettings()
    @State private var checks: Set<String> = []

    enum Tab { case show, photos, lighting, settings }

    var body: some View {
        Group {
            switch selectedTab {
            case .show:
                ShowDetailView(showId: showId, oscSettings: $oscSettings, checks: $checks, lightingMode: false)
            case .photos:
                PhotosTabView(showId: showId)
            case .lighting:
                ShowDetailView(showId: showId, oscSettings: $oscSettings, checks: $checks, lightingMode: true)
            case .settings:
                ShowSettingsView(showId: showId, show: show, oscSettings: $oscSettings)
            }
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom) {
            tabBar
        }
        .task { await loadShow() }
        .navigationTitle(show?.name ?? "Show")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabButton(.show,     icon: "list.bullet",     label: "Show")
            tabButton(.photos,   icon: "photo.on.rectangle", label: "Fotos")
            tabButton(.lighting, icon: "lightbulb",       label: "Einleuchten")
            tabButton(.settings, icon: "gear",            label: "Einstellungen")
        }
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(.regularMaterial)
        .overlay(Divider(), alignment: .top)
    }

    private func tabButton(_ tab: Tab, icon: String, label: String) -> some View {
        Button {
            selectedTab = tab
        } label: {
            VStack(spacing: 3) {
                Image(systemName: selectedTab == tab
                      ? (tab == .lighting ? "lightbulb.fill" : icon)
                      : icon)
                    .font(.system(size: 22))
                    .foregroundStyle(selectedTab == tab
                        ? (tab == .lighting ? .yellow : .accentColor)
                        : .secondary)
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(selectedTab == tab ? .primary : .secondary)
            }
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Load Show (for title + OSC)

    private func loadShow() async {
        guard let fetched = try? await pb.fetchShow(id: showId) else { return }
        show = fetched
        if let templateId = fetched.template {
            oscSettings = OSCSettings.load(templateId: templateId)
        }
        let checksKey = "lighting_check_\(showId)"
        let checksTTL: TimeInterval = 6 * 3600
        if let raw = UserDefaults.standard.dictionary(forKey: checksKey),
           let ts = raw["ts"] as? TimeInterval,
           Date().timeIntervalSince1970 - ts < checksTTL,
           let ids = raw["checks"] as? [String] {
            checks = Set(ids)
        }
    }
}
