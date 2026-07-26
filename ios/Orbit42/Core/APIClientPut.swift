import Foundation

/// 4xx/5xx 에러 바디 — 본체의 private ServerErrorBody 와 같은 형태.
private struct PutServerErrorBody: Decodable {
    let error: String
}

/// `Core/APIClient.swift` 본체를 수정하지 않고 PUT 을 추가하는 확장.
/// 요청 조립·에러 규약은 본체와 동일하다:
/// Bearer 토큰 자동 첨부, 4xx/5xx 의 `{"error":"한국어"}` → `APIError.server/unauthorized`.
extension APIClient {
    func put<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = path
        var request = URLRequest(url: components.url!)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = KeychainStore.loadToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(PutServerErrorBody.self, from: data))?.error
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
