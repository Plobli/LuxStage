import SwiftUI

struct LoginView: View {
    @Environment(PocketBaseClient.self) private var pb

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
                    TextField("E-Mail", text: $email)
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    SecureField("Passwort", text: $password)
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
                                Text("Anmelden …")
                            }
                        } else {
                            Text("Anmelden")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(email.isEmpty || password.isEmpty || loading)
                }

                Section {
                    DisclosureGroup("Server-Einstellungen", isExpanded: $showServerField) {
                        TextField("Server-URL", text: $serverURL)
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
}

