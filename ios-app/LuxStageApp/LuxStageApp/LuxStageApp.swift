import SwiftUI

@main
struct LuxStageApp: App {
    @State private var pb = PocketBaseClient.shared

    var body: some Scene {
        WindowGroup {
            if pb.isAuthenticated {
                MainTabView()
                    .environment(pb)
            } else {
                LoginView()
                    .environment(pb)
            }
        }
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            ShowsListView()
                .tabItem { Label("Shows", systemImage: "theatermasks") }

            SettingsView()
                .tabItem { Label("Einstellungen", systemImage: "gear") }
        }
    }
}
