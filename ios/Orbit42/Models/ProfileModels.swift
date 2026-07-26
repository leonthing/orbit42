import Foundation

// MARK: - 프로필 편집 (PATCH /api/v1/me)

/// `PATCH /api/v1/me` — 바뀐 필드만 담아 보낸다 (nil 프로퍼티는 키 자체가 생략됨).
/// birthDate 는 `PatchValue` 로 "생략 / 값 / 명시적 null(제거)" 를 구분한다.
/// socialLinks 는 저장할 전체 셋을 보내는 계약 (부분 병합 아님).
struct UpdateProfileRequest: Encodable {
    var displayName: String?
    var bio: String?
    var birthDate: PatchValue<String>?
    var socialLinks: [String: String]?
    var interests: [String]?

    var isEmpty: Bool {
        displayName == nil && bio == nil && birthDate == nil
            && socialLinks == nil && interests == nil
    }
}

/// 소셜 링크 5종 (서버 계약의 socialLinks 키)
enum SocialLinkKind: String, CaseIterable, Identifiable {
    case instagram
    case x
    case youtube
    case facebook
    case linkedin

    var id: String { rawValue }

    var label: String {
        switch self {
        case .instagram: return "인스타그램"
        case .x: return "X"
        case .youtube: return "유튜브"
        case .facebook: return "페이스북"
        case .linkedin: return "링크드인"
        }
    }

    var placeholder: String {
        switch self {
        case .instagram: return "https://instagram.com/..."
        case .x: return "https://x.com/..."
        case .youtube: return "https://youtube.com/..."
        case .facebook: return "https://facebook.com/..."
        case .linkedin: return "https://linkedin.com/in/..."
        }
    }
}

// MARK: - 아바타 (POST/DELETE /api/v1/me/avatar)

/// `POST /api/v1/me/avatar` → `{"ok":true,"url":"..."}`
struct AvatarUploadResponse: Decodable {
    let ok: Bool?
    let url: String?
}

// MARK: - 비밀번호 변경 (POST /api/v1/me/password)

struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
}

// MARK: - 캘린더 설정 (GET/POST/PATCH/DELETE /api/v1/calendars)

/// 목록 조회 및 모든 캘린더 mutation 의 공통 응답 — `{"calendars":[...]}`
/// (mutation 응답은 항상 전체 배열을 돌려주므로 그대로 교체하면 된다)
///
/// 캘린더별 시간당 단가(`hourlyRateKrw`)는 캘린더 탭 공용 모델(`CalendarInfo`)을
/// 건드리지 않도록 같은 배열에서 id → 단가 맵으로만 따로 디코드한다.
struct CalendarsResponse: Decodable {
    let calendars: [CalendarInfo]
    /// 단가가 설정된 캘린더만 담긴다 (id → 원/시간)
    let hourlyRatesByCalendarId: [String: Int]

    private struct RateEntry: Decodable {
        let id: String
        let hourlyRateKrw: Int?
    }

    private enum CodingKeys: String, CodingKey {
        case calendars
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        calendars = try container.decode([CalendarInfo].self, forKey: .calendars)
        let entries = (try? container.decode([RateEntry].self, forKey: .calendars)) ?? []
        hourlyRatesByCalendarId = Dictionary(
            uniqueKeysWithValues: entries.compactMap { entry in
                entry.hourlyRateKrw.map { (entry.id, $0) }
            }
        )
    }
}

/// `PATCH /api/v1/calendars/{id}` — nil 필드는 JSONEncoder 가 생략하므로
/// "바뀐 필드만" 전송된다.
/// hourlyRateKrw 는 "생략 / 값 / 명시적 null(단가 해제)" 를 구분하려고 PatchValue 를 쓴다.
struct UpdateCalendarRequest: Encodable {
    var name: String?
    var purpose: String?
    var color: String?
    var visibility: String?
    var hourlyRateKrw: PatchValue<Int>?

    var isEmpty: Bool {
        name == nil && purpose == nil && color == nil && visibility == nil
            && hourlyRateKrw == nil
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
    case invest
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
        case .invest: return "투자"
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
