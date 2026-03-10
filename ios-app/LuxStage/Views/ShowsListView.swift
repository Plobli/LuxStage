import SwiftUI

struct ShowsListView: View {
    @EnvironmentObject private var pb: PocketBaseClient

    @State private var shows: [Show] = []
    @State private var showArchived = false
    @State private var loading = false
    @State private var error: String?
    @State private var showNewSheet = false
    @State private var templates: [VenueTemplate] = []

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
                        ForEach(shows) { show in
                            NavigationLink(destination: ShowDetailView(showId: show.id)) {
                                ShowRow(show: show)
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
    @EnvironmentObject private var pb: PocketBaseClient

    @State private var name = ""
    @State private var date = Date()
    @State private var hasDate = false
    @State private var selectedTemplate: VenueTemplate?
    @State private var saving = false
    @State private var error: String?

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
                    Section("Vorlage") {
                        Picker("Vorlage", selection: $selectedTemplate) {
                            Text("Keine Vorlage").tag(Optional<VenueTemplate>.none)
                            ForEach(templates) { t in
                                Text(t.name).tag(Optional(t))
                            }
                        }
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
