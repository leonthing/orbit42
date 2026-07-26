import Foundation
import Observation

/// 자산 탭 상태 관리.
/// 요약(`GET /api/v1/time-asset/summary`) 로딩과
/// 수입 설정(`GET/PUT /api/v1/time-asset/settings`) 저장.
@MainActor
@Observable
final class AssetViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var summary: TimeAssetSummary?
    /// 설정 시트 프리필용 — 실패해도 화면은 뜨도록 비치명 로딩.
    private(set) var settings: TimeAssetSettings?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    private(set) var isSaving = false
    /// 저장 등 개별 액션 실패 안내 (alert 로 표시)
    var actionMessage: String?

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 요약 로딩

    /// 요약을 불러온다. 이미 로딩된 상태면 `force` 가 아닌 한 네트워크를 타지 않는다.
    func load(force: Bool = false) async {
        if !force, summary != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let summary: TimeAssetSummary = try await api.get("/api/v1/time-asset/summary")
            self.summary = summary
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
            return
        } catch {
            errorMessage = "자산 정보를 불러오지 못했어요. 네트워크를 확인해 주세요."
            return
        }

        // 설정은 시트 프리필용 — 실패해도 요약 화면은 그대로 보여준다.
        if let settings: TimeAssetSettings = try? await api.get("/api/v1/time-asset/settings") {
            self.settings = settings
        }
    }

    // MARK: - 수입 설정 저장

    /// 월급/시급 설정 저장. 성공하면 요약을 새로고침하고 true 를 반환한다.
    func saveSettings(incomeType: String, amount: Int) async -> Bool {
        await putSettings(
            UpdateTimeAssetSettingsRequest(incomeType: incomeType, amount: amount)
        )
    }

    /// 용도 → 버킷 분류 저장. 성공하면 요약을 새로고침하고 true 를 반환한다.
    func saveBucketMap(_ map: [String: String]) async -> Bool {
        await putSettings(UpdateTimeAssetSettingsRequest(bucketMap: map))
    }

    private func putSettings(_ body: UpdateTimeAssetSettingsRequest) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }

        do {
            let updated: TimeAssetSettings = try await api.put(
                "/api/v1/time-asset/settings",
                body: body
            )
            settings = updated
            await load(force: true)
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            return false
        } catch {
            actionMessage = "설정을 저장하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }
}
