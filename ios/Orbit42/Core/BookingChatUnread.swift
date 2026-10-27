import Foundation
import Observation

/// 예약 대화 안 읽음 수 (1.8.0) — 예약 목록 행·상세·탭 배지가 함께 본다.
/// 앱 푸시가 붙기 전에는 탭을 열 때·목록을 새로 받을 때 다시 받아 온다.
@MainActor
@Observable
final class BookingChatUnread {
    static let shared = BookingChatUnread()
    private(set) var unread: [String: Int] = [:]

    /// 안 읽은 대화가 있는 예약 수 (탭 배지에 더한다 — 웹 메뉴 배지와 같은 셈)
    var threadCount: Int { unread.values.filter { $0 > 0 }.count }

    func count(for bookingId: String) -> Int { unread[bookingId] ?? 0 }

    func refresh() async {
        guard !BrowseMode.shared.active else { unread = [:]; return }
        guard let r: UnreadChatsResponse = try? await APIClient.shared.get("/api/v1/bookings/chats") else { return }
        unread = r.unread
    }

    func markRead(_ bookingId: String) { unread[bookingId] = 0 }
}
