import Foundation

// MARK: - 시간 로그 (event_posts)

/// 일정에 붙은 시간 로그 — /api/v1/calendar/events/{id}/post
struct EventPost: Decodable, Sendable {
    let eventKey: String
    let title: String
    let startAt: String
    let endAt: String?
    let allDay: Bool
    let note: String?
    let imageUrls: [String]
    let visibility: String
}

/// GET/PUT/POST/DELETE 공통 응답 — `{"post": {...} | null}`
struct EventPostResponse: Decodable, Sendable {
    let post: EventPost?
}

/// PUT — 공개 범위 변경 (일정 스냅샷 동봉, 없으면 생성)
struct UpdateEventPostRequest: Encodable {
    let title: String
    let startAt: String
    let endAt: String?
    let allDay: Bool
    let visibility: String
}

/// 공개 범위 선택지.
enum TimelogVisibility: String, CaseIterable, Identifiable {
    case privateOnly = "private"
    case followers
    case publicAll = "public"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .privateOnly: return "비공개"
        case .followers: return "팔로워 공개"
        case .publicAll: return "전체 공개"
        }
    }

    var systemImage: String {
        switch self {
        case .privateOnly: return "lock"
        case .followers: return "person.2"
        case .publicAll: return "globe.asia.australia"
        }
    }
}

// MARK: - 프로필 시간 로그 (GET /api/v1/users/{username}/timelog)

struct TimelogResponse: Decodable, Sendable {
    let posts: [TimelogPost]
}

struct TimelogPost: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let startAt: String
    let endAt: String?
    let allDay: Bool
    let note: String?
    let imageUrls: [String]
    let visibility: String

    var startDate: Date? { APIDateParser.parse(startAt) }
    var coverURL: URL? { imageUrls.first.flatMap(URL.init(string:)) }
}


// MARK: - 오르빗 스트림 (GET /api/v1/orbit/stream)

struct OrbitStreamResponse: Decodable, Sendable {
    let items: [OrbitStreamItem]
}

/// 팔로우한 사람들의 최근 활동 — 시간 로그 또는 새 타임슬롯.
struct OrbitStreamItem: Decodable, Identifiable, Sendable {
    let id: String
    let type: String        // "timelog" | "slot"
    let createdAt: String
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let post: TimelogPost?
    let slot: TimeSlot?

    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }

    var avatarURL: URL? {
        avatarUrl.flatMap(URL.init(string:))
    }
}
