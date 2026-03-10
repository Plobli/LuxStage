import SwiftUI

struct OSCSettingsSheet: View {
    @Binding var settings: OSCSettings
    let showId: String
    @Environment(\.dismiss) private var dismiss

    @State private var hostText = ""
    @State private var portText = ""
    @State private var fullCmd = ""
    @State private var outCmd = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("IP-Adresse", text: $hostText)
                        .keyboardType(.decimalPad)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    TextField("Port", text: $portText)
                        .keyboardType(.numberPad)
                } header: {
                    Text("OSC-Konsole")
                } footer: {
                    Text("z.B. 192.168.1.50 · Port 8000")
                        .font(.caption2)
                }

                Section {
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
                } header: {
                    Text("OSC-Befehle")
                } footer: {
                    Text("{chan} wird durch die Kanalnummer ersetzt.")
                        .font(.caption2)
                }
            }
            .navigationTitle("OSC-Einstellungen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") {
                        apply()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .onAppear {
                hostText = settings.host
                portText = "\(settings.port)"
                fullCmd = settings.fullCommand
                outCmd = settings.outCommand
            }
        }
    }

    private func apply() {
        settings.host = hostText
        settings.port = UInt16(portText) ?? 8000
        settings.fullCommand = fullCmd.isEmpty ? "/etc/chan/{chan}/full" : fullCmd
        settings.outCommand = outCmd.isEmpty ? "/etc/chan/{chan}/out" : outCmd
        settings.save(showId: showId)
    }
}
