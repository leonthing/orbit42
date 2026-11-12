import Foundation

/// 로그인 토큰이 서버에서 끊겼을 때(다른 기기에서 비밀번호 변경 등, 보안-8) 한 번만 로그아웃시키는 신호 (개선-56).
/// - 보낸 토큰이 지금 기기 토큰과 같을 때만 신호를 낸다 — 방금 새 토큰으로 바꾼 뒤 늦게 온 옛 응답은 무시.
/// - 로그인·가입·Apple 연결처럼 401 이 '자격 확인 실패'를 뜻하는 경로는 제외.
enum SessionExpiry {
    static let didExpire = Notification.Name("orbit42.sessionExpired")

    private static let excludedPrefixes = [
        "/api/v1/auth/",
        "/api/v1/me/link-apple",
    ]

    static func note(_ request: URLRequest) {
        guard let header = request.value(forHTTPHeaderField: "Authorization"),
              header.hasPrefix("Bearer ") else { return }
        let sent = String(header.dropFirst("Bearer ".count))
        guard sent == KeychainStore.loadToken() else { return }
        let path = request.url?.path ?? ""
        if excludedPrefixes.contains(where: { path.hasPrefix($0) }) { return }
        Task { @MainActor in
            NotificationCenter.default.post(name: didExpire, object: nil)
        }
    }
}
