import Foundation
import Observation

/// 시간 요청 시트 상태 관리 (`POST /api/v1/users/{username}/time-request`).
@MainActor
@Observable
final class TimeRequestViewModel {
    let username: String

    var message = ""
    var durationMin = 60
    /// 예산(원) — 숫자만 남겨 전송, 비우면 생략
    var budgetText = ""
    /// 희망 시간대 (예: "평일 저녁") — 비우면 생략
    var preferredTimes = ""

    private(set) var isSubmitting = false
    /// 전송 실패 안내 (alert 로 표시)
    var errorMessage: String?

    static let durationChoices = [30, 60, 90, 120]

    private let api: APIClient

    init(username: String, api: APIClient = .shared) {
        self.username = username
        self.api = api
    }

    var canSubmit: Bool {
        !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSubmitting
    }

    /// 요청 전송. 성공하면 true.
    func submit() async -> Bool {
        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty, !isSubmitting else { return false }
        isSubmitting = true
        defer { isSubmitting = false }

        let budget = Int(budgetText.filter(\.isNumber))
        let trimmedTimes = preferredTimes.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = TimeRequestBody(
            message: trimmedMessage,
            durationMin: durationMin,
            budgetKrw: budget,
            preferredTimes: trimmedTimes.isEmpty ? nil : trimmedTimes
        )

        do {
            let _: OkResponse = try await api.post("/api/v1/users/\(username)/time-request", body: body)
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
            return false
        } catch {
            errorMessage = "요청을 보내지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }
}
