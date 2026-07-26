import Foundation
import Observation

/// 프로필 탭 > 알림 설정 화면 상태 관리.
/// 목록(`GET /api/v1/notification-prefs`)과 토글 변경(`PATCH`)을 담당한다.
/// 토글은 낙관적으로 먼저 반영하고, 실패하면 원복 + alert 로 안내한다.
@MainActor
@Observable
final class NotificationPrefsViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var prefs: [NotificationPref]?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 토글 저장 실패 안내 (alert 로 표시)
    var actionMessage: String?
    /// PATCH 진행 중인 "type:channel" 키 (중복 요청 방지)
    private(set) var pendingKeys: Set<String> = []

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 목록 로딩

    func load(force: Bool = false) async {
        if !force, prefs != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: NotificationPrefsResponse = try await api.get("/api/v1/notification-prefs")
            prefs = response.prefs
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "알림 설정을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 토글 변경

    /// 토글 하나를 PATCH 한다. 성공 시 서버 응답의 prefs 전체로 교체하고,
    /// 실패(취소 포함) 시 낙관적으로 바꿔둔 값을 원복한다.
    func setEnabled(type: String, channel: String, enabled: Bool) async {
        guard let original = prefs else { return }
        let key = "\(type):\(channel)"
        guard !pendingKeys.contains(key) else { return }
        pendingKeys.insert(key)
        defer { pendingKeys.remove(key) }

        // 낙관적 반영 — 토글이 즉시 움직이도록
        prefs = original.map { pref in
            guard pref.type == type else { return pref }
            return NotificationPref(
                type: pref.type,
                label: pref.label,
                inApp: channel == "inApp" ? enabled : pref.inApp,
                email: channel == "email" ? enabled : pref.email
            )
        }

        do {
            let response: NotificationPrefsResponse = try await api.patch(
                "/api/v1/notification-prefs",
                body: NotificationPrefPatchRequest(type: type, channel: channel, enabled: enabled)
            )
            prefs = response.prefs
        } catch is CancellationError {
            prefs = original
        } catch let urlError as URLError where urlError.code == .cancelled {
            prefs = original
        } catch let apiError as APIError {
            prefs = original
            actionMessage = apiError.errorDescription
        } catch {
            prefs = original
            actionMessage = "알림 설정을 저장하지 못했어요. 네트워크를 확인해 주세요."
        }
    }
}
