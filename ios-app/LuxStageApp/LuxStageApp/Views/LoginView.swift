import SwiftUI

struct LoginView: View {
    @Environment(PocketBaseClient.self) private var pb
    @Environment(AppLocale.self) private var locale

    @State private var email = ""
    @State private var password = ""
    @State private var serverURL = ""
    @State private var showServerField = false
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(locale.t("auth.email"), text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    SecureField(locale.t("auth.password"), text: $password)
                        .textContentType(.password)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }

                Section {
                    Button(action: login) {
                        if loading {
                            HStack {
                                ProgressView()
                                Text(locale.t("auth.login.loading"))
                            }
                        } else {
                            Text(locale.t("auth.login.submit"))
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(email.isEmpty || password.isEmpty || loading)
                }

                Section {
                    DisclosureGroup(locale.t("settings.server_settings"), isExpanded: $showServerField) {
                        TextField(locale.t("settings.server_url"), text: $serverURL)
                            .keyboardType(.URL)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .onChange(of: serverURL) { _, new in
                                pb.baseURL = new
                            }
                    }
                } footer: {
                    Text(pb.baseURL)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("LuxStage")
            .onAppear {
                serverURL = pb.baseURL
            }
        }
    }

    private func login() {
        loading = true
        errorMessage = nil
        Task {
            do {
                try await pb.login(email: email, password: password)
            } catch {
                errorMessage = error.localizedDescription
            }
            loading = false
        }
    }
}
#Preview {
    LoginView()
        .environment(PocketBaseClient.shared)
        .environment(AppLocale.shared)
}

