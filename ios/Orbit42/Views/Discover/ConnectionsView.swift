import Observation
import SwiftUI

// MARK: - 세그먼트 종류

/// 팔로워(이 사람을 팔로우하는) / 팔로잉(이 사람이 팔로우하는) 목록 구분.
enum ConnectionType: String, CaseIterable, Identifiable {
    case orbiters
    case orbiting

    var id: String { rawValue }

    var title: String {
        switch self {
        case .orbiters: return "팔로워"
        case .orbiting: return "팔로잉"
        }
    }
}

// MARK: - 뷰모델

/// 팔로워/팔로잉 목록 상태 관리 — 세그먼트별로 lazy 로드하고 캐시한다.
/// (Core/ 는 병렬 작업 중이라 화면 파일에 같이 둔다.)
@MainActor
@Observable
final class ConnectionsViewModel {
    let username: String
    var selected: ConnectionType

    /// 세그먼트별 캐시 — 한 번 불러온 목록은 화면이 살아있는 동안 유지된다.
    private var cache: [ConnectionType: [ConnectionUser]] = [:]
    /// 지금 불러오는 중인 세그먼트 (세그먼트 전환 중의 이전 로드와 구분).
    private var loadingType: ConnectionType?
    private(set) var errorMessage: String?

    private let api: APIClient

    init(username: String, initialType: ConnectionType, api: APIClient = .shared) {
        self.username = username
        self.selected = initialType
        self.api = api
    }

    /// 현재 세그먼트의 목록 (아직 안 불러왔으면 nil).
    var users: [ConnectionUser]? { cache[selected] }

    var isLoading: Bool { loadingType == selected }

    func load(force: Bool = false) async {
        let type = selected
        if !force, cache[type] != nil { return }
        if loadingType == type { return }

        loadingType = type
        errorMessage = nil
        defer { if loadingType == type { loadingType = nil } }

        do {
            let response: ConnectionsResponse = try await api.get(
                "/api/v1/users/\(username)/connections?type=\(type.rawValue)"
            )
            cache[type] = response.users
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            if type == selected { errorMessage = apiError.errorDescription }
        } catch {
            if type == selected {
                errorMessage = "목록을 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}

// MARK: - 화면

/// 팔로워/팔로잉 목록 — 행 탭 → 그 사람 프로필로 이동 (그래프 탐색).
struct ConnectionsView: View {
    @State private var viewModel: ConnectionsViewModel

    init(username: String, initialType: ConnectionType) {
        _viewModel = State(
            initialValue: ConnectionsViewModel(username: username, initialType: initialType)
        )
    }

    var body: some View {
        @Bindable var viewModel = viewModel
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                Picker("목록 구분", selection: $viewModel.selected) {
                    ForEach(ConnectionType.allCases) { type in
                        Text(type.title).tag(type)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 4)

                content
            }
        }
        .navigationTitle("@\(viewModel.username)")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: viewModel.selected) {
            await viewModel.load()
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let users = viewModel.users {
            if users.isEmpty {
                emptyState
            } else {
                userList(users)
            }
        } else if viewModel.isLoading {
            VStack(spacing: 12) {
                ProgressView()
                    .tint(Theme.accent)
                Text("목록을 불러오는 중이에요")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let message = viewModel.errorMessage {
            VStack(spacing: 12) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(Theme.secondaryText)
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
                Button {
                    Task { await viewModel.load(force: true) }
                } label: {
                    Text("다시 시도")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Theme.surface, in: Capsule())
                }
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Color.clear
        }
    }

    // MARK: - 목록

    private func userList(_ users: [ConnectionUser]) -> some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(users) { user in
                    NavigationLink {
                        PersonProfileView(username: user.username)
                    } label: {
                        userRow(user)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    private func userRow(_ user: ConnectionUser) -> some View {
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
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - empty state

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.2")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("아직 아무도 없어요")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.white)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    NavigationStack {
        ConnectionsView(username: "leo", initialType: .orbiters)
    }
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
