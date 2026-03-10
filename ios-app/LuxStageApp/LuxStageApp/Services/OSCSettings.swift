import Foundation

/// OSC settings stored per show in UserDefaults.
/// Key: "osc_settings_{showId}"
struct OSCSettings: Codable {
    var host: String = ""
    var port: UInt16 = 8000
    var fullCommand: String = "/etc/chan/{chan}/full"
    var outCommand: String = "/etc/chan/{chan}/out"

    func address(for template: String, channel: String) -> String {
        template.replacingOccurrences(of: "{chan}", with: channel)
    }

    static func load(showId: String) -> OSCSettings {
        guard
            let data = UserDefaults.standard.data(forKey: key(showId)),
            let settings = try? JSONDecoder().decode(OSCSettings.self, from: data)
        else { return OSCSettings() }
        return settings
    }

    func save(showId: String) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults.standard.set(data, forKey: OSCSettings.key(showId))
    }

    private static func key(_ showId: String) -> String { "osc_settings_\(showId)" }
}
