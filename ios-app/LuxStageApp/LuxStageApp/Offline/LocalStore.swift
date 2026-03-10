import SwiftData
import Foundation

// MARK: - SwiftData Models

@Model
final class CachedShow {
    @Attribute(.unique) var id: String
    var name: String
    var date: String?
    var template: String?
    var archived: Bool
    var customFieldValuesJSON: String?  // JSON-encoded [String: Any]
    var venueNameDisplay: String
    var serverUpdated: String           // PocketBase `updated` timestamp
    var cachedAt: Date

    init(from show: Show) {
        self.id = show.id
        self.name = show.name
        self.date = show.date
        self.template = show.template
        self.archived = show.archived
        self.customFieldValuesJSON = show.custom_field_values.flatMap {
            try? JSONSerialization.data(withJSONObject: $0.value)
        }.flatMap { String(data: $0, encoding: .utf8) }
        self.venueNameDisplay = show.venueNameDisplay
        self.serverUpdated = show.updated
        self.cachedAt = Date()
    }

    func update(from show: Show) {
        self.name = show.name
        self.date = show.date
        self.template = show.template
        self.archived = show.archived
        self.customFieldValuesJSON = show.custom_field_values.flatMap {
            try? JSONSerialization.data(withJSONObject: $0.value)
        }.flatMap { String(data: $0, encoding: .utf8) }
        self.venueNameDisplay = show.venueNameDisplay
        self.serverUpdated = show.updated
        self.cachedAt = Date()
    }

    var asShow: Show {
        let cfv: AnyCodable? = customFieldValuesJSON
            .flatMap { $0.data(using: .utf8) }
            .flatMap { try? JSONSerialization.jsonObject(with: $0) }
            .map { AnyCodable($0) }
        return Show(
            id: id, name: name, date: date, template: template,
            archived: archived, custom_field_values: cfv,
            created: "", updated: serverUpdated, expand: nil
        )
    }
}

@Model
final class CachedChannel {
    @Attribute(.unique) var id: String
    var showId: String
    var channelNumber: String
    var universe: Int?
    var dmxAddress: Int?
    var device: String?
    var color: String?
    var channelDescription: String?
    var category: String?
    var active: Bool?
    var position: Int?
    var serverUpdated: String
    var cachedAt: Date

    init(from ch: Channel) {
        self.id = ch.id
        self.showId = ch.show
        self.channelNumber = ch.channel_number
        self.universe = ch.universe
        self.dmxAddress = ch.dmx_address
        self.device = ch.device
        self.color = ch.color
        self.channelDescription = ch.description
        self.category = ch.category
        self.active = ch.active
        self.position = ch.position
        self.serverUpdated = ""
        self.cachedAt = Date()
    }

    func update(from ch: Channel) {
        self.channelNumber = ch.channel_number
        self.universe = ch.universe
        self.dmxAddress = ch.dmx_address
        self.device = ch.device
        self.color = ch.color
        self.channelDescription = ch.description
        self.category = ch.category
        self.active = ch.active
        self.position = ch.position
        self.cachedAt = Date()
    }

    var asChannel: Channel {
        Channel(
            id: id, show: showId, channel_number: channelNumber,
            universe: universe, dmx_address: dmxAddress, device: device,
            color: color, description: channelDescription,
            category: category, active: active, position: position
        )
    }
}

// MARK: - Pending Operation (Sync Queue)

enum PendingOpType: String, Codable {
    case createChannel
    case updateChannel
    case deleteChannel
    case updateShow
}

@Model
final class PendingOperation {
    var id: String                  // lokale UUID
    var type: String                // PendingOpType.rawValue
    var recordId: String            // betroffene Record-ID
    var payloadJSON: String         // JSON-encoded [String: Any]
    var showId: String
    var createdAt: Date
    var attempts: Int

    init(type: PendingOpType, recordId: String, showId: String, payload: [String: Any]) {
        self.id = UUID().uuidString
        self.type = type.rawValue
        self.recordId = recordId
        self.showId = showId
        self.payloadJSON = (try? JSONSerialization.data(withJSONObject: payload))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        self.createdAt = Date()
        self.attempts = 0
    }

    var opType: PendingOpType? { PendingOpType(rawValue: type) }

    var payload: [String: Any] {
        guard let data = payloadJSON.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return dict
    }
}

// MARK: - LocalStore

@Observable
final class LocalStore {
    static let shared = LocalStore()

    let container: ModelContainer

    init() {
        let schema = Schema([CachedShow.self, CachedChannel.self, PendingOperation.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        container = try! ModelContainer(for: schema, configurations: config)
    }

    private var context: ModelContext { container.mainContext }

    // MARK: - Shows

    func saveShows(_ shows: [Show]) {
        for show in shows {
            if let existing = fetchCachedShow(id: show.id) {
                existing.update(from: show)
            } else {
                context.insert(CachedShow(from: show))
            }
        }
        try? context.save()
    }

    func loadShows(archived: Bool) -> [Show] {
        let descriptor = FetchDescriptor<CachedShow>(
            predicate: #Predicate { $0.archived == archived },
            sortBy: [SortDescriptor(\.cachedAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor))?.map { $0.asShow } ?? []
    }

    func saveShow(_ show: Show) {
        if let existing = fetchCachedShow(id: show.id) {
            existing.update(from: show)
        } else {
            context.insert(CachedShow(from: show))
        }
        try? context.save()
    }

    private func fetchCachedShow(id: String) -> CachedShow? {
        let descriptor = FetchDescriptor<CachedShow>(predicate: #Predicate { $0.id == id })
        return try? context.fetch(descriptor).first
    }

    // MARK: - Channels

    func saveChannels(_ channels: [Channel], showId: String) {
        // Bestehende für diese Show löschen, dann neu einlesen
        let existing = fetchCachedChannels(showId: showId)
        let existingIds = Set(existing.map { $0.id })
        let newIds = Set(channels.map { $0.id })

        // Gelöschte entfernen
        for cached in existing where !newIds.contains(cached.id) {
            context.delete(cached)
        }
        // Neue/aktualisierte speichern
        for ch in channels {
            if let cached = existing.first(where: { $0.id == ch.id }) {
                cached.update(from: ch)
            } else {
                context.insert(CachedChannel(from: ch))
            }
        }
        _ = existingIds  // suppress warning
        try? context.save()
    }

    func loadChannels(showId: String) -> [Channel] {
        fetchCachedChannels(showId: showId).map { $0.asChannel }
    }

    func saveChannel(_ channel: Channel) {
        if let existing = fetchCachedChannels(showId: channel.show).first(where: { $0.id == channel.id }) {
            existing.update(from: channel)
        } else {
            context.insert(CachedChannel(from: channel))
        }
        try? context.save()
    }

    func deleteChannel(id: String) {
        let descriptor = FetchDescriptor<CachedChannel>(predicate: #Predicate { $0.id == id })
        if let cached = try? context.fetch(descriptor).first {
            context.delete(cached)
            try? context.save()
        }
    }

    private func fetchCachedChannels(showId: String) -> [CachedChannel] {
        let descriptor = FetchDescriptor<CachedChannel>(
            predicate: #Predicate { $0.showId == showId },
            sortBy: [SortDescriptor(\.channelNumber)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Pending Operations

    func enqueue(_ op: PendingOperation) {
        context.insert(op)
        try? context.save()
    }

    func pendingOperations() -> [PendingOperation] {
        let descriptor = FetchDescriptor<PendingOperation>(
            sortBy: [SortDescriptor(\.createdAt)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    func removePending(id: String) {
        let descriptor = FetchDescriptor<PendingOperation>(predicate: #Predicate { $0.id == id })
        if let op = try? context.fetch(descriptor).first {
            context.delete(op)
            try? context.save()
        }
    }

    var hasPendingOperations: Bool {
        !pendingOperations().isEmpty
    }
}
