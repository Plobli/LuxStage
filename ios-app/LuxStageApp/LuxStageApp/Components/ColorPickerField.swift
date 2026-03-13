import SwiftUI

// Lädt filters.json aus dem App-Bundle
private let filterPresets: [FilterPreset] = {
    guard let url = Bundle.main.url(forResource: "filters", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let presets = try? JSONDecoder().decode([FilterPreset].self, from: data)
    else { return [] }
    return presets
}()

struct ColorPickerField: View {
    @Binding var value: String
    @State private var showPicker = false
    @State private var customText = ""
    @State private var brandFilter: String? = nil

    private var brands: [String] {
        Array(Set(filterPresets.map { $0.brand })).sorted()
    }

    var body: some View {
        Button {
            customText = value
            showPicker = true
        } label: {
            HStack {
                if value.isEmpty {
                    Text("Farbe / Filter wählen …")
                        .foregroundStyle(.secondary)
                } else {
                    Text(value)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .foregroundStyle(.primary)
        .sheet(isPresented: $showPicker) {
            ColorPickerSheet(value: $value, isPresented: $showPicker)
        }
    }
}

struct ColorPickerSheet: View {
    @Binding var value: String
    @Binding var isPresented: Bool

    @State private var customText: String = ""
    @State private var brandFilter: String? = nil
    @State private var searchText = ""

    private var brands: [String] {
        Array(Set(filterPresets.map { $0.brand })).sorted()
    }

    private var filtered: [FilterPreset] {
        filterPresets.filter { preset in
            (brandFilter == nil || preset.brand == brandFilter) &&
            (searchText.isEmpty ||
             preset.code.lowercased().contains(searchText.lowercased()) ||
             preset.name.lowercased().contains(searchText.lowercased()))
        }
    }

    var body: some View {
        NavigationStack {
            List {
                // Freitext
                Section("Freitext") {
                    HStack {
                        TextField("z.B. R02 oder warm weiß", text: $customText)
                        if !customText.isEmpty {
                            Button("Übernehmen") {
                                value = customText
                                isPresented = false
                            }
                            .font(.footnote)
                        }
                    }
                }

                // Filter-Presets
                Section {
                    Picker("Hersteller", selection: $brandFilter) {
                        Text("Alle").tag(Optional<String>.none)
                        ForEach(brands, id: \.self) { b in
                            Text(b).tag(Optional(b))
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    ForEach(filtered) { preset in
                        Button {
                            value = preset.code
                            isPresented = false
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(preset.code).font(.headline)
                                    Text(preset.name).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                if value == preset.code {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.tint)
                                }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }

                if !value.isEmpty {
                    Section {
                        Button("Leeren", role: .destructive) {
                            value = ""
                            isPresented = false
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Filter suchen …")
            .navigationTitle("Farbe / Filter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { isPresented = false }
                }
            }
            .onAppear { customText = value }
        }
    }
}

#Preview {
    @Previewable @State var color = "R27"
    Form {
        ColorPickerField(value: $color)
    }
}
