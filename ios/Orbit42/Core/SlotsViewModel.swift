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
    /// 방금 만든 슬롯 — 만들자마자 공유 시트를 띄우는 데 쓴다(소비 후 nil).
    var justCreated: TimeSlot?
    /// 간단 생성 시트에서 만든 슬롯 — 시트가 닫힌 뒤 justCreated 로 옮겨 공유 시트를 띄운다
    /// (시트 위에 시트를 바로 올리면 표시되지 않는다).
    var pendingShare: TimeSlot?
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
            errorMessage = "예약 링크를 불러오지 못했어요. 네트워크를 확인해 주세요."
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
                if let slug = response.slug {
                    justCreated = slots?.first(where: { $0.slug == slug })
                }
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

    // MARK: - 간단 생성 (제목·길이·가격·요일·시간대)

    /// 성공하면 true — 시트를 닫고 공유 시트를 띄운다.
    func createSimple(_ input: SimpleSlotInput) async -> Bool {
        guard !isCreatingPreset else { return false }
        isCreatingPreset = true
        defer { isCreatingPreset = false }

        do {
            // 1) 새 서버: POST /api/v1/slots 로 한 번에 만든다.
            do {
                let response: SlotResponse = try await api.post("/api/v1/slots", body: input)
                await load(force: true)
                pendingShare = slots?.first(where: { $0.id == response.slot.id }) ?? response.slot
                return true
            } catch let apiError as APIError where apiError.isNotSupported {
                // 2) 구 서버: 프리셋으로 만든 뒤 같은 값으로 덮어쓴다.
            }
            var slug: String?
            for preset in SlotPreset.allCases {
                let response: SlotPresetResponse = try await api.post(
                    "/api/v1/slots/presets",
                    body: SlotPresetRequest(key: preset.rawValue)
                )
                if let created = response.slug, !response.wasSkipped {
                    slug = created
                    break
                }
            }
            guard let slug else {
                actionMessage = "슬롯을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
                return false
            }
            await load(force: true)
            guard let created = slots?.first(where: { $0.slug == slug }) else {
                actionMessage = "슬롯을 만들었지만 목록에서 찾지 못했어요."
                return false
            }
            let patched: SlotResponse = try await api.patch(
                "/api/v1/slots/\(created.id)",
                body: SimpleSlotPatch(
                    title: input.title,
                    durationMin: input.durationMin,
                    priceCents: input.priceCents,
                    mode: input.mode,
                    workingHours: input.workingHours,
                    autoApprove: input.autoApprove
                )
            )
            applyUpdated(patched.slot)
            pendingShare = patched.slot
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            return false
        } catch {
            actionMessage = "슬롯을 만들지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }
}
