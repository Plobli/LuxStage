import SwiftUI

struct ChannelEditSheet: View {
    let channel: Channel
    let showId: String
    let onSave: (Channel) -> Void
    let onDelete: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(SyncEngine.self) private var sync

    @State private var device: String
    @State private var addressRaw: String
    @State private var color: String
    @State private var category: String
    @State private var description: String
    @State private var saving = false
    @State private var confirmDelete = false
    @State private var error: String?

    init(channel: Channel, showId: String, onSave: @escaping (Channel) -> Void, onDelete: @escaping (String) -> Void) {
        self.channel = channel
        self.showId = showId
        self.onSave = onSave
        self.onDelete = onDelete
        _device = State(initialValue: channel.device ?? "")
        _addressRaw = State(initialValue: channel.addressDisplay == "—" ? "" : channel.addressDisplay)
        _color = State(initialValue: channel.color ?? "")
        _category = State(initialValue: channel.category ?? "")
        _description = State(initialValue: channel.description ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Kanal \(channel.channel_number)") {
                    TextField("Beschreibung", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                        .font(.body)
                }

                Section("Farbe / Filter") {
                    ColorPickerField(value: $color)
                }

                Section("Details") {
                    LabeledContent("Adresse") {
                        TextField("1/001", text: $addressRaw)
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.numbersAndPunctuation)
                    }
                    LabeledContent("Gerät") {
                        TextField("", text: $device)
                            .multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Kategorie") {
                        TextField("", text: $category)
                            .multilineTextAlignment(.trailing)
                    }
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }

                Section {
                    Button("Kanal löschen", role: .destructive) {
                        confirmDelete = true
                    }
                }
            }
            .navigationTitle("Kanal bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") { save() }
                        .disabled(saving)
                }
            }
            .confirmationDialog(
                "Kanal \(channel.channel_number) wirklich löschen?",
                isPresented: $confirmDelete,
                titleVisibility: .visible
            ) {
                Button("Löschen", role: .destructive) { delete() }
                Button("Abbrechen", role: .cancel) {}
            }
        }
    }

    private func parseAddress(_ s: String) -> (universe: Int?, dmx: Int?) {
        let parts = s.split(separator: "/")
        guard parts.count == 2 else { return (nil, nil) }
        return (Int(parts[0]), Int(parts[1]))
    }

    private func save() {
        saving = true
        error = nil
        let (universe, dmx) = parseAddress(addressRaw)
        Task {
            do {
                let updated = try await sync.updateChannel(
                    id: channel.id,
                    fields: [
                        "device": device.isEmpty ? nil : device,
                        "color": color.isEmpty ? nil : color,
                        "category": category.isEmpty ? nil : category,
                        "description": description.isEmpty ? nil : description,
                        "universe": universe,
                        "dmx_address": dmx,
                    ],
                    showId: showId
                )
                onSave(updated)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            saving = false
        }
    }

    private func delete() {
        Task {
            do {
                try await sync.deleteChannel(id: channel.id, showId: showId)
                onDelete(channel.id)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

#Preview {
    let channel = Channel(
        id: "preview", show: "show1", channel_number: "1",
        universe: 1, dmx_address: 42, device: "Sixbar 1000",
        color: "R27", description: "Front links", category: "Frontlicht",
        active: true, position: 0
    )
    ChannelEditSheet(channel: channel, showId: "show1", onSave: { _ in }, onDelete: { _ in })
        .environment(SyncEngine.shared)
}
