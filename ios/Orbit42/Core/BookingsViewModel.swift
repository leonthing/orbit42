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
            let response: BookingsResponse = try await api.get("/api/v1/bookings")
            data = response
            pickInitialSegmentIfNeeded(response)
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
        if response.host.isEmpty, !response.guest.isEmpty {
            segment = .guest
        }
    }

    // MARK: - 액션 (수락/거절/완료/취소)

    /// 내 목록에서 예약 삭제(숨김). 상대방 기록·거래 통계는 서버에서 유지된다.
    func deleteBooking(_ bookingId: String) async {
        guard !actingIds.contains(bookingId) else { return }
        actingIds.insert(bookingId)
        defer { actingIds.remove(bookingId) }

        do {
            let _: BookingActionResponse = try await api.delete(
                "/api/v1/bookings/\(bookingId)"
            )
            await load(force: true)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "삭제하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

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
}
