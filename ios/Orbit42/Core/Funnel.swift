import Foundation

/// 예약 링크 방문 흐름 익명 집계 (개선-32) — 단계 횟수만 서버에 +1. 사람을 알아볼 값은 보내지 않는다.
/// 예약 성공(booked)은 서버가 예약 요청에서 직접 센다.
enum Funnel {
    private struct Body: Encodable {
        let slotId: String?
        let hostUsername: String?
        let step: String
        let source = "ios"
    }

    /// 예약 링크 화면 열람
    static func slotViewed(slotId: String) {
        APIClient.shared.fireAndForget("/api/v1/funnel", body: Body(slotId: slotId, hostUsername: nil, step: "slot_view"))
    }

    /// 시간을 골라 예약 확인 화면을 엶
    static func timePicked(slotId: String) {
        APIClient.shared.fireAndForget("/api/v1/funnel", body: Body(slotId: slotId, hostUsername: nil, step: "time_picked"))
    }

    /// 다른 사람 프로필 열람
    static func profileViewed(username: String) {
        APIClient.shared.fireAndForget("/api/v1/funnel", body: Body(slotId: nil, hostUsername: username, step: "profile_view"))
    }
}
