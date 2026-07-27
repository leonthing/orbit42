import Foundation

// MARK: - 공통 표시 포맷

/// 검색/예약 화면 공용 표시 포맷터.
enum DiscoverFormat {
    private static let priceFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter
    }()

    /// priceCents/100 을 "₩12,000" 형식으로. 0이면 "무료".
    static func priceText(cents: Int) -> String {
        if cents == 0 { return "무료" }
        let amount = cents / 100
        let formatted = priceFormatter.string(from: NSNumber(value: amount)) ?? "\(amount)"
        return "₩\(formatted)"
    }

    /// "7월 30일 (목)"
    static let dayHeader: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E)"
        formatter.timeZone = .current
        return formatter
    }()

    /// "15:00"
    static let time: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = .current
        return formatter
    }()

    /// "7월 30일 (목) 15:00"
    static let dateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E) HH:mm"
        formatter.timeZone = .current
        return formatter
    }()
}

// MARK: - 검색 (GET /api/v1/search?q=...)

struct SearchResponse: Decodable, Sendable {
    let users: [SearchUser]
    let slots: [SearchSlot]

    var isEmpty: Bool { users.isEmpty && slots.isEmpty }
}

/// 검색 결과의 사람 항목.
// MARK: - 내 오르빗 (GET /api/v1/orbit)

/// 팔로우한 사람 + 그 사람의 열린 타임슬롯. 피드가 아니라
/// "아는 사람들의 예약 가능한 시간 디렉토리".
struct OrbitResponse: Decodable {
    let people: [OrbitPerson]
}

struct OrbitPerson: Decodable, Identifiable {
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let slots: [TimeSlot]

    var id: String { username }

    var preferredName: String {
        displayName?.isEmpty == false ? displayName! : username
    }
}

struct SearchUser: Decodable, Identifiable, Sendable {
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let bio: String?

    var id: String { username }

    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }

    var avatarURL: URL? {
        guard let avatarUrl, !avatarUrl.isEmpty else { return nil }
        return URL(string: avatarUrl)
    }
}

/// 검색 결과의 열린 타임슬롯 항목.
struct SearchSlot: Decodable, Identifiable, Sendable {
    let id: String
    let slug: String
    let title: String
    let hostUsername: String
    let hostName: String?
    let priceCents: Int
    let pricingModel: String
    let durationMin: Int

    var hostDisplayName: String {
        if let hostName, !hostName.isEmpty { return hostName }
        return hostUsername
    }

    var durationText: String { "\(durationMin)분" }
    var priceText: String { DiscoverFormat.priceText(cents: priceCents) }
    var isAuction: Bool { pricingModel == "auction" }
}

// MARK: - 타인 프로필 (GET /api/v1/users/{username})

struct PersonProfileResponse: Decodable, Sendable {
    let user: PersonUser
    var orbiters: Int
    let orbiting: Int
    var isFollowing: Bool
    let isMe: Bool
    let rating: PersonRating?
    let slots: [TimeSlot]
    /// 내가 이 사람을 차단했는지 — 구버전 서버 응답에는 없을 수 있어 옵셔널로 받는다.
    private let isBlockedValue: Bool?

    var isBlocked: Bool { isBlockedValue ?? false }

    private enum CodingKeys: String, CodingKey {
        case user, orbiters, orbiting, isFollowing, isMe, rating, slots
        case isBlockedValue = "isBlocked"
    }
}

struct PersonUser: Decodable, Sendable {
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let bio: String?
    let interests: [String]?

    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }

    var avatarURL: URL? {
        guard let avatarUrl, !avatarUrl.isEmpty else { return nil }
        return URL(string: avatarUrl)
    }

    var interestTags: [String] { interests ?? [] }
}

struct PersonRating: Decodable, Sendable {
    let average: Double
    let count: Int

    /// "4.8"
    var averageText: String { String(format: "%.1f", average) }
}

/// POST /api/v1/users/{username}/follow
struct FollowRequest: Encodable {
    let follow: Bool
}

struct FollowResponse: Decodable {
    let isFollowing: Bool
}

// MARK: - 차단 (POST /api/v1/users/{username}/block, GET /api/v1/blocks)

struct BlockRequest: Encodable {
    let block: Bool
}

struct BlockResponse: Decodable {
    let isBlocked: Bool
}

/// GET /api/v1/blocks — 내가 차단한 사용자 목록.
struct BlocksResponse: Decodable, Sendable {
    let users: [BlockedUser]
}

struct BlockedUser: Decodable, Identifiable, Sendable {
    let username: String
    let displayName: String?
    let avatarUrl: String?

    var id: String { username }

    var preferredName: String {
        if let displayName, !displayName.isEmpty { return displayName }
        return username
    }

    var avatarURL: URL? {
        guard let avatarUrl, !avatarUrl.isEmpty else { return nil }
        return URL(string: avatarUrl)
    }
}

// MARK: - 슬롯 예약 (GET/POST /api/v1/users/{username}/slots/{slug})

struct SlotBookingResponse: Decodable, Sendable {
    let slot: BookableSlot
    let options: [BookingOption]
    let auctionNotice: String?
}

/// 예약 화면의 slot 객체 (내 슬롯 관리용 SlotDetail 과 계약이 다르다).
struct BookableSlot: Decodable, Sendable {
    let id: String
    let slug: String
    let title: String
    let description: String?
    let durationMin: Int
    let priceCents: Int
    let pricingModel: String
    let capacity: Int
    let slotType: String
    let locations: [String]
    let autoApprove: Bool
    let imageUrls: [String]
    let hostUsername: String
    let hostName: String?

    /// 내 슬롯이면 예약 버튼을 숨긴다.
    let isMine: Bool

    var hostDisplayName: String {
        if let hostName, !hostName.isEmpty { return hostName }
        return hostUsername
    }

    var durationText: String { "\(durationMin)분" }
    var priceText: String { DiscoverFormat.priceText(cents: priceCents) }
    var isAuction: Bool { pricingModel == "auction" }
}

/// 예약 가능한 시작 시각 옵션.
/// POST 시 availabilityId 가 있으면 그것을, 없으면 받은 startAt 원문을 그대로 돌려보낸다.
struct BookingOption: Decodable, Identifiable, Sendable {
    let startAt: Date
    let endAt: Date
    let remaining: Int
    let availabilityId: String?
    /// 서버가 내려준 startAt 원문 — POST 에 그대로 사용
    let startAtRaw: String

    var id: String { availabilityId ?? startAtRaw }

    /// "15:00"
    var timeText: String { DiscoverFormat.time.string(from: startAt) }

    private enum CodingKeys: String, CodingKey {
        case startAt, endAt, remaining, availabilityId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        remaining = try container.decodeIfPresent(Int.self, forKey: .remaining) ?? 1
        availabilityId = try container.decodeIfPresent(String.self, forKey: .availabilityId)

        let startRaw = try container.decode(String.self, forKey: .startAt)
        let endRaw = try container.decode(String.self, forKey: .endAt)
        guard let start = APIDateParser.parse(startRaw), let end = APIDateParser.parse(endRaw) else {
            throw DecodingError.dataCorruptedError(
                forKey: .startAt, in: container,
                debugDescription: "지원하지 않는 날짜 형식: \(startRaw) / \(endRaw)"
            )
        }
        startAtRaw = startRaw
        startAt = start
        endAt = end
    }
}

/// POST /api/v1/users/{username}/slots/{slug}
/// nil 필드는 인코딩에서 생략된다 (startAt/availabilityId 는 둘 중 하나만 전송).
struct BookSlotRequest: Encodable {
    let startAt: String?
    let availabilityId: String?
    let message: String?
    let location: String?
}

/// `{"ok":true,"status":"confirmed"|"pending"}`
struct BookSlotResponse: Decodable {
    let ok: Bool?
    let status: String

    var isConfirmed: Bool { status == "confirmed" }
}

// MARK: - 시간 요청 (POST /api/v1/users/{username}/time-request)

struct TimeRequestBody: Encodable {
    let message: String
    let durationMin: Int
    let budgetKrw: Int?
    let preferredTimes: String?
}
