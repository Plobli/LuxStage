import SwiftUI

struct ShowContainerView: View {
    let showId: String

    @Environment(PocketBaseClient.self) private var pb
    @State private var show: Show?
    @State private var oscSettings = OSCSettings()
    @State private var checks: Set<String> = []

    var body: some View {
        TabView {
            ShowDetailView(showId: showId, oscSettings: $oscSettings, checks: $checks, lightingMode: false)
                .tabItem { Label("Show", systemImage: "list.bullet") }

            PhotosTabView(showId: showId)
                .tabItem { Label("Fotos", systemImage: "photo.on.rectangle") }

            ShowDetailView(showId: showId, oscSettings: $oscSettings, checks: $checks, lightingMode: true)
                .tabItem { Label("Einleuchten", systemImage: "lightbulb.fill") }

            ShowSettingsView(showId: showId, show: show, oscSettings: $oscSettings)
                .tabItem { Label("Einstellungen", systemImage: "gear") }
        }
        .toolbar(.hidden, for: .tabBar)  // Hide parent TabView's bar
        .navigationTitle(show?.name ?? "Show")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadShow() }
    }

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
