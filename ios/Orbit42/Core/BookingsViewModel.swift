import Foundation
import Observation

/// 예약 탭 상태 관리.
/// 목록(`GET /api/v1/bookings`) 로딩, 수락/거절/완료/취소 액션(`PATCH /api/v1/bookings/{id}`).
@MainActor
@Observable
final class BookingsViewModel {
    enum Segment: String, CaseIterable, Identifiable {
        case host
        case guest

        var id: String { rawValue }

        var title: String {
            switch self {
            case .host: return "받은 예약"
            case .guest: return "내가 한 예약"
            }
        }
    }

    var segment: Segment = .host
    /// nil 이면 아직 최초 로딩 전.
    private(set) var data: BookingsResponse?
    /// 보관함(개선-25) — `GET /api/v1/bookings?archived=1`. 옛 서버면 nil 로 남는다.
    private(set) var archived: BookingsResponse?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 액션 실패 안내 (alert 로 표시)
    var actionMessage: String?
    /// 액션 요청이 진행 중인 예약 id 들 (중복 요청 방지)
    private(set) var actingIds: Set<String> = []

    /// 최초 로딩 후 한 번만: 받은 예약이 없고 내가 한 예약만 있으면 guest 세그먼트로 시작
    private var didPickInitialSegment = false

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 목록 로딩

    /// 예약 목록을 불러온다. 이미 로딩된 상태면 `force` 가 아닌 한 네트워크를 타지 않는다.
    func load(force: Bool = false) async {
        if !force, data != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            async let archivedCall: BookingsResponse? = try? await api.get("/api/v1/bookings?archived=1")
            let response: BookingsResponse = try await api.get("/api/v1/bookings")
            data = response
            archived = await archivedCall
            pickInitialSegmentIfNeeded(response)
            NotificationCenter.default.post(
                name: PendingBookingsCounter.didLoad,
                object: nil,
                userInfo: ["pending": PendingBookingsCounter.pending(in: response)]
            )
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "예약을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    private func pickInitialSegmentIfNeeded(_ response: BookingsResponse) {
        guard !didPickInitialSegment else { return }
        didPickInitialSegment = true
        if response.host.isEmpty, response.receivedTimeRequests.isEmpty, !response.guest.isEmpty {
            segment = .guest
        }
    }

    // MARK: - 보관 / 여러 개 (개선-25)

    /// 보관함에 든 예약 수 (지금 세그먼트 기준)
    func archivedCount(_ segment: Segment) -> Int {
        guard let archived else { return 0 }
        return segment == .host ? archived.host.count : archived.guest.count
    }

    /// 내 목록에서 보관 — 상대방 목록은 그대로. 여러 개면 한꺼번에 보내고 한 번만 다시 불러온다.
    func archive(_ ids: [String]) async {
        await runBulk(ids, failure: "보관하지 못한 예약이 있어요. 잠시 후 다시 시도해 주세요.") { id in
            let _: BookingActionResponse = try await self.api.patch(
                "/api/v1/bookings/\(id)",
                body: BookingActionRequest(action: "archive")
            )
        }
    }

    /// 보관함에서 꺼내 다시 목록으로
    func unarchive(_ ids: [String]) async {
        await runBulk(ids, failure: "되돌리지 못한 예약이 있어요. 잠시 후 다시 시도해 주세요.") { id in
            let _: BookingActionResponse = try await self.api.patch(
                "/api/v1/bookings/\(id)",
                body: BookingActionRequest(action: "unarchive")
            )
        }
    }

    /// 내 목록에서 삭제(숨김) — 한 개든 여러 개든. 상대방 기록·거래 통계는 서버에서 유지된다.
    func deleteBookings(_ ids: [String]) async {
        await runBulk(ids, failure: "삭제하지 못한 예약이 있어요. 잠시 후 다시 시도해 주세요.") { id in
            let _: BookingActionResponse = try await self.api.delete("/api/v1/bookings/\(id)")
        }
    }

    private func runBulk(
        _ ids: [String],
        failure: String,
        _ call: @escaping @MainActor (String) async throws -> Void
    ) async {
        let todo = ids.filter { !actingIds.contains($0) }
        guard !todo.isEmpty else { return }
        actingIds.formUnion(todo)
        defer { actingIds.subtract(todo) }
        var firstError: String?
        for id in todo {
            do {
                try await call(id)
            } catch let apiError as APIError {
                firstError = firstError ?? apiError.errorDescription ?? failure
            } catch {
                firstError = firstError ?? failure
            }
        }
        await load(force: true)
        if let firstError { actionMessage = firstError }
    }

    // MARK: - 시간 변경

    /// 시간 변경 요청. 게스트면 호스트 가용 시간에서 고른 것이라 바로 반영되고,
    /// 호스트면 제안으로 남아 게스트의 수락을 기다린다 (서버가 판단).
    /// - Returns: 성공 여부. 실패 사유는 `actionMessage` 로 표시된다.
    @discardableResult
    /// - Parameter startAt: 서버가 내려준 원문(게스트: `BookingOption.startAtRaw`)
    ///   또는 호스트가 고른 시각을 인코딩한 값.
    func requestReschedule(
        bookingId: String,
        startAt: String?,
        availabilityId: String?,
        note: String?,
        propose: Bool = false
    ) async -> Bool {
        guard !actingIds.contains(bookingId) else { return false }
        actingIds.insert(bookingId)
        defer { actingIds.remove(bookingId) }

        do {
            let _: BookingActionResponse = try await api.post(
                "/api/v1/bookings/\(bookingId)/reschedule",
                body: RescheduleRequest(
                    startAt: startAt,
                    availabilityId: availabilityId,
                    note: note,
                    propose: propose ? true : nil
                )
            )
            await load(force: true)
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "시간 변경을 요청하지 못했어요. 네트워크를 확인해 주세요."
        }
        return false
    }

    /// 받은 변경 제안에 응답하거나(`accept`/`decline`),
    /// 내가 보낸 제안을 거둬들인다(`withdraw`).
    func respondToReschedule(bookingId: String, action: RescheduleReply) async {
        guard !actingIds.contains(bookingId) else { return }
        actingIds.insert(bookingId)
        defer { actingIds.remove(bookingId) }

        do {
            let _: BookingActionResponse = try await api.patch(
                "/api/v1/bookings/\(bookingId)/reschedule",
                body: RescheduleResponseRequest(action: action.rawValue)
            )
            await load(force: true)
            WidgetBridge.reload() // 위젯 '답할 일 n건'도 같은 셈이라 바로 맞춘다 (개선-30)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "응답을 처리하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 액션 (수락/거절/완료/취소)

    func act(_ action: BookingAction, on bookingId: String) async {
        guard !actingIds.contains(bookingId) else { return }
        actingIds.insert(bookingId)
        defer { actingIds.remove(bookingId) }

        do {
            let _: BookingActionResponse = try await api.patch(
                "/api/v1/bookings/\(bookingId)",
                body: BookingActionRequest(action: action.rawValue)
            )
            await load(force: true)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "요청을 처리하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 받은 시간 요청 (웹 받은 예약 화면과 같은 서버 함수)

    /// 시간을 정해 수락 — 확정 예약이 생기고 요청자에게 알림이 간다.
    @discardableResult
    func acceptTimeRequest(_ requestId: String, startAt: Date) async -> Bool {
        await answerTimeRequest(requestId) {
            let _: OkResponse = try await self.api.post(
                "/api/v1/time-requests/\(requestId)/accept",
                body: AcceptTimeRequestBody(startAt: APIDateParser.encodeDateTime(startAt))
            )
        }
    }

    /// 거절 — 요청자에게 알림이 간다.
    @discardableResult
    func declineTimeRequest(_ requestId: String) async -> Bool {
        await answerTimeRequest(requestId) {
            let _: OkResponse = try await self.api.post(
                "/api/v1/time-requests/\(requestId)/decline",
                body: EmptyBody()
            )
        }
    }

    private func answerTimeRequest(_ requestId: String, _ call: () async throws -> Void) async -> Bool {
        guard !actingIds.contains(requestId) else { return false }
        actingIds.insert(requestId)
        defer { actingIds.remove(requestId) }
        do {
            try await call()
            await load(force: true)
            WidgetBridge.reload() // 위젯 '답할 일 n건'도 바로 줄게
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            await load(force: true)
            return false
        } catch {
            actionMessage = "요청을 처리하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }
}
