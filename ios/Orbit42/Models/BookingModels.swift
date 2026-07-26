import SwiftUI

// MARK: - 예약 상태

/// API v1 계약의 booking.status 값.
enum BookingStatus: String, Sendable {
    case pending
    case confirmed
    case canceled
    case completed

    var badgeText: String {
        switch self {
        case .pending: return "대기"
        case .confirmed: return "확정"
        case .canceled: return "취소"
        case .completed: return "완료"
        }
    }

    var badgeColor: Color {
        switch self {
        case .pending: return .orange
        case .confirmed: return Theme.accent
        case .canceled: return .gray
        case .completed: return .green
        }
    }
}

// MARK: - PATCH 액션

/// `PATCH /api/v1/bookings/{id}` 의 action 값.
enum BookingAction: String {
    case confirm
    case cancel
    case complete
    case cancelMine
}

// MARK: - 공통 표시 로직

/// host/guest 예약 행이 공유하는 표시용 파생값.
protocol BookingDisplayable {
    var statusRaw: String { get }
    var scheduledAt: Date { get }
}

extension BookingDisplayable {
    var status: BookingStatus? { BookingStatus(rawValue: statusRaw) }
    /// 알 수 없는 상태값이 와도 raw 문자열로라도 표시한다.
    var badgeText: String { status?.badgeText ?? statusRaw }
    var badgeColor: Color { status?.badgeColor ?? Theme.secondaryText }
    /// "7월 30일 (목) 15:00"
    var scheduledText: String { BookingDateFormatter.dateTime.string(from: scheduledAt) }
}

enum BookingDateFormatter {
    static let dateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E) HH:mm"
        formatter.timeZone = .current
        return formatter
    }()
}

// MARK: - 받은 예약 (host)

struct BookingMenu: Decodable, Sendable {
    let name: String
    let priceCents: Int
}

/// `GET /api/v1/bookings` 응답의 host 항목.
struct HostBooking: Decodable, Identifiable, Sendable, BookingDisplayable {
    let id: String
    let scheduledAt: Date
    let scheduledEndAt: Date
    let statusRaw: String
    let message: String?
    let guestName: String
    let slotTitle: String
    let slotSlug: String
    let menus: [BookingMenu]

    private enum CodingKeys: String, CodingKey {
        case id, scheduledAt, scheduledEndAt, message, guestName, slotTitle, slotSlug, menus
        case statusRaw = "status"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        statusRaw = try container.decode(String.self, forKey: .statusRaw)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        guestName = try container.decode(String.self, forKey: .guestName)
        slotTitle = try container.decode(String.self, forKey: .slotTitle)
        slotSlug = try container.decode(String.self, forKey: .slotSlug)
        menus = try container.decodeIfPresent([BookingMenu].self, forKey: .menus) ?? []
        scheduledAt = try Self.date(container, .scheduledAt)
        scheduledEndAt = try Self.date(container, .scheduledEndAt)
    }

    private static func date(
        _ container: KeyedDecodingContainer<CodingKeys>,
        _ key: CodingKeys
    ) throws -> Date {
        let raw = try container.decode(String.self, forKey: key)
        guard let date = APIDateParser.parse(raw) else {
            throw DecodingError.dataCorruptedError(
                forKey: key, in: container,
                debugDescription: "지원하지 않는 날짜 형식: \(raw)"
            )
        }
        return date
    }
}

// MARK: - 내가 한 예약 (guest)

/// `GET /api/v1/bookings` 응답의 guest 항목.
struct GuestBooking: Decodable, Identifiable, Sendable, BookingDisplayable {
    let id: String
    let scheduledAt: Date
    let scheduledEndAt: Date
    let statusRaw: String
    let message: String?
    let hostName: String
    let hostUsername: String
    let slotTitle: String
    let locationDetail: String?

    private enum CodingKeys: String, CodingKey {
        case id, scheduledAt, scheduledEndAt, message, hostName, hostUsername, slotTitle, locationDetail
        case statusRaw = "status"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        statusRaw = try container.decode(String.self, forKey: .statusRaw)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        hostName = try container.decode(String.self, forKey: .hostName)
        hostUsername = try container.decode(String.self, forKey: .hostUsername)
        slotTitle = try container.decode(String.self, forKey: .slotTitle)
        locationDetail = try container.decodeIfPresent(String.self, forKey: .locationDetail)
        scheduledAt = try Self.date(container, .scheduledAt)
        scheduledEndAt = try Self.date(container, .scheduledEndAt)
    }

    private static func date(
        _ container: KeyedDecodingContainer<CodingKeys>,
        _ key: CodingKeys
    ) throws -> Date {
        let raw = try container.decode(String.self, forKey: key)
        guard let date = APIDateParser.parse(raw) else {
            throw DecodingError.dataCorruptedError(
                forKey: key, in: container,
                debugDescription: "지원하지 않는 날짜 형식: \(raw)"
            )
        }
        return date
    }
}

// MARK: - 요청/응답 페이로드

struct BookingsResponse: Decodable {
    let host: [HostBooking]
    let guest: [GuestBooking]
}

struct BookingActionRequest: Encodable {
    let action: String
}

/// 200 `{"ok":true}`
struct BookingActionResponse: Decodable {
    let ok: Bool?
}
