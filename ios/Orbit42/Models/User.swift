import Foundation

/// 서버 API v1 계약의 user 객체.
/// `{"username": String, "displayName": String?, "email": String?, "avatarUrl": String?, "emailVerified": Bool, "bio": String?}`
struct User: Codable, Equatable, Sendable {
    let username: String
    let displayName: String?
    let email: String?
    let avatarUrl: String?
    let emailVerified: Bool
    /// 프로필 소개 (구버전 응답에는 없을 수 있어 옵셔널)
    let bio: String?

    /// 화면에 표시할 이름 (displayName 이 없으면 username)
    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }

    var avatarURL: URL? {
        guard let avatarUrl, !avatarUrl.isEmpty else { return nil }
        return URL(string: avatarUrl)
    }
}
