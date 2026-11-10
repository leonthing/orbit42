import Foundation

/// 예약 대화 (1.8.0) — /api/v1/bookings/{id}/messages
struct BookingChatMessage: Decodable, Identifiable, Equatable {
    let id: String
    let role: String      // "host" | "guest"
    let mine: Bool
    let body: String
    let createdAt: String

    var createdDate: Date? { APIDateParser.parse(createdAt) }
}

struct BookingChatState: Decodable, Equatable {
    let canWrite: Bool
    let reason: String?
    let closed: Bool
    let writeClosesAt: String
}

struct BookingChatResponse: Decodable {
    let messages: [BookingChatMessage]
    let state: BookingChatState
    let hostLabel: String?
    let guestLabel: String?
    let slotTitle: String?
    let suggestFirstNote: Bool?
    let role: String?
}

struct SendChatRequest: Encodable { let body: String }
struct SendChatResponse: Decodable { let ok: Bool?; let message: BookingChatMessage? }
struct ChatActionRequest: Encodable {
    let action: String
    var messageId: String? = nil
    var reason: String? = nil
}

/// /api/v1/bookings/chats — 예약별 안 읽은 메시지 수
struct UnreadChatsResponse: Decodable {
    let unread: [String: Int]
    let total: Int
}
