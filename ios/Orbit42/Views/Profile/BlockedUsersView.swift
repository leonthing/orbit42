import SwiftUI

/// 차단 관리 화면 — 설정 > 차단 관리에서 push.
/// `GET /api/v1/blocks` 로 목록을 불러오고, 각 행의 [해제] 버튼으로
/// `POST /api/v1/users/{username}/block {block:false}` 후 목록을 재조회한다.
struct BlockedUsersView: View {
    @State private var users: [BlockedUser]?
    @State private var isLoading = false
    /// 최초 로딩 실패 메시지 (전체 화면 에러 상태용)
    @State private var errorMessage: String?
    /// 해제 실패 안내 (alert 로 표시)
    @State private var actionMessage: String?
    /// 해제 요청이 진행 중인 username 집합
    @State private var unblocking: Set<String> = []

    private let api = APIClient.shared

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("차단 관리")
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            "안내",
            isPresented: Binding(
                get: { actionMessage != nil },
                set: { if !$0 { actionMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(actionMessage ?? "")
        }
        .task {
            await load()
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let users {
            if users.isEmpty {
                emptyState
            } else {
                list(users)
            }
        } else if isLoading {
            VStack(spacing: 12) {
                ProgressView()
                    .tint(Theme.accent)
                Text("차단 목록을 불러오는 중이에요")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let message = errorMessage {
            VStack(spacing: 12) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(Theme.secondaryText)
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
                Button {
                    Task { await load() }
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

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "hand.raised.slash")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("차단한 사용자가 없어요")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.primaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func list(_ users: [BlockedUser]) -> some View {
        ScrollView {
            VStack(spacing: 8) {
                ForEach(users) { user in
                    row(user)
                }
            }
            .padding(16)
        }
        .refreshable {
            await load()
        }
    }

    private func row(_ user: BlockedUser) -> some View {
        HStack(spacing: 12) {
            DiscoverAvatar(url: user.avatarURL, name: user.preferredName, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(user.preferredName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Text("@\(user.username)")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Button {
                Task { await unblock(user.username) }
            } label: {
                Text("해제")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Theme.accent.opacity(0.15), in: Capsule())
            }
            .disabled(unblocking.contains(user.username))
            .opacity(unblocking.contains(user.username) ? 0.5 : 1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - 액션

    private func load() async {
        if isLoading { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: BlocksResponse = try await api.get("/api/v1/blocks")
            users = response.users
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            if users == nil { errorMessage = apiError.errorDescription }
        } catch {
            if users == nil {
                errorMessage = "차단 목록을 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }

    private func unblock(_ username: String) async {
        guard !unblocking.contains(username) else { return }
        unblocking.insert(username)
        defer { unblocking.remove(username) }

        do {
            let _: BlockResponse = try await api.post(
                "/api/v1/users/\(username)/block",
                body: BlockRequest(block: false)
            )
            await load()
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

#Preview {
    NavigationStack {
        BlockedUsersView()
    }
    .tint(Theme.accent)
}
