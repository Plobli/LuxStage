import Foundation

// MARK: - Show

struct Show: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var date: String?
    var template: String?
    var archived: Bool
    var custom_field_values: AnyCodable?
    var created: String
    var updated: String

    var customValues: [String: String] {
        guard let raw = custom_field_values?.value as? [String: Any] else { return [:] }
        return raw.compactMapValues { $0 as? String }
    }

    var formattedDate: String? {
        guard let date else { return nil }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withFullDate]
        guard let d = iso.date(from: String(date.prefix(10))) else { return nil }
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        return f.string(from: d)
    }
}

// MARK: - Channel

struct Channel: Identifiable, Codable, Hashable {
    var id: String
    var show: String
    var channel_number: String
    var universe: Int?
    var dmx_address: Int?
    var device: String?
    var color: String?
    var description: String?
    var category: String?
    var active: Bool?
    var position: Int?

    var addressDisplay: String {
        guard let u = universe, let d = dmx_address else { return "—" }
        return "\(u)/\(String(format: "%03d", d))"
    }

    var categoryOrEmpty: String { category ?? "" }
}

// MARK: - Template

struct VenueTemplate: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var venue_name: String
    var version: Int
    var created: String
}

struct TemplateCustomField: Identifiable, Codable, Hashable {
    var id: String
    var template: String
    var field_name: String
    var unit_hint: String?
    var position: Int?
}

// MARK: - Photo

struct Photo: Identifiable, Codable, Hashable {
    var id: String
    var show: String
    var file: String
    var caption: String?
    var created: String
    var collectionId: String
}

// MARK: - Filter Preset

struct FilterPreset: Identifiable, Codable, Hashable {
    var id: String { "\(brand)-\(code)" }
    var brand: String
    var code: String
    var name: String

    var displayLabel: String { "\(code) \(name)" }
}

// MARK: - PocketBase list response

struct PBList<T: Codable>: Codable {
    var page: Int
    var perPage: Int
    var totalItems: Int
    var totalPages: Int
    var items: [T]
}

// MARK: - AnyCodable (für custom_field_values: JSON)

struct AnyCodable: Codable, Hashable {
    let value: Any

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let v = try? container.decode([String: AnyCodable].self) {
            value = v.mapValues { $0.value }
        } else if let v = try? container.decode([AnyCodable].self) {
            value = v.map { $0.value }
        } else if let v = try? container.decode(String.self) {
            value = v
        } else if let v = try? container.decode(Bool.self) {
            value = v
        } else if let v = try? container.decode(Int.self) {
            value = v
        } else if let v = try? container.decode(Double.self) {
            value = v
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let v as [String: Any]:
            try container.encode(v.mapValues { AnyCodable($0) })
        case let v as [Any]:
            try container.encode(v.map { AnyCodable($0) })
        case let v as String: try container.encode(v)
        case let v as Bool:   try container.encode(v)
        case let v as Int:    try container.encode(v)
        case let v as Double: try container.encode(v)
        default: try container.encodeNil()
        }
    }

    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool { false }
    func hash(into hasher: inout Hasher) {}
}
