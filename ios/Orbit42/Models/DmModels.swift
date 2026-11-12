import Foundation

/// 회원 사이 1:1 대화 (1.9.0) — /api/v1/dm
struct DmPeer: Decodable, Equatable, Hashable {
    let id: String
    let username: String
    let display_name: String?
    let avatar_url: String?

    var name: String { (display_name?.isEmpty == false ? display_name : nil) ?? username }
}

/// view: "open" 대화 / "incoming" 받은 요청 / "pending" 내가 보낸 요청(답이 없음)
struct DmSummary: Decodable, Identifiable, Equatable {
    let id: String
    let view: String
    let peer: DmPeer
    let lastMessageAt: String?
    let preview: String?
    let lastSenderIsMe: Bool
    let unread: Bool

    var lastDate: Date? { lastMessageAt.flatMap { APIDateParser.parse($0) } }
}

struct DmListResponse: Decodable {
    let items: [DmSummary]
    let requests: [DmSummary]
    let unread: Int
}

struct DmMessage: Decodable, Identifiable, Equatable {
    let id: String
    let senderId: String
    let mine: Bool
    let body: String
    let createdAt: String

    var createdDate: Date? { APIDateParser.parse(createdAt) }
}

struct DmThread: Decodable {
    let id: String
    let view: String
    let peer: DmPeer
    let canWrite: Bool
    let reason: String?
    let messages: [DmMessage]
}

struct DmStartRequest: Encodable {
    let username: String
    var body: String? = nil
}

struct DmStartResponse: Decodable {
    let id: String
    let view: String
}

struct DmSendRequest: Encodable { let body: String }
struct DmSendResponse: Decodable { let ok: Bool?; let message: DmMessage? }
struct DmActionRequest: Encodable {
    let action: String
    var messageId: String? = nil
    var reason: String? = nil
}

/// 프로필 '대화' 버튼 상태 — "open" | "request" | "pending" | "incoming" | nil(숨김)
struct DmStateResponse: Decodable { let state: String? }

/// /api/v1/chats — 대화 배지 (예약 대화 + 1:1), dmOpen: 1:1 대화가 켜졌는지(시행일 11/20부터)
struct ChatsBadgeResponse: Decodable {
    let booking: Int
    let dm: Int
    let total: Int
    let dmOpen: Bool
}

enum DmLimits {
    static let maxLength = 2000
}
