import SwiftUI

struct ShowContainerView: View {
    let showId: String

    @Environment(PocketBaseClient.self) private var pb
    @Environment(AppLocale.self) private var locale
    @State private var show: Show?
    @State private var checks: Set<String> = []

    var body: some View {
        TabView {
            Tab(locale.t("show.aufbau"), systemImage: "wrench.and.screwdriver") {
                ShowDetailView(showId: showId, checks: $checks, lightingMode: false)
            }
            Tab(locale.t("mode.lighting"), systemImage: "lightbulb") {
                ShowDetailView(showId: showId, checks: $checks, lightingMode: true)
            }
            Tab(locale.t("show.photos"), systemImage: "photo.on.rectangle") {
                PhotosTabView(showId: showId)
            }
        }
        .navigationTitle(show?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)  // globale TabBar ausblenden
        .task { await loadShow() }
    }

    private func loadShow() async {
        guard let fetched = try? await pb.fetchShow(id: showId) else { return }
        show = fetched
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

#Preview {
    NavigationStack {
        ShowContainerView(showId: "preview")
    }
    .environment(PocketBaseClient.shared)
    .environment(AppLocale.shared)
}
