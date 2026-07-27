import Foundation

/// 서버 API v1 계약의 user 객체.
/// `{"username": String, "displayName": String?, "email": String?, "avatarUrl": String?,
///   "emailVerified": Bool, "bio": String?, "birthDate": "YYYY-MM-DD"?,
///   "socialLinks": {instagram|x|youtube|facebook|linkedin: String}?, "interests": [String]?}`
struct User: Codable, Equatable, Sendable {
    let username: String
    let displayName: String?
    let email: String?
    let avatarUrl: String?
    let emailVerified: Bool
    /// 프로필 소개 (구버전 응답에는 없을 수 있어 옵셔널)
    let bio: String?
    /// 생년월일 "YYYY-MM-DD" — Life Calendar 기능에 쓰인다
    let birthDate: String?
    /// 소셜 링크 — {"instagram","x","youtube","facebook","linkedin"} 의 부분집합
    let socialLinks: [String: String]?
    /// 관심사 태그 (최대 10개)
    let interests: [String]?
    /// 나를 오르빗에 담은 사람 수 (구버전 응답에는 없을 수 있어 옵셔널)
    let orbiters: Int?
    /// 내가 오르빗에 담은 사람 수 (구버전 응답에는 없을 수 있어 옵셔널)
    let orbiting: Int?
    /// 프로필 비공개 여부 (구버전 응답에는 없을 수 있어 옵셔널)
    let isPrivate: Bool?
    /// Apple 계정 연결 여부 (설정 > 계정)
    let appleLinked: Bool?
    /// 프로필 공유(OG) 헤더 이미지 — 없으면 자동 명함 카드
    let shareImageUrl: String?

    init(
        username: String,
        displayName: String?,
        email: String?,
        avatarUrl: String?,
        emailVerified: Bool,
        bio: String?,
        birthDate: String? = nil,
        socialLinks: [String: String]? = nil,
        interests: [String]? = nil,
        orbiters: Int? = nil,
        orbiting: Int? = nil,
        isPrivate: Bool? = nil,
        appleLinked: Bool? = nil,
        shareImageUrl: String? = nil
    ) {
        self.username = username
        self.displayName = displayName
        self.email = email
        self.avatarUrl = avatarUrl
        self.emailVerified = emailVerified
        self.bio = bio
        self.birthDate = birthDate
        self.socialLinks = socialLinks
        self.interests = interests
        self.orbiters = orbiters
        self.orbiting = orbiting
        self.isPrivate = isPrivate
        self.appleLinked = appleLinked
        self.shareImageUrl = shareImageUrl
    }

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
