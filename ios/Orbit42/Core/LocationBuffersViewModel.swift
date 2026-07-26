import Foundation
import Observation

/// 프로필 탭 > 이동시간 버퍼 화면 상태 관리.
/// 목록(`GET /api/v1/location-buffers`)과 생성/수정/삭제 mutation 을 담당한다.
/// 모든 mutation 응답은 buffers 전체 배열을 돌려주므로 그대로 교체한다.
@MainActor
@Observable
final class LocationBuffersViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var buffers: [LocationBuffer]?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 삭제 등 개별 액션 실패 안내 (alert 로 표시)
    var actionMessage: String?
    /// 삭제 요청이 진행 중인 버퍼 id 들 (중복 요청 방지)
    private(set) var deletingIds: Set<String> = []

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 목록 로딩

    func load(force: Bool = false) async {
        if !force, buffers != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: LocationBuffersResponse = try await api.get("/api/v1/location-buffers")
            buffers = response.buffers
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "이동시간 버퍼를 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 생성/수정 (시트에서 호출 — 실패 시 throw 해서 시트가 에러를 표시)

    func create(_ request: CreateLocationBufferRequest) async throws {
        let response: LocationBuffersResponse = try await api.post("/api/v1/location-buffers", body: request)
        buffers = response.buffers
    }

    func update(id: String, request: PatchLocationBufferRequest) async throws {
        let response: LocationBuffersResponse = try await api.patch("/api/v1/location-buffers/\(id)", body: request)
        buffers = response.buffers
    }

    // MARK: - 삭제

    func delete(_ buffer: LocationBuffer) async {
        guard !deletingIds.contains(buffer.id) else { return }
        deletingIds.insert(buffer.id)
        defer { deletingIds.remove(buffer.id) }

        do {
            let response: LocationBuffersResponse = try await api.delete("/api/v1/location-buffers/\(buffer.id)")
            buffers = response.buffers
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "이동시간 버퍼를 삭제하지 못했어요. 네트워크를 확인해 주세요."
        }
    }
}
