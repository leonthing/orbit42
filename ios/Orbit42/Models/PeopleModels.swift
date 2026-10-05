import SwiftUI

// MARK: - 관계 궤도 (API v1 /api/v1/people 계약 — src/lib/people-types.ts)
//
// 오르빗 탭의 기존 `OrbitPerson`(팔로우한 사람 + 열린 슬롯)과 구분하려고
// 여기서는 사람을 `Contact` 라고 부른다.

/// 궤도 위의 한 사람. 회원이면 `member` 가 채워진다.
struct Contact: Decodable, Identifiable, Hashable, Sendable {
    struct Member: Decodable, Hashable, Sendable {
        let username: String
        let displayName: String?
        let avatarUrl: String?
    }

    let id: String
    let name: String
    let email: String?
    let company: String?
    let role: String?
    let memo: String?
    /// suggested | active | archived | dismissed
    let status: String
    /// manual | follow | booking | participant | google | device
    let source: String
    /// 사람마다의 고유색 (#RRGGBB)
    let color: String
    let member: Member?
    let following: Bool
    let lastMetAt: String?
    let daysSince: Int?
    let meetings90: Int
    let meetingsTotal: Int
    let hoursTogether: Double
    let lastMeetingTitle: String?
    let nextMeetingAt: String?
    let nextMeetingTitle: String?
    /// 0 가까이(7일) · 1 조금 멀리(30일) · 2 멀리
    let ring: Int
    let archivedAt: String?

    var displayColor: Color { Color(hexString: color) ?? Theme.accent }
    var avatarURL: URL? { member?.avatarUrl.flatMap(URL.init(string:)) }
    var isMember: Bool { member != nil }
    var nextMeetingDate: Date? { nextMeetingAt.flatMap(APIDateParser.parse) }
    var archivedDate: Date? { archivedAt.flatMap(APIDateParser.parse) }

    /// "회사 · 직함", 없으면 회원은 @핸들, 아니면 이메일
    var subtitle: String {
        let work = [company, role].compactMap { $0?.isEmpty == false ? $0 : nil }
        if !work.isEmpty { return work.joined(separator: " · ") }
        if let member { return "@\(member.username)" }
        return email ?? ContactFormat.sourceLabel(source)
    }

    var initial: String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        return trimmed.first.map { String($0).uppercased() } ?? "?"
    }
}

struct ContactMeeting: Decodable, Identifiable, Hashable, Sendable {
    let id: String
    /// manual | booking | participant | google | device
    let source: String
    let title: String?
    let startAt: String
    let endAt: String?

    var startDate: Date? { APIDateParser.parse(startAt) }
    var endDate: Date? { endAt.flatMap(APIDateParser.parse) }
    var isManual: Bool { source == "manual" }
}

struct PeopleNudge: Decodable, Hashable, Sendable {
    let personId: String
    let days: Int
}

struct FollowCounts: Decodable, Sendable {
    let following: Int
    let followers: Int
}

struct PeopleOrbitResponse: Decodable, Sendable {
    /// 궤도 위 — 실제로 만난 기록(또는 잡힌 약속)이 있거나 직접 추가한 사람
    let people: [Contact]
    /// 팔로우만 하고 아직 만난 기록이 없는 사람 (구 서버엔 없어서 빈 배열)
    let followingOnly: [Contact]
    let followCounts: FollowCounts?
    let suggestions: [Contact]
    let archived: [Contact]
    let nudges: [PeopleNudge]
    let importEnabled: Bool
    let googleConnected: Bool
    let syncedAt: String?

    private enum CodingKeys: String, CodingKey {
        case people, followingOnly, followCounts, suggestions, archived, nudges, importEnabled, googleConnected, syncedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        people = try c.decode([Contact].self, forKey: .people)
        followingOnly = try c.decodeIfPresent([Contact].self, forKey: .followingOnly) ?? []
        followCounts = try c.decodeIfPresent(FollowCounts.self, forKey: .followCounts)
        suggestions = try c.decode([Contact].self, forKey: .suggestions)
        archived = try c.decode([Contact].self, forKey: .archived)
        nudges = try c.decode([PeopleNudge].self, forKey: .nudges)
        importEnabled = try c.decode(Bool.self, forKey: .importEnabled)
        googleConnected = try c.decode(Bool.self, forKey: .googleConnected)
        syncedAt = try c.decodeIfPresent(String.self, forKey: .syncedAt)
    }
}

struct ContactDetailResponse: Decodable, Sendable {
    let person: Contact
    let past: [ContactMeeting]
    let upcoming: [ContactMeeting]
}

// MARK: - 요청 바디

struct PeopleSyncRequest: Encodable {
    let force: Bool
}

struct AddContactRequest: Encodable {
    let name: String
    let email: String?
    let company: String?
    let role: String?
    let memo: String?
}

struct ContactIdResponse: Decodable {
    let id: String
}

/// PATCH /api/v1/people/{id} — 보내지 않은 필드는 바꾸지 않는다.
struct ContactPatch: Encodable {
    var status: String?
    var name: String?
    var company: String?
    var role: String?
    var memo: String?
    var dismissNudge: Bool?
}

struct LogMeetingRequest: Encodable {
    let title: String?
    let at: String?
    let minutes: Int?
}

struct ResolveSuggestionsRequest: Encodable {
    let ids: [String]
    let action: String
}

struct PeopleSettingsRequest: Encodable {
    let importEnabled: Bool
}

struct DeviceImportRequest: Encodable {
    struct Attendee: Encodable {
        let email: String
        let name: String?
    }

    struct Event: Encodable {
        let ref: String
        let title: String?
        let startAt: String
        let endAt: String?
        let attendees: [Attendee]
    }

    let rangeStart: String
    let rangeEnd: String
    let events: [Event]
}

// MARK: - 표시 규칙 (people-types.ts 와 같은 문구)

enum ContactFormat {
    static let orbitLimit = 12

    /// "오늘" · "어제" · "3일 전" · "기록 없음"
    static func daysSince(_ days: Int?) -> String {
        guard let days else { return "기록 없음" }
        if days <= 0 { return "오늘" }
        if days == 1 { return "어제" }
        return "\(days)일 전"
    }

    /// 궤도 라벨: 만난 적이 있으면 "3일 전", 아직 없고 약속만 있으면 "10/7 예정"
    static func metOrNext(_ person: Contact) -> String {
        if person.daysSince == nil, let next = person.nextMeetingDate {
            let f = DateFormatter()
            f.locale = Locale(identifier: "ko_KR")
            f.dateFormat = "M/d"
            return "\(f.string(from: next)) 예정"
        }
        return daysSince(person.daysSince)
    }

    /// 23 → "23시간", 1.5 → "1.5시간", 0 → "–"
    static func hours(_ hours: Double) -> String {
        if hours <= 0 { return "–" }
        if hours == hours.rounded() { return "\(Int(hours))시간" }
        return String(format: "%.1f시간", hours)
    }

    static func sourceLabel(_ source: String) -> String {
        switch source {
        case "follow": return "팔로우"
        case "booking": return "예약"
        case "participant": return "일정 초대"
        case "google": return "구글 캘린더"
        case "device": return "기기 캘린더"
        default: return "직접 추가"
        }
    }

    static func meetingSourceIcon(_ source: String) -> String {
        switch source {
        case "booking": return "calendar.badge.checkmark"
        case "participant": return "person.2"
        case "google", "device": return "calendar"
        default: return "hand.wave"
        }
    }

    private static let shortDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일"
        return f
    }()

    private static let dateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E) a h:mm"
        return f
    }()

    static func short(_ date: Date?) -> String {
        guard let date else { return "–" }
        return shortDate.string(from: date)
    }

    static func full(_ date: Date?) -> String {
        guard let date else { return "" }
        return dateTime.string(from: date)
    }
}
