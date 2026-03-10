import SwiftUI

struct SettingsView: View {
    @Environment(PocketBaseClient.self) private var pb
    @State private var serverURL = ""
    @State private var templates: [VenueTemplate] = []
    @State private var oscByTemplate: [String: OSCSettings] = [:]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Server-URL", text: $serverURL)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("Server")
                } footer: {
                    Text("z.B. http://192.168.1.100:8090")
                        .font(.caption2)
                }

                ForEach(templates) { template in
                    OSCTemplateSection(template: template, settings: oscBinding(for: template.id))
                }

                Section {
                    Button("Abmelden", role: .destructive) {
                        pb.logout()
                    }
                }
            }
            .navigationTitle("Einstellungen")
            .onAppear { serverURL = pb.baseURL; loadTemplates() }
            .onChange(of: serverURL) { _, new in pb.baseURL = new }
        }
    }

    private func oscBinding(for templateId: String) -> Binding<OSCSettings> {
        Binding(
            get: { oscByTemplate[templateId] ?? OSCSettings() },
            set: { oscByTemplate[templateId] = $0 }
        )
    }

    private func loadTemplates() {
        Task {
            templates = (try? await pb.fetchTemplates()) ?? []
            for t in templates {
                oscByTemplate[t.id] = OSCSettings.load(templateId: t.id)
            }
        }
    }
}

// MARK: - OSC Section per Template

private struct OSCTemplateSection: View {
    let template: VenueTemplate
    @Binding var settings: OSCSettings
    @State private var saved = false

    var body: some View {
        Section {
            TextField("IP-Adresse", text: $settings.host)
                .keyboardType(.numbersAndPunctuation)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            HStack {
                Text("Port")
                Spacer()
                TextField("8000", value: $settings.port, format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
            }
            LabeledContent("Full") {
                TextField("/etc/chan/{chan}/full", text: $settings.fullCommand)
                    .multilineTextAlignment(.trailing)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
            LabeledContent("Out") {
                TextField("/etc/chan/{chan}/out", text: $settings.outCommand)
                    .multilineTextAlignment(.trailing)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            }
            Button(saved ? "Gespeichert ✓" : "Speichern") {
                settings.save(templateId: template.id)
                saved = true
            }
            .disabled(saved)
        } header: {
            Text("OSC – \(template.name)")
        } footer: {
            Text("Gilt für alle Shows an dieser Bühne.")
                .font(.caption2)
        }
        .onChange(of: settings.host)        { _, _ in saved = false }
        .onChange(of: settings.port)        { _, _ in saved = false }
        .onChange(of: settings.fullCommand) { _, _ in saved = false }
        .onChange(of: settings.outCommand)  { _, _ in saved = false }
    }
}
