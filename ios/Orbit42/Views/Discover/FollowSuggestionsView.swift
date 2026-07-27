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
                    .foregroundStyle(.white)
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
                    isFollowed ? Color.white.opacity(0.08) : Theme.accent,
                    in: Capsule()
                )
        }
        .buttonStyle(.borderless)
        .disabled(isBusy)
        .opacity(isBusy ? 0.6 : 1)
    }
}

// MARK: - 가입 온보딩 화면

/// 방금 가입한 사용자에게 팔로우할 사람을 추천한다.
/// 팔로우한 사람들의 열리는 시간이 오르빗 탭에 모인다는 걸 처음부터 보여주는 장치.
struct FollowOnboardingView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var viewModel = FollowSuggestionsViewModel()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                content
                startButton
            }
        }
        .task { await viewModel.load() }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "circle.dotted.circle")
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(Theme.accent)
            Text("함께할 사람을 팔로우해 보세요")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Text("팔로우한 사람들의 열리는 시간이\n오르빗 탭에 모여요. 나중에 바꿀 수 있어요.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.top, 32)
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
    }

    @ViewBuilder
    private var content: some View {
        if let users = viewModel.users {
            if users.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "person.2")
                        .font(.system(size: 30, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text("아직 추천할 사람이 없어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                    Text("오르빗 탭에서 언제든 찾아볼 수 있어요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(users) { user in
                            SuggestedPersonRow(
                                user: user,
                                isFollowed: viewModel.followed.contains(user.username),
                                isBusy: viewModel.busy.contains(user.username)
                            ) {
                                Task { await viewModel.toggleFollow(user.username) }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)
                }
            }
        } else {
            ProgressView()
                .tint(Theme.accent)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var startButton: some View {
        Button {
            auth.finishFollowOnboarding()
        } label: {
            Text(viewModel.followedCount > 0 ? "\(viewModel.followedCount)명 팔로우하고 시작하기" : "시작하기")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
    }
}

#Preview {
    FollowOnboardingView()
        .environment(AuthViewModel())
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
