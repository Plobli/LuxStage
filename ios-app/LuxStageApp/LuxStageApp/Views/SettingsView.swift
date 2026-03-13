import SwiftUI
import UIKit

private extension View {
    func hideKeyboard() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

struct SettingsView: View {
    @Environment(PocketBaseClient.self) private var pb
    @Environment(AppLocale.self) private var locale
    @State private var serverURL = ""
    @State private var templates: [VenueTemplate] = []
    @State private var oscByTemplate: [String: OSCSettings] = [:]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(locale.t("settings.server_url"), text: $serverURL)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .submitLabel(.done)
                } header: {
                    Text(locale.t("settings.server"))
                } footer: {
                    Text(locale.t("settings.server_url.placeholder"))
                        .font(.caption2)
                }

                Section {
                    Picker(locale.t("settings.language"), selection: Binding(
                        get: { locale.language },
                        set: { locale.setLanguage($0) }
                    )) {
                        Text(locale.t("settings.language.de")).tag("de")
                        Text(locale.t("settings.language.en")).tag("en")
                    }
                } header: {
                    Text(locale.t("settings.language"))
                }

                ForEach(templates) { template in
                    OSCTemplateSection(template: template, settings: oscBinding(for: template.id))
                }

                Section {
                    Button(locale.t("settings.logout"), role: .destructive) {
                        pb.logout()
                    }
                }
            }
            .navigationTitle(locale.t("nav.settings"))
            .onAppear { serverURL = pb.baseURL; loadTemplates() }
            .onChange(of: serverURL) { _, new in pb.baseURL = new }
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(locale.t("action.done")) { hideKeyboard() }
                }
            }
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
    @Environment(AppLocale.self) private var locale
    @State private var portText: String = ""

    var body: some View {
        Section {
            LabeledContent(locale.t("settings.osc.ip")) {
                TextField("192.168.1.100", text: $settings.host)
                    .keyboardType(.numbersAndPunctuation)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .submitLabel(.done)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent(locale.t("settings.osc.port")) {
                TextField("8000", text: $portText)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 80)
            }
            LabeledContent(locale.t("settings.osc.full")) {
                TextField("/eos/chan/{chan}/full", text: $settings.fullCommand)
                    .multilineTextAlignment(.trailing)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .submitLabel(.done)
            }
            LabeledContent(locale.t("settings.osc.out")) {
                TextField("/eos/chan/{chan}/out", text: $settings.outCommand)
                    .multilineTextAlignment(.trailing)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .submitLabel(.done)
            }
        } header: {
            Text("OSC – \(template.name)")
        } footer: {
            Text(locale.t("settings.osc.autosave"))
                .font(.caption2)
        }
        .onAppear { portText = String(settings.port) }
        .onChange(of: portText) { _, new in
            if let val = UInt16(new.filter(\.isNumber)) { settings.port = val }
        }
        .onChange(of: settings) { _, _ in settings.save(templateId: template.id) }
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
    .environment(PocketBaseClient.shared)
    .environment(AppLocale.shared)
}
