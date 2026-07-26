import Foundation
import Observation

/// 타임슬롯 탭 상태 관리.
/// 목록(`GET /api/v1/slots`) 로딩, 활성/비활성 토글, 프리셋 빠른 생성.
@MainActor
@Observable
final class SlotsViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var slots: [TimeSlot]?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 토글·프리셋 생성 등 개별 액션 결과 안내 (alert 로 표시)
    var actionMessage: String?
    /// 토글 요청이 진행 중인 슬롯 id 들 (중복 요청 방지)
    private(set) var togglingIds: Set<String> = []
    private(set) var isCreatingPreset = false

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 목록 로딩

    /// 슬롯 목록을 불러온다. 이미 로딩된 상태면 `force` 가 아닌 한 네트워크를 타지 않는다.
    func load(force: Bool = false) async {
        if !force, slots != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: SlotsResponse = try await api.get("/api/v1/slots")
            slots = response.slots
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "타임슬롯을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 상세 편집 결과 반영

    /// 상세 화면에서 저장한 슬롯을 목록에 반영한다 (네트워크 재요청 없이).
    func applyUpdated(_ slot: TimeSlot) {
        guard let index = slots?.firstIndex(where: { $0.id == slot.id }) else { return }
        slots?[index] = slot
    }

    // MARK: - 활성/비활성 토글

    func toggleActive(_ slot: TimeSlot) async {
        guard !togglingIds.contains(slot.id) else { return }
        togglingIds.insert(slot.id)
        defer { togglingIds.remove(slot.id) }

        do {
            let response: SlotResponse = try await api.patch(
                "/api/v1/slots/\(slot.id)",
                body: UpdateSlotRequest(active: !slot.active)
            )
            if let index = slots?.firstIndex(where: { $0.id == slot.id }) {
                slots?[index] = response.slot
            } else {
                await load(force: true)
            }
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

    // MARK: - 프리셋 빠른 생성

    func createPreset(_ preset: SlotPreset) async {
        guard !isCreatingPreset else { return }
        isCreatingPreset = true
        defer { isCreatingPreset = false }

        do {
            let response: SlotPresetResponse = try await api.post(
                "/api/v1/slots/presets",
                body: SlotPresetRequest(key: preset.rawValue)
            )
            if response.wasSkipped {
                actionMessage = "이미 같은 이름의 슬롯이 있어요"
            } else {
                await load(force: true)
            }
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "슬롯을 만들지 못했어요. 네트워크를 확인해 주세요."
        }
    }
}
