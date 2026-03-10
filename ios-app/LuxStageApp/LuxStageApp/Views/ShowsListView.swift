import SwiftUI

struct ShowsListView: View {
    @Environment(PocketBaseClient.self) private var pb

    @State private var shows: [Show] = []
    @State private var showArchived = false
    @State private var loading = false
    @State private var error: String?
    @State private var showNewSheet = false
    @State private var templates: [VenueTemplate] = []

    private var groupedShows: [(venue: String, shows: [Show])] {
        var groups: [(String, [Show])] = []
        var seen: [String: Int] = [:]
        for show in shows {
            let venue = show.venueNameDisplay
            if let idx = seen[venue] { groups[idx].1.append(show) }
            else { seen[venue] = groups.count; groups.append((venue, [show])) }
        }
        return groups.map { (venue: $0.0, shows: $0.1) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if loading && shows.isEmpty {
                    ProgressView("Laden …")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if shows.isEmpty {
                    ContentUnavailableView(
                        showArchived ? "Keine archivierten Shows" : "Noch keine Shows",
                        systemImage: "theatermasks",
                        description: Text(showArchived ? "" : "Erstelle deine erste Show.")
                    )
                } else {
                    List {
                        ForEach(groupedShows, id: \.venue) { group in
                            Section(group.venue) {
                                ForEach(group.shows) { show in
                                    NavigationLink(destination: ShowContainerView(showId: show.id)) {
                                        ShowRow(show: show)
                                    }
                                }
                            }
                        }
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Shows")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        showArchived.toggle()
                        Task { await load() }
                    } label: {
                        Label(
                            showArchived ? "Aktiv" : "Archiv",
                            systemImage: showArchived ? "tray.and.arrow.up" : "archivebox"
                        )
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showNewSheet = true } label: {
                        Label("Neue Show", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewSheet) {
                NewShowSheet(templates: templates, onCreated: { show in
                    shows.insert(show, at: 0)
                })
            }
            .alert("Fehler", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("OK") {}
            } message: {
                Text(error ?? "")
            }
        }
        .task { await load() }
    }

    private func load() async {
        loading = true
        do {
            async let s = pb.fetchShows(archived: showArchived)
            async let t = pb.fetchTemplates()
            shows = try await s
            templates = (try? await t) ?? []
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

// MARK: - Row

private struct ShowRow: View {
    let show: Show

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(show.name)
                .font(.headline)
            if let date = show.formattedDate {
                Text(date)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - New Show Sheet

struct NewShowSheet: View {
    let templates: [VenueTemplate]
    let onCreated: (Show) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(PocketBaseClient.self) private var pb

    @State private var name = ""
    @State private var date = Date()
    @State private var hasDate = false
    @State private var selectedVenue: String = ""
    @State private var selectedTemplate: VenueTemplate?
    @State private var saving = false
    @State private var error: String?

    private var venues: [String] {
        var seen = Set<String>()
        return templates.compactMap { t in
            seen.insert(t.venue_name).inserted ? t.venue_name : nil
        }.sorted()
    }

    private var filteredTemplates: [VenueTemplate] {
        guard !selectedVenue.isEmpty else { return templates }
        return templates.filter { $0.venue_name == selectedVenue }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Show-Daten") {
                    TextField("Name", text: $name)
                    Toggle("Datum festlegen", isOn: $hasDate)
                    if hasDate {
                        DatePicker("Datum", selection: $date, displayedComponents: .date)
                    }
                }

                if !templates.isEmpty {
                    Section("Bühne & Vorlage") {
                        Picker("Bühne", selection: $selectedVenue) {
                            Text("Keine Bühne").tag("")
                            ForEach(venues, id: \.self) { v in
                                Text(v).tag(v)
                            }
                        }
                        .onChange(of: selectedVenue) { _, _ in
                            if let t = selectedTemplate, !filteredTemplates.contains(t) {
                                selectedTemplate = nil
                            }
                        }

                        Picker("Vorlage", selection: $selectedTemplate) {
                            Text("Keine Vorlage").tag(Optional<VenueTemplate>.none)
                            ForEach(filteredTemplates) { t in
                                Text(t.name).tag(Optional(t))
                            }
                        }
                        .disabled(filteredTemplates.isEmpty)
                    }
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red).font(.footnote) }
                }
            }
            .navigationTitle("Neue Show")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Erstellen") { create() }
                        .disabled(name.isEmpty || saving)
                }
            }
        }
    }

    private func create() {
        saving = true
        error = nil
        Task {
            do {
                let isoDate: String? = hasDate ? ISO8601DateFormatter().string(from: date) : nil
                let show = try await pb.createShow(
                    name: name,
                    date: isoDate,
                    templateId: selectedTemplate?.id
                )
                onCreated(show)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            saving = false
        }
    }
}
