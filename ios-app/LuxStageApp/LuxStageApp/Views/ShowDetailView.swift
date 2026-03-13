import SwiftUI
import WebKit

struct ShowDetailView: View {
    let showId: String
    @Binding var checks: Set<String>
    let lightingMode: Bool

    @Environment(PocketBaseClient.self) private var pb
    @Environment(AppLocale.self) private var locale
    @Environment(SyncEngine.self) private var sync

    @State private var show: Show?
    @State private var oscSettings = OSCSettings()
    @State private var channels: [Channel] = []
    @State private var customFields: [CustomFieldEntry] = []
    @State private var loading = true
    @State private var error: String?
    @State private var search = ""
    @State private var editingChannel: Channel?
    @State private var customValues: [String: String] = [:]
    @State private var setupText = ""
    @State private var setupSaveTask: Task<Void, Never>?
    @State private var editingSetup = false

    var body: some View {
        Group {
            if loading {
                ProgressView(locale.t("error.loading"))
            } else if show != nil {
                content
            }
        }
        .task { await load() }
        .alert(locale.t("error.generic"), isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button(locale.t("action.ok")) {}
        } message: {
            Text(error ?? "")
        }
        .sheet(item: $editingChannel) { ch in
            ChannelEditSheet(channel: ch, showId: showId, onSave: { updated in
                updateLocal(channel: updated)
            }, onDelete: { id in
                channels.removeAll { $0.id == id }
            })
        }
        .sheet(isPresented: $editingSetup) {
            SetupEditSheet(html: setupText) { newHTML in
                setupText = newHTML
                Task { await saveCustomField("Aufbau", value: newHTML) }
            }
        }
    }

    // MARK: - Content

    private var content: some View {
        List {
            if !lightingMode {
                setupSection
                if !allCustomFields.isEmpty { customFieldsSection }
            }
            channelSection
        }
        .searchable(text: $search, prompt: locale.t("channel.search"))
        .listStyle(.insetGrouped)
        .refreshable { await reload() }
    }

    // MARK: - Setup Section

    private var setupSection: some View {
        Section {
            HTMLTextView(html: setupText).frame(minHeight: 80)
        } header: {
            HStack {
                Text(locale.t("show.aufbau"))
                Spacer()
                Button { editingSetup = true } label: {
                    Text(locale.t("action.edit"))
                        .font(.subheadline)
                        .textCase(nil)
                }
            }
        }
    }

    // MARK: - Custom Fields Section

    private var allCustomFields: [CustomFieldEntry] {
        let raw = show?.custom_field_values?.value as? [String: Any] ?? [:]
        let hidden = (raw["__hidden__"] as? [String]) ?? []
        return customFields.filter { !hidden.contains($0.field_name) }
    }

    private var customFieldsSection: some View {
        Section(locale.t("template.custom_fields")) {
            ForEach(allCustomFields) { field in
                LabeledContent(field.field_name) {
                    TextField(field.unit_hint ?? "", text: Binding(
                        get: { customValues[field.field_name] ?? "" },
                        set: { newVal in
                            customValues[field.field_name] = newVal
                            setupSaveTask?.cancel()
                            setupSaveTask = Task {
                                try? await Task.sleep(for: .milliseconds(600))
                                guard !Task.isCancelled else { return }
                                await saveCustomField(field.field_name, value: newVal)
                            }
                        }
                    ))
                    .multilineTextAlignment(.trailing)
                }
            }
        }
    }

    // MARK: - Channel Section

    private var filteredGrouped: [(category: String, channels: [Channel])] {
        let q = search.lowercased()
        var filtered = channels.sorted { (Int($0.channel_number) ?? 0) < (Int($1.channel_number) ?? 0) }
        if !q.isEmpty {
            filtered = filtered.filter {
                $0.channel_number.lowercased().contains(q) ||
                ($0.device?.lowercased().contains(q) ?? false) ||
                ($0.description?.lowercased().contains(q) ?? false) ||
                ($0.category?.lowercased().contains(q) ?? false)
            }
        }
        if lightingMode {
            filtered = filtered.filter { !($0.description?.isEmpty ?? true) }
        }
        var groups: [(String, [Channel])] = []
        var seen: [String: Int] = [:]
        for ch in filtered {
            let cat = ch.categoryOrEmpty
            if let idx = seen[cat] { groups[idx].1.append(ch) }
            else { seen[cat] = groups.count; groups.append((cat, [ch])) }
        }
        return groups.map { (category: $0.0, channels: $0.1) }
    }

    @ViewBuilder
    private var channelSection: some View {
        ForEach(filteredGrouped, id: \.category) { group in
            Section {
                ForEach(group.channels) { ch in
                    if lightingMode {
                        LightingChannelRow(
                            channel: ch,
                            isChecked: checks.contains(ch.id),
                            onOSCToggle: { isOn in oscSend(ch, isOn: isOn) },
                            onCheckToggle: { toggleCheck(ch) }
                        )
                    } else {
                        ChannelRow(channel: ch) {
                            editingChannel = ch
                        }
                    }
                }
            } header: {
                HStack {
                    Text(group.category.isEmpty ? locale.t("channel.no_category") : group.category)
                    Spacer()
                    if lightingMode {
                        let done = group.channels.filter { checks.contains($0.id) }.count
                        Text("\(done)/\(group.channels.count)").foregroundStyle(.secondary)
                    } else {
                        Text("\(group.channels.count)").foregroundStyle(.secondary)
                    }
                }
            }
        }
        if !lightingMode {
            Section {
                Button { } label: { Label(locale.t("channel.add"), systemImage: "plus") }
            }
        }
    }

    // MARK: - Data loading

    private func reload() async {
        async let fetchedShow = sync.fetchShow(id: showId)
        async let fetchedChannels = sync.fetchChannels(showId: showId)
        guard let fs = await fetchedShow else { return }
        let fc = await fetchedChannels

        show = fs
        channels = fc
        let raw = fs.custom_field_values?.value as? [String: Any] ?? [:]
        customValues = raw.compactMapValues { $0 as? String }
        setupText = customValues["Aufbau"] ?? ""
        if let tid = fs.template {
            if !lightingMode {
                let templateFields = (try? await pb.fetchTemplateCustomFields(templateId: tid)) ?? []
                let extraRaw = (raw["__extra__"] as? [[String: Any]]) ?? []
                let extraFields = extraRaw.compactMap { dict -> CustomFieldEntry? in
                    guard let name = dict["field_name"] as? String else { return nil }
                    return CustomFieldEntry(field_name: name, unit_hint: dict["unit_hint"] as? String)
                }
                let templateEntries = templateFields.map { CustomFieldEntry(field_name: $0.field_name, unit_hint: $0.unit_hint) }
                customFields = templateEntries + extraFields.filter { e in !templateEntries.contains(where: { $0.field_name == e.field_name }) }
            }
            oscSettings = OSCSettings.load(templateId: tid)
        } else {
            if !lightingMode {
                let extraRaw = (raw["__extra__"] as? [[String: Any]]) ?? []
                customFields = extraRaw.compactMap { dict -> CustomFieldEntry? in
                    guard let name = dict["field_name"] as? String else { return nil }
                    return CustomFieldEntry(field_name: name, unit_hint: dict["unit_hint"] as? String)
                }
            }
        }
    }

    private func load() async {
        loading = true
        await reload()
        loading = false
    }

    private func updateLocal(channel: Channel) {
        if let idx = channels.firstIndex(where: { $0.id == channel.id }) { channels[idx] = channel }
    }

    // MARK: - Custom field save

    private func saveCustomField(_ fieldName: String, value: String) async {
        var raw = (show?.custom_field_values?.value as? [String: Any]) ?? [:]
        raw[fieldName] = value
        await persistCustomValues(raw)
    }

    private func persistCustomValues(_ values: [String: Any]) async {
        do {
            let updated = try await sync.updateShow(id: showId, fields: ["custom_field_values": values], showId: showId)
            show = updated
        } catch { self.error = error.localizedDescription }
    }

    // MARK: - OSC & Checks

    private func oscSend(_ channel: Channel, isOn: Bool) {
        let cmd = isOn ? oscSettings.fullCommand : oscSettings.outCommand
        sendOSC(cmd, channel: channel.channel_number)
    }

    private func toggleCheck(_ channel: Channel) {
        if checks.contains(channel.id) {
            checks.remove(channel.id)
        } else {
            checks.insert(channel.id)
        }
        saveChecks()
    }

    private func sendOSC(_ template: String, channel: String) {
        guard !oscSettings.host.isEmpty else { return }
        OSCClient.shared.send(address: oscSettings.address(for: template, channel: channel),
                              host: oscSettings.host, port: oscSettings.port)
    }

    private func saveChecks() {
        UserDefaults.standard.set(["checks": Array(checks), "ts": Date().timeIntervalSince1970],
                                  forKey: "lighting_check_\(showId)")
    }
}

// MARK: - Lighting Channel Row

private struct LightingChannelRow: View {
    let channel: Channel
    let isChecked: Bool
    let onOSCToggle: (Bool) -> Void
    let onCheckToggle: () -> Void

    @Environment(AppLocale.self) private var locale
    @State private var oscIsOn = false

    var body: some View {
        HStack(spacing: 12) {
            // Fertig-Häkchen (links)
            Button(action: onCheckToggle) {
                Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isChecked ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                    .font(.title2)
            }
            .buttonStyle(.plain)

            // Kanalinfo (mitte)
            VStack(alignment: .leading, spacing: 3) {
                Text(locale.t("channel.label").replacingOccurrences(of: "{number}", with: channel.channel_number)).font(.headline)
                if let desc = channel.description, !desc.isEmpty {
                    Text(desc).font(.callout).foregroundStyle(.primary)
                        .padding(.horizontal, 8).padding(.vertical, 4)
                        .background(Color(.systemGray5))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }

            Spacer()

            // AN/AUS OSC-Button (rechts)
            Button(action: {
                oscIsOn.toggle()
                onOSCToggle(oscIsOn)
            }) {
                Text(oscIsOn ? locale.t("channel.osc.on") : locale.t("channel.osc.off"))
                    .font(.caption).fontWeight(.semibold)
                    .frame(width: 44, height: 30)
                    .background(oscIsOn ? Color.orange : Color(.systemGray5))
                    .foregroundStyle(oscIsOn ? Color.white : Color.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
        .opacity(isChecked ? 0.5 : 1)
    }
}

// MARK: - Channel Row (normal mode)

private struct ChannelRow: View {
    let channel: Channel
    let onTap: () -> Void

    private var paddedChannelNumber: String {
        if let num = Int(channel.channel_number), num < 10 {
            return String(format: "%02d", num)
        }
        return channel.channel_number
    }

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .center, spacing: 14) {
                Text(paddedChannelNumber)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .frame(minWidth: 48, alignment: .trailing)

                VStack(alignment: .leading, spacing: 4) {
                    if let desc = channel.description, !desc.isEmpty {
                        Text(desc).font(.subheadline).fontWeight(.medium)
                    }
                    HStack(spacing: 6) {
                        if let device = channel.device, !device.isEmpty {
                            Text(device).font(.caption).foregroundStyle(.secondary)
                        }
                        if let color = channel.color, !color.isEmpty {
                            Text(color).font(.caption)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color(.systemGray5)).clipShape(Capsule())
                        }
                    }
                }

                Spacer()
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
            }
            .padding(.vertical, 4)
        }
        .foregroundStyle(.primary)
    }
}

// MARK: - Setup Edit Sheet

private struct SetupEditSheet: View {
    let html: String
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AppLocale.self) private var locale
    @State private var draft: String

    init(html: String, onSave: @escaping (String) -> Void) {
        self.html = html
        self.onSave = onSave
        _draft = State(initialValue: html)
    }

    var body: some View {
        NavigationStack {
            RichTextEditor(html: $draft)
                .navigationTitle(locale.t("show.aufbau.edit"))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(locale.t("action.done")) {
                            onSave(draft)
                            dismiss()
                        }
                    }
                }
        }
    }
}

// MARK: - Custom Field Entry (vereinheitlicht Template + Extra)

struct CustomFieldEntry: Identifiable, Hashable {
    var id: String { field_name }
    var field_name: String
    var unit_hint: String?
}
#Preview {
    @Previewable @State var checks: Set<String> = []
    NavigationStack {
        ShowDetailView(showId: "preview", checks: $checks, lightingMode: false)
    }
    .environment(PocketBaseClient.shared)
    .environment(AppLocale.shared)
    .environment(SyncEngine.shared)
}

