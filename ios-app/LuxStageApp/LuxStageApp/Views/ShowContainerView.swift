import SwiftUI

struct ShowContainerView: View {
    let showId: String

    @Environment(PocketBaseClient.self) private var pb
    @State private var show: Show?
    @State private var checks: Set<String> = []
    @State private var lightingMode = false

    var body: some View {
        ShowDetailView(showId: showId, checks: $checks, lightingMode: lightingMode)
            .navigationTitle(show?.name ?? "Show")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Modus", selection: $lightingMode) {
                        Text("Show").tag(false)
                        Text("Einleuchten").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 220)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink {
                        PhotosTabView(showId: showId)
                    } label: {
                        Image(systemName: "photo.on.rectangle")
                    }
                }
            }
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
