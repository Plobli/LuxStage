import SwiftUI
import SwiftData

@main
struct LuxStageApp: App {
    @State private var pb = PocketBaseClient.shared
    @State private var locale = AppLocale.shared
    @State private var sync = SyncEngine.shared

    var body: some Scene {
        WindowGroup {
            if pb.isAuthenticated {
                MainTabView()
                    .environment(pb)
                    .environment(locale)
                    .environment(sync)
                    .modelContainer(LocalStore.shared.container)
                    .task { await sync.sync() }
            } else {
                LoginView()
                    .environment(pb)
                    .environment(locale)
            }
        }
    }
}

struct MainTabView: View {
    @Environment(AppLocale.self) private var locale
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var showSettings = false

    var body: some View {
        if sizeClass == .regular {
            // iPad: ShowsList direkt, Einstellungen per Toolbar-Button
            ShowsListView(showSettingsButton: true)
        } else {
            // iPhone: Tab Bar unten
            TabView {
                Tab(locale.t("nav.shows"), systemImage: "theatermasks") {
                    ShowsListView()
                }
                Tab(locale.t("nav.settings"), systemImage: "gear") {
                    SettingsView()
                }
            }
            .tabBarMinimizeBehavior(.onScrollDown)
        }
    }
}
