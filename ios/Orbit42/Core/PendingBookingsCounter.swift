import Foundation
import Observation

/// 내가 답할 예약 건수(승인 대기·받은 시간 요청·받은 시간 변경 제안) — 예약 탭 배지에 쓴다.
/// 예약 화면이 목록을 새로 받을 때마다 알림으로 함께 갱신된다(같은 요청을 두 번 하지 않게).
@MainActor
@Observable
final class PendingBookingsCounter {
    static let didLoad = Notification.Name("orbit42.bookingsDidLoad")

    private(set) var count = 0
    @ObservationIgnored private var observer: NSObjectProtocol?

    init() {
        observer = NotificationCenter.default.addObserver(
            forName: Self.didLoad, object: nil, queue: .main
        ) { [weak self] note in
            let pending = note.userInfo?["pending"] as? Int ?? 0
            MainActor.assumeIsolated { self?.count = pending }
        }
    }

    func refresh() async {
        guard let response: BookingsResponse = try? await APIClient.shared.get("/api/v1/bookings") else {
            return
        }
        count = Self.pending(in: response)
    }

    /// 내가 답할 것: 승인 대기 예약 + 답하지 않은 시간 요청 + 상대가 보낸 시간 변경 제안(받은·내가 한 예약 모두, 개선-30).
    /// 서버 푸시가 없어 배지가 제안을 알리는 길이다. 내가 보낸 제안은 세지 않고,
    /// 승인 대기이면서 제안도 와 있는 예약은 한 건으로 센다.
    static func pending(in response: BookingsResponse) -> Int {
        let hostNeedsReply = response.host.filter {
            $0.status == .pending || ($0.reschedule.map { !$0.byMe } ?? false)
        }.count
        let guestProposals = response.guest.filter { $0.reschedule.map { !$0.byMe } ?? false }.count
        return hostNeedsReply + guestProposals + response.receivedTimeRequests.count
    }
}
