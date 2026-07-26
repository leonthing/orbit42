import Foundation

// MARK: - 알림 설정 (API v1 계약)

/// `GET /api/v1/notification-prefs` 의 pref 객체. label 은 서버가 한국어로 내려준다.
struct NotificationPref: Decodable, Identifiable, Sendable {
    let type: String
    let label: String
    let inApp: Bool
    let email: Bool

    var id: String { type }
}

/// GET/PATCH 공통 응답 — 항상 prefs 전체 배열.
struct NotificationPrefsResponse: Decodable {
    let prefs: [NotificationPref]
}

/// `PATCH /api/v1/notification-prefs` — 토글 하나 변경.
struct NotificationPrefPatchRequest: Encodable {
    let type: String
    /// "inApp" | "email"
    let channel: String
    let enabled: Bool
}

// MARK: - 근무시간 (API v1 계약)

/// 요일당 1구간 — `{"start":"09:00","end":"18:00"}`
struct WorkHourRange: Codable, Equatable, Sendable {
    let start: String
    let end: String
}

/// `GET /api/v1/work-hours` 응답. 끈 요일은 키가 없다.
struct WorkHoursResponse: Decodable {
    let workHours: [String: WorkHourRange]
}

/// `PUT /api/v1/work-hours` — 켠 요일만 담아 전체 교체.
struct WorkHoursPutRequest: Encodable {
    let workHours: [String: WorkHourRange]
}

// MARK: - 이동시간 버퍼 (API v1 계약)

/// `GET /api/v1/location-buffers` 의 buffer 객체.
struct LocationBuffer: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let bufferMin: Int
    let aliases: [String]
}

/// GET 및 모든 mutation 공통 응답 — 항상 buffers 전체 배열.
struct LocationBuffersResponse: Decodable {
    let buffers: [LocationBuffer]
}

/// `POST /api/v1/location-buffers` — 생성.
struct CreateLocationBufferRequest: Encodable {
    let name: String
    let bufferMin: Int
    let aliases: [String]
}

/// `PATCH /api/v1/location-buffers/{id}` — 바뀐 필드만.
/// nil 필드는 JSONEncoder 가 생략한다.
struct PatchLocationBufferRequest: Encodable {
    var name: String?
    var bufferMin: Int?
    var aliases: [String]?

    var isEmpty: Bool {
        name == nil && bufferMin == nil && aliases == nil
    }
}
