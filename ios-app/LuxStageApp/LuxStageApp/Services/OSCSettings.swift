import Foundation

/// OSC settings stored per venue template in UserDefaults.
/// Key: "osc_settings_template_{templateId}"
struct OSCSettings: Codable {
    var host: String = ""
    var port: UInt16 = 8000
    var fullCommand: String = "/etc/chan/{chan}/full"
    var outCommand: String = "/etc/chan/{chan}/out"

    func address(for template: String, channel: String) -> String {
        template.replacingOccurrences(of: "{chan}", with: channel)
    }

    static func load(templateId: String) -> OSCSettings {
        guard
            let data = UserDefaults.standard.data(forKey: key(templateId)),
            let settings = try? JSONDecoder().decode(OSCSettings.self, from: data)
        else { return OSCSettings() }
        return settings
    }

    func save(templateId: String) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        UserDefaults.standard.set(data, forKey: OSCSettings.key(templateId))
    }

    private static func key(_ templateId: String) -> String { "osc_settings_template_\(templateId)" }
}
