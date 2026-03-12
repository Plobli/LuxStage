import SwiftUI
import PhotosUI

struct ShowContainerView: View {
    let showId: String

    @Environment(PocketBaseClient.self) private var pb
    @Environment(AppLocale.self) private var locale
    @State private var show: Show?
    @State private var checks: Set<String> = []
    @State private var selectedTab: Int = 0
    @State private var photoPickerItems: [PhotosPickerItem] = []
    @State private var photosUploadTrigger: [PhotosPickerItem] = []

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab(locale.t("show.aufbau"), systemImage: "wrench.and.screwdriver", value: 0) {
                ShowDetailView(showId: showId, checks: $checks, lightingMode: false)
            }
            Tab(locale.t("mode.lighting"), systemImage: "lightbulb", value: 1) {
                ShowDetailView(showId: showId, checks: $checks, lightingMode: true)
            }
            Tab(locale.t("show.photos"), systemImage: "photo.on.rectangle", value: 2) {
                PhotosTabView(showId: showId, externalUpload: $photosUploadTrigger)
            }
        }
        .navigationTitle(show?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            if selectedTab == 2 {
                ToolbarItem(placement: .navigationBarTrailing) {
                    PhotosPicker(selection: $photoPickerItems, maxSelectionCount: 10, matching: .images) {
                        Label("Hinzufügen", systemImage: "plus")
                    }
                }
            }
        }
        .onChange(of: photoPickerItems) { _, items in
            guard !items.isEmpty else { return }
            photosUploadTrigger = items
            photoPickerItems = []
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

#Preview {
    NavigationStack {
        ShowContainerView(showId: "preview")
    }
    .environment(PocketBaseClient.shared)
    .environment(AppLocale.shared)
}
