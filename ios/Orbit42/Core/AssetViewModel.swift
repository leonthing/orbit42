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

    /// 월급/시급 설정 저장 (수면 시간이 함께 바뀌었으면 같이 전송).
    /// 성공하면 요약을 새로고침하고 true 를 반환한다.
    func saveSettings(incomeType: String, amount: Int, sleepHoursPerDay: Double? = nil) async -> Bool {
        await putSettings(
            UpdateTimeAssetSettingsRequest(
                incomeType: incomeType,
                amount: amount,
                sleepHoursPerDay: sleepHoursPerDay
            )
        )
    }

    /// 수면 시간만 저장. 성공하면 요약을 새로고침하고 true 를 반환한다.
    func saveSleepHours(_ hoursPerDay: Double) async -> Bool {
        await putSettings(UpdateTimeAssetSettingsRequest(sleepHoursPerDay: hoursPerDay))
    }

    /// 용도 → 버킷 분류 저장. 성공하면 요약을 새로고침하고 true 를 반환한다.
    func saveBucketMap(_ map: [String: String]) async -> Bool {
        await putSettings(UpdateTimeAssetSettingsRequest(bucketMap: map))
    }

    // MARK: - 프리랜서 (실효 시급)

    /// 프리랜서 전환 + 월별 수입 기록 저장을 한 번에 처리한다.
    /// - `switchType`: 급여 유형이 freelance 로 바뀌었으면 settings PUT (`amount` 불필요)
    /// - `upserts`/`deletedMonths`: 바뀐 월만 income-entries PUT/DELETE
    /// 모든 호출이 끝난 뒤 요약을 한 번만 새로고침한다.
    func saveFreelance(
        switchType: Bool,
        sleepHoursPerDay: Double?,
        upserts: [(month: String, amountKrw: Int)],
        deletedMonths: [String]
    ) async -> Bool {
        guard !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }

        do {
            if switchType || sleepHoursPerDay != nil {
                let updated: TimeAssetSettings = try await api.put(
                    "/api/v1/time-asset/settings",
                    body: UpdateTimeAssetSettingsRequest(
                        incomeType: switchType ? "freelance" : nil,
                        sleepHoursPerDay: sleepHoursPerDay
                    )
                )
                settings = updated
            }
            for upsert in upserts {
                let _: IncomeEntriesResponse = try await api.put(
                    "/api/v1/time-asset/income-entries",
                    body: UpsertIncomeEntryRequest(month: upsert.month, amountKrw: upsert.amountKrw)
                )
            }
            for month in deletedMonths {
                let _: IncomeEntriesResponse = try await api.delete(
                    "/api/v1/time-asset/income-entries?month=\(month)"
                )
            }
            // load(force:)가 요약과 함께 설정(incomeEntries 포함)도 다시 받아온다.
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
