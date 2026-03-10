import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var pb: PocketBaseClient
    @State private var serverURL = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Server-URL", text: $serverURL)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .onSubmit { pb.baseURL = serverURL }
                } footer: {
                    Text("z.B. http://192.168.1.100:8090")
                        .font(.caption2)
                }

                Section {
                    Button("Abmelden", role: .destructive) {
                        pb.logout()
                    }
                }
            }
            .navigationTitle("Einstellungen")
            .onAppear { serverURL = pb.baseURL }
            .onChange(of: serverURL) { _, new in
                pb.baseURL = new
            }
        }
    }
}
