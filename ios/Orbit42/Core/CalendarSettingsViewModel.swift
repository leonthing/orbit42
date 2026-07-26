import Foundation
import Observation

/// 프로필 탭 > 내 캘린더 설정 화면 상태 관리.
/// 목록(`GET /api/v1/calendars`) 로딩과 생성/수정/삭제 mutation 을 담당한다.
/// 모든 mutation 응답은 전체 calendars 배열을 돌려주므로 그대로 교체한다.
@MainActor
@Observable
final class CalendarSettingsViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var calendars: [CalendarInfo]?
    /// 캘린더별 시간당 단가 (id → 원/시간, 설정된 캘린더만) — 편집 시트 프리필용
    private(set) var hourlyRates: [String: Int] = [:]
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 삭제 등 개별 액션 실패 안내 (alert 로 표시)
    var actionMessage: String?
    /// 삭제 요청이 진행 중인 캘린더 id 들 (중복 요청 방지)
    private(set) var deletingIds: Set<String> = []
    /// Google 연결 여부 — 생성 시트의 "Google 캘린더로도 만들기" 토글 노출용
    private(set) var googleConnected = false

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    /// 모든 응답이 전체 배열을 돌려주므로 목록과 단가 맵을 함께 교체한다.
    private func apply(_ response: CalendarsResponse) {
        calendars = response.calendars
        hourlyRates = response.hourlyRatesByCalendarId
    }

    // MARK: - 목록 로딩

    func load(force: Bool = false) async {
        if !force, calendars != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: CalendarsResponse = try await api.get("/api/v1/calendars")
            apply(response)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
            return
        } catch {
            errorMessage = "캘린더를 불러오지 못했어요. 네트워크를 확인해 주세요."
            return
        }

        // Google 연결 여부는 부가 정보 — 실패해도 화면 동작에는 지장 없음
        let status: GoogleStatusResponse? = try? await api.get("/api/v1/google/status")
        if let status {
            googleConnected = status.connected
        }
    }

    // MARK: - 생성/수정 (시트에서 호출 — 실패 시 throw 해서 시트가 에러를 표시)

    func create(_ request: CreateCalendarRequest) async throws {
        let response: CalendarsResponse = try await api.post("/api/v1/calendars", body: request)
        apply(response)
    }

    func update(id: String, request: UpdateCalendarRequest) async throws {
        let response: CalendarsResponse = try await api.patch("/api/v1/calendars/\(id)", body: request)
        apply(response)
    }

    // MARK: - 삭제

    /// 기본 캘린더 삭제 등 서버가 400 으로 거부하면 actionMessage 로 안내한다.
    func delete(_ calendar: CalendarInfo) async {
        guard !deletingIds.contains(calendar.id) else { return }
        deletingIds.insert(calendar.id)
        defer { deletingIds.remove(calendar.id) }

        do {
            let response: CalendarsResponse = try await api.delete("/api/v1/calendars/\(calendar.id)")
            apply(response)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "캘린더를 삭제하지 못했어요. 네트워크를 확인해 주세요."
        }
    }
}
