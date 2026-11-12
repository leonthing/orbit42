import Foundation
import Observation

/// 1:1 대화 (1.9.0) 배지·켜짐 상태. 예약 탭 배지에 1:1 안 읽음 + 받은 요청을 더한다.
/// 서버가 시행일(11/20) 전에는 dmOpen=false 를 주므로, 그때까지 1:1 화면은 숨겨진다.
@MainActor
@Observable
final class DmStore {
    static let shared = DmStore()
    private(set) var open = false
    private(set) var unread = 0

    func refresh() async {
        guard !BrowseMode.shared.active else { open = false; unread = 0; return }
        guard let r: ChatsBadgeResponse = try? await APIClient.shared.get("/api/v1/chats") else { return }
        open = r.dmOpen
        unread = r.dmOpen ? r.dm : 0
    }

    func clear() {
        open = false
        unread = 0
    }
}
