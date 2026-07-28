import SwiftUI

// MARK: - 유연한 날짜 파싱 (API v1 캘린더 계약)

/// 서버가 내려주는 `startAt`/`endAt` 을 파싱한다.
/// ISO8601(소수점 초 포함/미포함) → 날짜만("2026-07-26") 순서로 시도한다.
enum APIDateParser {
    private static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// 타임존 오프셋이 없는 "yyyy-MM-dd'T'HH:mm:ss" — 로컬 시각으로 해석
    private static let localDateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        formatter.timeZone = .current
        return formatter
    }()

    /// "2026-07-26" 처럼 날짜만 올 때 — 로컬 자정으로 해석
    private static let dateOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter
    }()

    static func isDateOnly(_ raw: String) -> Bool {
        raw.count == 10 && !raw.contains("T")
    }

    static func parse(_ raw: String) -> Date? {
        if let date = isoWithFractionalSeconds.date(from: raw) { return date }
        if let date = iso.date(from: raw) { return date }
        if let date = localDateTime.date(from: raw) { return date }
        if let date = dateOnly.date(from: raw) { return date }
        return nil
    }

    /// POST 용 인코딩 — 시간 있는 이벤트는 로컬 오프셋 포함 ISO8601 ("2026-07-26T09:00:00+09:00")
    static func encodeDateTime(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = .current
        return formatter.string(from: date)
    }

    /// POST 용 인코딩 — 종일 이벤트는 서버 출력과 같은 날짜만 형태 ("2026-07-26")
    static func encodeDateOnly(_ date: Date) -> String {
        dateOnly.string(from: date)
    }
}

// MARK: - 캘린더

/// API v1 계약의 calendar 객체. (Foundation.Calendar 와의 충돌을 피해 CalendarInfo 로 명명)
struct CalendarInfo: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let color: String
    let purpose: String?
    /// "private" | "followers" | "public" (이벤트 응답에는 없을 수 있어 옵셔널)
    let visibility: String?
    let source: String        // "native" | "google"
    let isDefault: Bool
    /// 목표 캘린더 — 이 캘린더의 시간이 하나의 목표를 향한다 (구 응답 호환 옵셔널)
    let goalTitle: String?
    let goalTargetHours: Double?
    let goalDeadline: String?
    let archivedAt: String?
    /// 공유받은 캘린더면 "editor"|"viewer", 내 캘린더면 nil
    let sharedRole: String?
    let sharedByUsername: String?
    let sharedByName: String?

    var isNative: Bool { source == "native" }
    var isSharedWithMe: Bool { sharedRole != nil }
    var canEdit: Bool { sharedRole == nil || sharedRole == "editor" }
    var hasGoal: Bool { !(goalTitle ?? "").isEmpty }
    var isArchived: Bool { archivedAt != nil }

    var displayColor: Color {
        Color(hexString: color) ?? Theme.accent
    }
}

// MARK: - 이벤트

/// API v1 계약의 event 객체. `startAt`/`endAt` 은 유연하게 디코딩한다.
struct CalendarEvent: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let description: String?
    let startAt: Date
    let endAt: Date
    let allDay: Bool
    let calendarId: String?
    let source: String        // "local" | "google"
    let tentative: Bool
    /// 자산 탭 분석용 버킷 오버라이드 — "earn" | "invest" | "spend" | "life" | nil(캘린더 용도 따름)
    let bucketOverride: String?
    /// 이 일정으로 실제 번 금액(원) 수동 기록 — nil 이면 자동(시급×시간) 계산
    let earningKrw: Int?
    /// 시간 가치 자동 환산(원) — 캘린더 단가 → 기준 시급 × 시간 (서버 계산, 종일 제외)
    let autoValueKrw: Int?
    /// 완료 체크(투두) 상태 — 낙관적 업데이트를 위해 var (서버가 안 주면 false)
    var completed: Bool
    /// 초대받은 일정(source == "invite")일 때의 참여 행 id / 상태 / 보낸 사람
    let inviteId: String?
    let inviteStatus: String?
    let inviterName: String?
    /// 위치 — 자유 텍스트. 주소 검색으로 고르면 좌표(lat/lng)도 온다.
    let location: String?
    let locationLat: Double?
    let locationLng: Double?
    /// 시작 전 이동시간(분) — 예약 가능 시간 계산에서 그만큼 앞이 막힌다.
    let travelMin: Int?
    /// endAt 이 "2026-07-26" 처럼 날짜만으로 왔는지 (종일 이벤트의 마지막 날 포함 여부 판단용)
    let endWasDateOnly: Bool

    var isGoogle: Bool { source == "google" }
    /// 초대받은 일정 (읽기 전용 — 수락/거절만 가능)
    var isInvite: Bool { source == "invite" }

    private enum CodingKeys: String, CodingKey {
        case id, title, description, startAt, endAt, allDay, calendarId, source, tentative
        case bucketOverride, earningKrw, autoValueKrw, completed
        case inviteId, inviteStatus, inviterName
        case location, locationLat, locationLng, travelMin
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        allDay = try container.decodeIfPresent(Bool.self, forKey: .allDay) ?? false
        calendarId = try container.decodeIfPresent(String.self, forKey: .calendarId)
        source = try container.decodeIfPresent(String.self, forKey: .source) ?? "local"
        tentative = try container.decodeIfPresent(Bool.self, forKey: .tentative) ?? false
        bucketOverride = try container.decodeIfPresent(String.self, forKey: .bucketOverride)
        earningKrw = try container.decodeIfPresent(Int.self, forKey: .earningKrw)
        autoValueKrw = try container.decodeIfPresent(Int.self, forKey: .autoValueKrw)
        completed = try container.decodeIfPresent(Bool.self, forKey: .completed) ?? false
        inviteId = try container.decodeIfPresent(String.self, forKey: .inviteId)
        inviteStatus = try container.decodeIfPresent(String.self, forKey: .inviteStatus)
        inviterName = try container.decodeIfPresent(String.self, forKey: .inviterName)
        location = try container.decodeIfPresent(String.self, forKey: .location)
        locationLat = try container.decodeIfPresent(Double.self, forKey: .locationLat)
        locationLng = try container.decodeIfPresent(Double.self, forKey: .locationLng)
        travelMin = try container.decodeIfPresent(Int.self, forKey: .travelMin)

        let startRaw = try container.decode(String.self, forKey: .startAt)
        let endRaw = try container.decode(String.self, forKey: .endAt)
        guard let start = APIDateParser.parse(startRaw) else {
            throw DecodingError.dataCorruptedError(
                forKey: .startAt, in: container,
                debugDescription: "지원하지 않는 날짜 형식: \(startRaw)"
            )
        }
        guard let end = APIDateParser.parse(endRaw) else {
            throw DecodingError.dataCorruptedError(
                forKey: .endAt, in: container,
                debugDescription: "지원하지 않는 날짜 형식: \(endRaw)"
            )
        }
        startAt = start
        endAt = end
        endWasDateOnly = APIDateParser.isDateOnly(endRaw)
    }

    /// 이 이벤트가 실질적으로 끝나는 시각.
    /// - 날짜만으로 온 종일 이벤트의 end 는 "마지막 날 포함" 으로 취급한다.
    /// - datetime 이 자정 정각에 끝나면 (구글식 배타적 end) 그 직전까지로 취급한다.
    func effectiveEnd(calendar: Calendar) -> Date {
        var end = max(endAt, startAt)
        if endWasDateOnly {
            // 날짜만 온 end 는 그 날 하루를 통째로 포함
            if let nextDay = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: end)) {
                end = nextDay.addingTimeInterval(-1)
            }
        } else if end > startAt, end == calendar.startOfDay(for: end) {
            end = end.addingTimeInterval(-1)
        }
        return end
    }

    /// 해당 날짜에 이 이벤트가 걸쳐 있는지 (여러 날짜에 걸친 이벤트 포함)
    func occurs(on day: Date, calendar: Calendar) -> Bool {
        let dayStart = calendar.startOfDay(for: day)
        guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) else { return false }
        return startAt < dayEnd && effectiveEnd(calendar: calendar) >= dayStart
    }

    /// 소속 캘린더 색. 캘린더를 못 찾으면 액센트 색.
    func displayColor(in calendars: [CalendarInfo]) -> Color {
        guard let calendarId,
              let info = calendars.first(where: { $0.id == calendarId })
        else { return Theme.accent }
        return info.displayColor
    }
}

// MARK: - 요청/응답 페이로드

struct CalendarEventsResponse: Decodable {
    let events: [CalendarEvent]
    let calendars: [CalendarInfo]
}

struct CreateEventRequest: Encodable {
    let title: String
    let description: String?
    let startAt: String
    let endAt: String
    let allDay: Bool
    let calendarId: String?
    var location: String?
    var locationLat: Double?
    var locationLng: Double?
    var travelMin: Int?
}

struct CreateEventResponse: Decodable {
    let event: CalendarEvent
}

/// `PATCH /api/v1/calendar/events/{id}` — 모든 필드 선택.
/// nil 필드는 JSONEncoder 가 생략하므로 "바뀐 필드만" 전송된다.
/// 단, startAt/endAt 은 서버가 쌍으로 요구하므로 항상 함께 넣는다.
struct UpdateEventRequest: Encodable {
    var title: String?
    var description: String?
    var startAt: String?
    var endAt: String?
    var allDay: Bool?
    /// 위치 변경 — "" 를 보내면 해제
    var location: String?
    var locationLat: Double?
    var locationLng: Double?
    /// 이동시간 변경 — 0 을 보내면 해제
    var travelMin: Int?
    /// 캘린더 이동 대상 (변경 시에만 전송)
    var calendarId: String?
    /// gcal_* 이벤트의 현재 소속 native 캘린더 uuid (서버가 소속 계정 해석에 사용)
    var sourceCalendarId: String?
}

/// PATCH/DELETE 공통 성공 응답 — `{"ok": true}`
struct EventMutationResponse: Decodable {
    let ok: Bool
}

/// `PUT /api/v1/calendar/events/{id}/completion` — 일정 완료 체크(투두).
struct UpdateEventCompletionRequest: Encodable {
    let completed: Bool
}

/// 완료 토글 성공 응답 — `{"ok": true, "completed": Bool}`
struct EventCompletionResponse: Decodable {
    let ok: Bool
    let completed: Bool
}

/// `PUT /api/v1/time-asset/event-bucket` — 이벤트 단위 자산 분류 오버라이드.
/// bucket 은 nil 이어도 명시적 `null` 로 인코딩해 "기본(캘린더 용도)" 으로 되돌린다.
struct UpdateEventBucketRequest: Encodable {
    let eventId: String
    let bucket: String?

    private enum CodingKeys: String, CodingKey {
        case eventId, bucket
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventId, forKey: .eventId)
        // encodeIfPresent 가 아닌 encode 로 Optional 을 넣으면 nil 이 JSON null 로 나간다.
        try container.encode(bucket, forKey: .bucket)
    }
}

/// `PUT /api/v1/time-asset/event-earning` — 일정별 실제 수익 기록.
/// amountKrw 는 nil 이어도 명시적 `null` 로 인코딩해 자동 계산으로 되돌린다.
struct UpdateEventEarningRequest: Encodable {
    let eventId: String
    let amountKrw: Int?

    private enum CodingKeys: String, CodingKey {
        case eventId, amountKrw
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventId, forKey: .eventId)
        try container.encode(amountKrw, forKey: .amountKrw)
    }
}

// MARK: - 일정 참석자 (GET/POST/DELETE /api/v1/calendar/events/{id}/participants)

struct EventParticipant: Decodable, Identifiable, Sendable {
    let id: String
    let status: String
    let username: String?
    let displayName: String?
    let avatarUrl: String?
    let email: String?

    var label: String {
        if let displayName, !displayName.isEmpty { return displayName }
        if let username { return "@" + username }
        return email ?? "알 수 없음"
    }

    var statusLabel: String {
        switch status {
        case "accepted": return "수락"
        case "declined": return "거절"
        default: return email != nil ? "메일 발송됨" : "대기중"
        }
    }
}

struct ParticipantsResponse: Decodable, Sendable {
    let participants: [EventParticipant]
}

/// POST — username 또는 email 중 하나 + 일정 스냅샷.
struct AddParticipantRequest: Encodable {
    var username: String?
    var email: String?
    let title: String
    let startAt: String
    let endAt: String?
    let allDay: Bool
}

// MARK: - Hex 색상

extension Color {
    /// "#6366f1" / "6366f1" / "#6366f1ff" 형태의 hex 문자열 파싱
    init?(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6 || hex.count == 8, let value = UInt64(hex, radix: 16) else { return nil }
        let r, g, b, a: Double
        if hex.count == 8 {
            r = Double((value >> 24) & 0xFF) / 255
            g = Double((value >> 16) & 0xFF) / 255
            b = Double((value >> 8) & 0xFF) / 255
            a = Double(value & 0xFF) / 255
        } else {
            r = Double((value >> 16) & 0xFF) / 255
            g = Double((value >> 8) & 0xFF) / 255
            b = Double(value & 0xFF) / 255
            a = 1
        }
        self = Color(red: r, green: g, blue: b, opacity: a)
    }
}
