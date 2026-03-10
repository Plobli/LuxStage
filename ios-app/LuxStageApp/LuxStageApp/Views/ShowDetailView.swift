import SwiftUI
import WebKit

struct ShowDetailView: View {
    let showId: String
    @Binding var oscSettings: OSCSettings
    @Binding var checks: Set<String>
    let lightingMode: Bool

    @Environment(PocketBaseClient.self) private var pb

    @State private var show: Show?
    @State private var channels: [Channel] = []
    @State private var customFields: [TemplateCustomField] = []
    @State private var loading = true
    @State private var error: String?
    @State private var search = ""
    @State private var editingChannel: Channel?
    @State private var customValues: [String: String] = [:]
    @State private var aufbauText = ""
    @State private var aufbauSaveTask: Task<Void, Never>?

    var body: some View {
        Group {
            if loading {
                ProgressView("Laden …")
            } else if show != nil {
                content
            }
        }
        .task { await load() }
        .alert("Fehler", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
            Button("OK") {}
        } message: {
            Text(error ?? "")
        }
        .sheet(item: $editingChannel) { ch in
            ChannelEditSheet(channel: ch, onSave: { updated in
                updateLocal(channel: updated)
            }, onDelete: { id in
                channels.removeAll { $0.id == id }
            })
        }
    }

    // MARK: - Content

    private var content: some View {
        List {
            aufbauSection
            if !allCustomFields.isEmpty { customFieldsSection }
            channelSection
        }
        .searchable(text: $search, prompt: "Suchen …")
        .listStyle(.insetGrouped)
        .refreshable { await reload() }
    }

    // MARK: - Aufbau Section

    private var aufbauSection: some View {
        Section("Aufbau") {
            HTMLTextView(html: aufbauText).frame(minHeight: 80)
        }
    }

    // MARK: - Custom Fields Section

    private var allCustomFields: [TemplateCustomField] {
        let hidden = (show?.custom_field_values?.value as? [String: Any])?
            .compactMapValues { $0 as? [String] }["__hidden__"] ?? []
        return customFields.filter { !hidden.contains($0.field_name) }
    }

    private var customFieldsSection: some View {
        Section("Felder") {
            ForEach(allCustomFields) { field in
                LabeledContent(field.field_name) {
                    TextField(field.unit_hint ?? "", text: Binding(
                        get: { customValues[field.field_name] ?? "" },
                        set: { newVal in
                            customValues[field.field_name] = newVal
                            aufbauSaveTask?.cancel()
                            aufbauSaveTask = Task {
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
                    ChannelRow(channel: ch, lightingMode: lightingMode, isChecked: checks.contains(ch.id)) {
                        if lightingMode { oscToggle(ch) } else { editingChannel = ch }
                    }
                }
            } header: {
                HStack {
                    Text(group.category.isEmpty ? "Ohne Kategorie" : group.category)
                    Spacer()
                    Text("\(group.channels.count)").foregroundStyle(.secondary)
                }
            }
        }
        if !lightingMode {
            Section {
                Button { } label: { Label("Kanal hinzufügen", systemImage: "plus") }
            }
        }
    }

    // MARK: - Data loading

    private func reload() async {
        do {
            async let s = pb.fetchShow(id: showId)
            async let chs = pb.fetchChannels(showId: showId)
            let (fs, fc) = try await (s, chs)
            show = fs; channels = fc
            if let tid = fs.template { customFields = (try? await pb.fetchTemplateCustomFields(templateId: tid)) ?? [] }
            if let raw = fs.custom_field_values?.value as? [String: Any] {
                customValues = raw.compactMapValues { $0 as? String }
                aufbauText = customValues["Aufbau"] ?? ""
            }
        } catch { self.error = error.localizedDescription }
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
            let updated = try await pb.updateShow(id: showId, fields: ["custom_field_values": values])
            show = updated
        } catch { self.error = error.localizedDescription }
    }

    // MARK: - OSC

    private func oscToggle(_ channel: Channel) {
        if checks.contains(channel.id) {
            sendOSC(oscSettings.fullCommand, channel: channel.channel_number)
            checks.remove(channel.id)
        } else {
            sendOSC(oscSettings.outCommand, channel: channel.channel_number)
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

// MARK: - Channel Row

private struct ChannelRow: View {
    let channel: Channel
    let lightingMode: Bool
    let isChecked: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                if lightingMode {
                    Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(isChecked ? .green : .secondary)
                        .font(.title3)
                }
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text("Kanal \(channel.channel_number)").font(.headline)
                        if let device = channel.device, !device.isEmpty {
                            Text("·").foregroundStyle(.secondary)
                            Text(device).font(.subheadline)
                        }
                    }
                    HStack(spacing: 6) {
                        Text(channel.addressDisplay).font(.caption).foregroundStyle(.secondary)
                        if let color = channel.color, !color.isEmpty {
                            Text(color).font(.caption)
                                .padding(.horizontal, 6).padding(.vertical, 1)
                                .background(.tint.opacity(0.15)).clipShape(Capsule())
                        }
                    }
                    if let desc = channel.description, !desc.isEmpty {
                        Text(desc).font(.callout).foregroundStyle(.primary)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(.tint.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                            .padding(.top, 4)
                    }
                }
                Spacer()
                if !lightingMode {
                    Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                }
            }
        }
        .foregroundStyle(.primary)
        .opacity(lightingMode && isChecked ? 0.5 : 1)
    }
}
