import Foundation
import Observation

@Observable
final class AppLocale {
    static let shared = AppLocale()

    private(set) var language: String {
        didSet {
            UserDefaults.standard.set(language, forKey: "app_language")
            load()
        }
    }

    private var strings: [String: String] = [:]

    init() {
        let saved = UserDefaults.standard.string(forKey: "app_language")
        let system = Locale.current.language.languageCode?.identifier ?? "de"
        language = saved ?? (system == "en" ? "en" : "de")
        load()
    }

    func setLanguage(_ lang: String) {
        language = lang
    }

    func t(_ key: String) -> String {
        strings[key] ?? key
    }

    private func load() {
        guard
            let url = Bundle.main.url(forResource: "locale_\(language)", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let dict = try? JSONDecoder().decode([String: String].self, from: data)
        else { return }
        strings = dict
    }
}
