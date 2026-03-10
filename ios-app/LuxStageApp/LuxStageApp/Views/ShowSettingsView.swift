import SwiftUI

/// Show-Tab "Einstellungen": OSC pro Bühne + globale App-Einstellungen.
struct ShowSettingsView: View {
    let showId: String
    let show: Show?
    @Binding var oscSettings: OSCSettings
    @Environment(PocketBaseClient.self) private var pb

    @State private var hostText = ""
    @State private var portText = ""
    @State private var fullCmd = ""
    @State private var outCmd = ""
    @State private var serverURL = ""
    @State private var saved = false

    private var templateId: String? { show?.template }
    private var venueName: String { show.map { _ in "Bühne" } ?? "Bühne" }

    var body: some View {
        Form {
            // OSC pro Bühne
            Section {
                TextField("IP-Adresse", text: $hostText)
                    .keyboardType(.numbersAndPunctuation)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                HStack {
                    Text("Port")
                    Spacer()
                    TextField("8000", text: $portText)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
            } header: {
                Text("OSC – \(show?.name ?? "Bühne")")
            } footer: {
                Text("Einstellungen gelten für alle Shows dieser Bühne.")
                    .font(.caption2)
            }

            Section("OSC-Befehle") {
                LabeledContent("Full") {
                    TextField("/etc/chan/{chan}/full", text: $fullCmd)
                        .multilineTextAlignment(.trailing)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                LabeledContent("Out") {
                    TextField("/etc/chan/{chan}/out", text: $outCmd)
                        .multilineTextAlignment(.trailing)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
            }

            Section {
                Button(saved ? "Gespeichert ✓" : "Speichern") {
                    applyOSC()
                }
                .disabled(saved)
            }

            // Globale App-Einstellungen
            Section {
                TextField("Server-URL", text: $serverURL)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .onChange(of: serverURL) { _, new in pb.baseURL = new }
            } header: {
                Text("Server")
            } footer: {
                Text("z.B. http://192.168.1.100:8090")
                    .font(.caption2)
            }

            Section {
                Button("Abmelden", role: .destructive) { pb.logout() }
            }
        }
        .navigationTitle("Einstellungen")
        .onAppear { loadValues() }
        .onChange(of: hostText) { _, _ in saved = false }
        .onChange(of: portText) { _, _ in saved = false }
        .onChange(of: fullCmd)  { _, _ in saved = false }
        .onChange(of: outCmd)   { _, _ in saved = false }
    }

    private func loadValues() {
        hostText = oscSettings.host
        portText = oscSettings.port == 8000 && oscSettings.host.isEmpty ? "" : "\(oscSettings.port)"
        fullCmd = oscSettings.fullCommand
        outCmd = oscSettings.outCommand
        serverURL = pb.baseURL
    }

    private func applyOSC() {
        oscSettings.host = hostText
        oscSettings.port = UInt16(portText) ?? 8000
        oscSettings.fullCommand = fullCmd.isEmpty ? "/etc/chan/{chan}/full" : fullCmd
        oscSettings.outCommand = outCmd.isEmpty ? "/etc/chan/{chan}/out" : outCmd
        if let tid = templateId { oscSettings.save(templateId: tid) }
        saved = true
    }
}
