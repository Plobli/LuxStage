import SwiftUI

@main
struct LuxStageApp: App {
    @StateObject private var pb = PocketBaseClient.shared

    var body: some Scene {
        WindowGroup {
            if pb.isAuthenticated {
                MainTabView()
                    .environmentObject(pb)
            } else {
                LoginView()
                    .environmentObject(pb)
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
