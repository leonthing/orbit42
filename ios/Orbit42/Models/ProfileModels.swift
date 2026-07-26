import Foundation

// MARK: - 프로필 편집 (PATCH /api/v1/me)

struct UpdateProfileRequest: Encodable {
    let displayName: String
    let bio: String
}

// MARK: - 캘린더 설정 (GET/POST/PATCH/DELETE /api/v1/calendars)

/// 목록 조회 및 모든 캘린더 mutation 의 공통 응답 — `{"calendars":[...]}`
/// (mutation 응답은 항상 전체 배열을 돌려주므로 그대로 교체하면 된다)
struct CalendarsResponse: Decodable {
    let calendars: [CalendarInfo]
}

/// `PATCH /api/v1/calendars/{id}` — nil 필드는 JSONEncoder 가 생략하므로
/// "바뀐 필드만" 전송된다.
struct UpdateCalendarRequest: Encodable {
    var name: String?
    var purpose: String?
    var color: String?
    var visibility: String?

    var isEmpty: Bool {
        name == nil && purpose == nil && color == nil && visibility == nil
    }
}

/// `POST /api/v1/calendars`
struct CreateCalendarRequest: Encodable {
    let name: String
    let purpose: String
    let color: String
    let visibility: String
    let linkGoogle: Bool
}

/// 캘린더 용도 (API v1 계약의 purpose 값)
enum CalendarPurpose: String, CaseIterable, Identifiable {
    case work
    case income
    case personal
    case couple
    case health
    case social
    case learning
    case hobby
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .work: return "업무"
        case .income: return "수익"
        case .personal: return "개인"
        case .couple: return "커플"
        case .health: return "건강"
        case .social: return "사교"
        case .learning: return "학습"
        case .hobby: return "취미"
        case .other: return "기타"
        }
    }
}

/// 캘린더 공개범위 (API v1 계약의 visibility 값)
enum CalendarVisibility: String, CaseIterable, Identifiable {
    case `private`
    case followers
    case `public`

    var id: String { rawValue }

    var label: String {
        switch self {
        case .private: return "비공개"
        case .followers: return "팔로워"
        case .public: return "공개"
        }
    }
}

/// 캘린더 색상 프리셋 8색 (웹과 동일한 팔레트)
enum CalendarPalette {
    static let hexes = [
        "#6366f1", "#ef4444", "#f59e0b", "#22c55e",
        "#06b6d4", "#8b5cf6", "#ec4899", "#64748b",
    ]
}

// MARK: - Google 캘린더 연동 (GET/POST /api/v1/google/*)

/// `GET /api/v1/google/status`
struct GoogleStatusResponse: Decodable {
    let connected: Bool
    let extraAccounts: [GoogleExtraAccount]?
}

struct GoogleExtraAccount: Decodable, Identifiable, Hashable {
    let email: String
    var id: String { email }
}

/// `GET /api/v1/google/connect-url[?add=1]`
struct GoogleConnectURLResponse: Decodable {
    let url: String
}

/// 본문이 필요 없는 POST 요청용
struct EmptyRequestBody: Encodable {}

/// `{"ok":true}` 등 내용을 사용하지 않는 성공 응답
struct AckResponse: Decodable {
    let ok: Bool?
}
