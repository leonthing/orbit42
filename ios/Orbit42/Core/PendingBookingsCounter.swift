import Foundation
import Observation

/// 받은 예약 중 승인 대기 건수 — 프로필 탭 배지와 프로필의 예약 행에 쓴다.
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

    static func pending(in response: BookingsResponse) -> Int {
        response.host.filter { $0.status == .pending }.count
    }
}
