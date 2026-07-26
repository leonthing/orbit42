import Foundation
import Observation

/// 타인 프로필 화면 상태 관리.
/// 로드(`GET /api/v1/users/{username}`), 팔로우 토글(`POST /api/v1/users/{username}/follow`).
@MainActor
@Observable
final class PersonProfileViewModel {
    let username: String

    /// nil 이면 아직 최초 로딩 전.
    private(set) var data: PersonProfileResponse?
    private(set) var isLoading = false
    /// 최초 로딩 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 액션 실패 안내 (alert 로 표시)
    var actionMessage: String?
    private(set) var isTogglingFollow = false

    private let api: APIClient

    init(username: String, api: APIClient = .shared) {
        self.username = username
        self.api = api
    }

    func load(force: Bool = false) async {
        if !force, data != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: PersonProfileResponse = try await api.get("/api/v1/users/\(username)")
            data = response
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "프로필을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    /// "궤도에 추가" / "궤도에서 제거" 토글.
    func toggleFollow() async {
        guard let current = data, !isTogglingFollow else { return }
        isTogglingFollow = true
        defer { isTogglingFollow = false }

        do {
            let response: FollowResponse = try await api.post(
                "/api/v1/users/\(username)/follow",
                body: FollowRequest(follow: !current.isFollowing)
            )
            data?.isFollowing = response.isFollowing
            // 궤도(팔로워) 카운트도 낙관적으로 맞춰준다.
            if response.isFollowing != current.isFollowing {
                data?.orbiters = max(0, current.orbiters + (response.isFollowing ? 1 : -1))
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
}
