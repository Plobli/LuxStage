import Foundation
import Observation

// MARK: - Errors

enum PBError: LocalizedError {
    case invalidURL
    case notAuthenticated
    case httpError(Int, String)
    case decodingError(Error)
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:          return "Ungültige Server-URL"
        case .notAuthenticated:    return "Nicht angemeldet"
        case .httpError(let c, let m): return "Fehler \(c): \(m)"
        case .decodingError(let e):    return "Dekodierfehler: \(e.localizedDescription)"
        case .unknown(let e):          return e.localizedDescription
        }
    }
}

// MARK: - Client

@Observable
final class PocketBaseClient {

    static let shared = PocketBaseClient()

    var isAuthenticated = false
    var currentUser: String? = nil  // user id

    private(set) var token: String? {
        get { UserDefaults.standard.string(forKey: "pb_token") }
        set {
            UserDefaults.standard.set(newValue, forKey: "pb_token")
            isAuthenticated = newValue != nil
        }
    }

    var baseURL: String {
        get { UserDefaults.standard.string(forKey: "pb_server_url") ?? "http://localhost:8090" }
        set { UserDefaults.standard.set(newValue, forKey: "pb_server_url") }
    }

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 6
        config.timeoutIntervalForResource = 6
        return URLSession(configuration: config)
    }()
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    init() {
        isAuthenticated = token != nil
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws {
        struct Body: Encodable { let identity: String; let password: String }
        struct Response: Decodable { let token: String; let record: UserRecord }
        struct UserRecord: Decodable { let id: String }

        let body = Body(identity: email, password: password)
        let data = try await request(
            method: "POST",
            path: "/api/collections/users/auth-with-password",
            body: body,
            authenticated: false
        )
        let response = try decode(Response.self, from: data)
        token = response.token
        currentUser = response.record.id
    }

    func logout() {
        token = nil
        currentUser = nil
    }

    func verifyAuth() async {
        guard token != nil else { return }
        do {
            let _: Data = try await request(method: "POST", path: "/api/collections/users/auth-refresh")
        } catch {
            logout()
        }
    }

    // MARK: - Shows

    func fetchShows(archived: Bool = false) async throws -> [Show] {
        let filter = "archived=\(archived ? "true" : "false")"
        let data: Data = try await request(
            method: "GET",
            path: "/api/collections/shows/records?filter=\(encoded(filter))&sort=-created&perPage=200&expand=template"
        )
        return try decode(PBList<Show>.self, from: data).items
    }

    func fetchShow(id: String) async throws -> Show {
        let data: Data = try await request(method: "GET", path: "/api/collections/shows/records/\(id)")
        return try decode(Show.self, from: data)
    }

    func createShow(name: String, date: String?, templateId: String?) async throws -> Show {
        var body: [String: String?] = ["name": name, "archived": "false"]
        if let date { body["date"] = date }
        if let templateId { body["template"] = templateId }
        let data: Data = try await request(method: "POST", path: "/api/collections/shows/records", body: body)
        return try decode(Show.self, from: data)
    }

    func updateShow(id: String, fields: [String: Any]) async throws -> Show {
        let data: Data = try await request(method: "PATCH", path: "/api/collections/shows/records/\(id)", bodyAny: fields)
        return try decode(Show.self, from: data)
    }

    func archiveShow(id: String, archived: Bool) async throws {
        let _: Data = try await request(
            method: "PATCH",
            path: "/api/collections/shows/records/\(id)",
            body: ["archived": archived]
        )
    }

    func deleteShow(id: String) async throws {
        let _: Data = try await request(method: "DELETE", path: "/api/collections/shows/records/\(id)")
    }

    // MARK: - Channels

    func fetchChannels(showId: String) async throws -> [Channel] {
        let filter = "show='\(showId)'"
        let data: Data = try await request(
            method: "GET",
            path: "/api/collections/channels/records?filter=\(encoded(filter))&perPage=500&sort=channel_number"
        )
        return try decode(PBList<Channel>.self, from: data).items
    }

    func updateChannel(id: String, fields: [String: Any?]) async throws -> Channel {
        let cleaned = fields.compactMapValues { $0 }
        let data: Data = try await request(method: "PATCH", path: "/api/collections/channels/records/\(id)", bodyAny: cleaned)
        return try decode(Channel.self, from: data)
    }

    func createChannel(showId: String, fields: [String: Any?]) async throws -> Channel {
        var body = fields.compactMapValues { $0 } as [String: Any]
        body["show"] = showId
        let data: Data = try await request(method: "POST", path: "/api/collections/channels/records", bodyAny: body)
        return try decode(Channel.self, from: data)
    }

    func deleteChannel(id: String) async throws {
        let _: Data = try await request(method: "DELETE", path: "/api/collections/channels/records/\(id)")
    }

    // MARK: - Templates

    func fetchTemplates() async throws -> [VenueTemplate] {
        let data: Data = try await request(method: "GET", path: "/api/collections/venue_templates/records?perPage=200&sort=name")
        return try decode(PBList<VenueTemplate>.self, from: data).items
    }

    func fetchTemplateCustomFields(templateId: String) async throws -> [TemplateCustomField] {
        let filter = "template='\(templateId)'"
        let data: Data = try await request(
            method: "GET",
            path: "/api/collections/template_custom_fields/records?filter=\(encoded(filter))&sort=position&perPage=100"
        )
        return try decode(PBList<TemplateCustomField>.self, from: data).items
    }

    // MARK: - Photos

    func fetchPhotos(showId: String) async throws -> [Photo] {
        let filter = "show='\(showId)'"
        let data: Data = try await request(
            method: "GET",
            path: "/api/collections/photos/records?filter=\(encoded(filter))&sort=-created&perPage=200"
        )
        return try decode(PBList<Photo>.self, from: data).items
    }

    func uploadPhoto(showId: String, imageData: Data, filename: String, caption: String = "") async throws -> Photo {
        guard let url = URL(string: baseURL + "/api/collections/photos/records") else { throw PBError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }

        let boundary = UUID().uuidString
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()
        func field(_ name: String, _ value: String) {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        field("show", showId)
        if !caption.isEmpty { field("caption", caption) }
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        let data = try await perform(req)
        return try decode(Photo.self, from: data)
    }

    func deletePhoto(id: String) async throws {
        let _: Data = try await request(method: "DELETE", path: "/api/collections/photos/records/\(id)")
    }

    // MARK: - Photo URL helpers

    func thumbURL(collectionId: String = "photos", recordId: String, filename: String) -> URL? {
        URL(string: "\(baseURL)/api/files/\(collectionId)/\(recordId)/\(filename)?thumb=400x400")
    }

    func fileURL(collectionId: String = "photos", recordId: String, filename: String) -> URL? {
        URL(string: "\(baseURL)/api/files/\(collectionId)/\(recordId)/\(filename)")
    }

    // MARK: - Core request

    @discardableResult
    func request<B: Encodable>(
        method: String,
        path: String,
        body: B? = nil as String?,
        authenticated: Bool = true
    ) async throws -> Data {
        guard let url = URL(string: baseURL + path) else { throw PBError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if authenticated, let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        return try await perform(req)
    }

    @discardableResult
    func request(
        method: String,
        path: String,
        bodyAny: [String: Any]
    ) async throws -> Data {
        guard let url = URL(string: baseURL + path) else { throw PBError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: bodyAny)
        return try await perform(req)
    }

    private func perform(_ req: URLRequest) async throws -> Data {
        do {
            let (data, response) = try await session.data(for: req)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                let msg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String ?? ""
                if http.statusCode == 401 { logout() }
                throw PBError.httpError(http.statusCode, msg)
            }
            return data
        } catch let e as PBError {
            throw e
        } catch {
            throw PBError.unknown(error)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw PBError.decodingError(error)
        }
    }

    private func encoded(_ string: String) -> String {
        string.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? string
    }
}
