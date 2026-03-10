import Foundation
import Network
import Observation

// MARK: - Sync Status

enum SyncState: Equatable {
    case idle
    case syncing
    case done(Date)
    case error(String)
}

// MARK: - SyncEngine

@Observable
final class SyncEngine {
    static let shared = SyncEngine()

    private(set) var state: SyncState = .idle
    private(set) var isOnline = false

    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "SyncEngine.monitor")
    private var pb: PocketBaseClient { PocketBaseClient.shared }
    private var store: LocalStore { LocalStore.shared }

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isOnline = path.status == .satisfied
            }
        }
        monitor.start(queue: monitorQueue)
    }

    // MARK: - Full Sync (push pending, then pull)

    func sync() async {
        guard isOnline else { return }
        guard case .idle = state else { return }

        state = .syncing

        do {
            try await pushPending()
            await pullShows()
        } catch {
            state = .error(error.localizedDescription)
            return
        }

        state = .done(Date())
    }

    // MARK: - Push pending operations

    private func pushPending() async throws {
        let ops = store.pendingOperations()
        for op in ops {
            do {
                try await execute(op)
                store.removePending(id: op.id)
            } catch let e as PBError {
                // 404 = Record wurde server-seitig gelöscht → Op verwerfen
                if case .httpError(let code, _) = e, code == 404 {
                    store.removePending(id: op.id)
                } else {
                    throw e
                }
            }
        }
    }

    private func execute(_ op: PendingOperation) async throws {
        guard let type = op.opType else { return }
        switch type {
        case .updateChannel:
            _ = try await pb.updateChannel(id: op.recordId, fields: op.payload.mapValues { Optional($0) })
        case .deleteChannel:
            try await pb.deleteChannel(id: op.recordId)
        case .createChannel:
            let ch = try await pb.createChannel(showId: op.showId, fields: op.payload.mapValues { Optional($0) })
            // lokale Temp-ID durch echte ID ersetzen
            store.deleteChannel(id: op.recordId)
            store.saveChannel(ch)
        case .updateShow:
            let show = try await pb.updateShow(id: op.recordId, fields: op.payload)
            store.saveShow(show)
        }
    }

    // MARK: - Pull (Shows + Channels für offene Shows)

    private func pullShows() async {
        guard let shows = try? await pb.fetchShows(archived: false) else { return }
        store.saveShows(shows)

        // Channels für alle aktiven Shows aktualisieren
        await withTaskGroup(of: Void.self) { group in
            for show in shows {
                group.addTask {
                    guard let channels = try? await self.pb.fetchChannels(showId: show.id) else { return }
                    self.store.saveChannels(channels, showId: show.id)
                }
            }
        }
    }

    // MARK: - Offline-aware data access

    /// Lädt Shows: erst aus Cache, dann im Hintergrund vom Server
    func fetchShows(archived: Bool) async throws -> [Show] {
        let cached = store.loadShows(archived: archived)

        if isOnline {
            let fresh = try await pb.fetchShows(archived: archived)
            store.saveShows(fresh)
            return fresh
        }

        return cached
    }

    func fetchChannels(showId: String) async throws -> [Channel] {
        let cached = store.loadChannels(showId: showId)

        if isOnline {
            let fresh = try await pb.fetchChannels(showId: showId)
            store.saveChannels(fresh, showId: showId)
            return fresh
        }

        return cached
    }

    // MARK: - Offline-aware mutations

    func updateChannel(id: String, fields: [String: Any?], showId: String) async throws -> Channel {
        // Sofort lokal anwenden
        var channels = store.loadChannels(showId: showId)
        guard var ch = channels.first(where: { $0.id == id }) else {
            throw PBError.httpError(404, "Channel not found in cache")
        }
        apply(fields: fields, to: &ch)
        store.saveChannel(ch)

        if isOnline {
            let updated = try await pb.updateChannel(id: id, fields: fields)
            store.saveChannel(updated)
            return updated
        } else {
            // In Queue einreihen
            let cleanPayload = fields.compactMapValues { $0 } as [String: Any]
            store.enqueue(PendingOperation(type: .updateChannel, recordId: id, showId: showId, payload: cleanPayload))
            return ch
        }
    }

    func deleteChannel(id: String, showId: String) async throws {
        store.deleteChannel(id: id)

        if isOnline {
            try await pb.deleteChannel(id: id)
        } else {
            store.enqueue(PendingOperation(type: .deleteChannel, recordId: id, showId: showId, payload: [:]))
        }
    }

    func createChannel(showId: String, fields: [String: Any?]) async throws -> Channel {
        if isOnline {
            let ch = try await pb.createChannel(showId: showId, fields: fields)
            store.saveChannel(ch)
            return ch
        } else {
            // Temporäre lokale ID
            let tempId = "local_\(UUID().uuidString)"
            let cleanPayload = fields.compactMapValues { $0 } as [String: Any]
            var channelFields = cleanPayload
            channelFields["channel_number"] = channelFields["channel_number"] as? String ?? "?"
            let ch = Channel(
                id: tempId, show: showId,
                channel_number: channelFields["channel_number"] as? String ?? "?",
                universe: channelFields["universe"] as? Int,
                dmx_address: channelFields["dmx_address"] as? Int,
                device: channelFields["device"] as? String,
                color: channelFields["color"] as? String,
                description: channelFields["description"] as? String,
                category: channelFields["category"] as? String,
                active: nil, position: nil
            )
            store.saveChannel(ch)
            store.enqueue(PendingOperation(type: .createChannel, recordId: tempId, showId: showId, payload: cleanPayload))
            return ch
        }
    }

    func updateShow(id: String, fields: [String: Any], showId: String) async throws -> Show {
        if isOnline {
            let show = try await pb.updateShow(id: id, fields: fields)
            store.saveShow(show)
            return show
        } else {
            store.enqueue(PendingOperation(type: .updateShow, recordId: id, showId: showId, payload: fields))
            // Lokal aktualisieren (best-effort)
            var shows = store.loadShows(archived: false) + store.loadShows(archived: true)
            if var show = shows.first(where: { $0.id == id }) {
                // custom_field_values updaten
                if let cfv = fields["custom_field_values"] as? [String: Any] {
                    show = Show(id: show.id, name: show.name, date: show.date, template: show.template,
                                archived: show.archived, custom_field_values: AnyCodable(cfv),
                                created: show.created, updated: show.updated, expand: show.expand)
                }
                store.saveShow(show)
                return show
            }
            throw PBError.httpError(404, "Show not found in cache")
        }
    }

    // MARK: - Helpers

    private func apply(fields: [String: Any?], to ch: inout Channel) {
        if let v = fields["channel_number"] as? String { ch.channel_number = v }
        if let v = fields["device"]         { ch.device       = v as? String }
        if let v = fields["color"]          { ch.color        = v as? String }
        if let v = fields["description"]    { ch.description  = v as? String }
        if let v = fields["category"]       { ch.category     = v as? String }
        if let v = fields["universe"]       { ch.universe     = v as? Int }
        if let v = fields["dmx_address"]    { ch.dmx_address  = v as? Int }
    }
}
