import Observation
import SwiftUI

// MARK: - 뷰모델

/// 팔로우 추천 목록 상태 — 가입 온보딩과 오르빗 탭 추천 섹션이 공유한다.
/// (Core/ 는 병렬 작업 중이라 화면 파일에 같이 둔다.)
@MainActor
@Observable
final class FollowSuggestionsViewModel {
    /// nil 이면 로딩 전. 실패 시 빈 배열 (추천은 부가 콘텐츠).
    private(set) var users: [RecommendedUser]?
    /// 이 화면에서 팔로우한 사람들 (버튼 상태 표시용)
    private(set) var followed: Set<String> = []
    private(set) var busy: Set<String> = []

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    var followedCount: Int { followed.count }

    func load(force: Bool = false) async {
        if !force, users != nil { return }
        do {
            let response: RecommendationsResponse = try await api.get("/api/v1/recommendations")
            users = response.users
        } catch {
            if users == nil { users = [] }
        }
    }

    /// 팔로우 ↔ 언팔로우 토글. 성공하면 followed 집합을 서버 응답 기준으로 갱신한다.
    func toggleFollow(_ username: String) async {
        guard !busy.contains(username) else { return }
        busy.insert(username)
        defer { busy.remove(username) }

        let target = !followed.contains(username)
        do {
            let response: FollowResponse = try await api.post(
                "/api/v1/users/\(username)/follow",
                body: FollowRequest(follow: target)
            )
            if response.isFollowing {
                followed.insert(username)
            } else {
                followed.remove(username)
            }
        } catch {
            // 버튼 상태가 그대로면 실패를 알 수 있다 — 조용히 무시.
        }
    }
}

// MARK: - 추천 사용자 행 (온보딩·오르빗 탭 공용)

struct SuggestedPersonRow: View {
    let user: RecommendedUser
    let isFollowed: Bool
    let isBusy: Bool
    let onFollow: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            DiscoverAvatar(url: user.avatarURL, name: user.preferredName, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(user.preferredName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Text("@\(user.username)")
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                    .lineLimit(1)
                InterestTagStrip(interests: user.interests)
                    .padding(.top, 2)
            }
            Spacer(minLength: 8)
            followButton
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    private var followButton: some View {
        Button(action: onFollow) {
            Text(isFollowed ? "팔로잉" : "팔로우")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(isFollowed ? Theme.secondaryText : .white)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    isFollowed ? Theme.fill(0.08) : Theme.accent,
                    in: Capsule()
                )
        }
        .buttonStyle(.borderless)
        .disabled(isBusy)
        .opacity(isBusy ? 0.6 : 1)
    }
}
