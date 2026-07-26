import Foundation

// MARK: - 에러

enum APIError: LocalizedError {
    /// 서버가 내려준 4xx/5xx + `{"error": "한국어 메시지"}`
    case server(message: String, statusCode: Int)
    /// 401 — 세션 만료/무효
    case unauthorized(message: String)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .server(let message, _):
            return message
        case .unauthorized(let message):
            return message
        case .invalidResponse:
            return "서버 응답을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."
        }
    }
}

// MARK: - 요청/응답 페이로드 (API v1 계약)

struct LoginRequest: Encodable {
    let identifier: String
    let password: String
}

struct SignupRequest: Encodable {
    let username: String
    let password: String
    let email: String
    let displayName: String?
}

struct AppleAuthRequest: Encodable {
    let identityToken: String
    let displayName: String?
}

struct AuthResponse: Decodable {
    let token: String
    let user: User
}

struct MeResponse: Decodable {
    let user: User
}

private struct ServerErrorBody: Decodable {
    let error: String
}

// MARK: - 클라이언트

/// async/await 기반 JSON API 클라이언트.
/// Keychain 에 토큰이 있으면 `Authorization: Bearer <token>` 을 자동 첨부한다.
final class APIClient {
    static let shared = APIClient()

    #if DEBUG
    let baseURL = URL(string: "http://localhost:3000")!
    #else
    let baseURL = URL(string: "https://orbit42.org")!
    #endif

    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func get<Response: Decodable>(_ path: String) async throws -> Response {
        try await perform(request(path: path, method: "GET"))
    }

    func post<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        var request = request(path: path, method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    // MARK: - 내부

    private func request(path: String, method: String) -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = KeychainStore.loadToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error
            if http.statusCode == 401 {
                throw APIError.unauthorized(message: message ?? "로그인이 필요해요.")
            }
            throw APIError.server(
                message: message ?? "요청을 처리하지 못했어요. (오류 \(http.statusCode))",
                statusCode: http.statusCode
            )
        }

        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.invalidResponse
        }
    }
}
