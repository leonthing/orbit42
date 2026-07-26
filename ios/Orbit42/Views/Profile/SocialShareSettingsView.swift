import SwiftUI

/// 프로필 탭 > 글 자동 공유 — 블로그 글 발행 시 자동 게시할 채널(X·페이스북 페이지·링크드인)
/// OAuth 연결/해제. 프로필 편집의 "소셜 링크"(공개 프로필에 표시되는 URL)와는 별개다.
struct SocialShareSettingsView: View {
    @State private var viewModel = SocialShareViewModel()
    /// 해제 확인 다이얼로그 대상 채널 (nil 이면 닫힘)
    @State private var disconnectTarget: SocialProvider?

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("글 자동 공유")
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            "안내",
            isPresented: Binding(
                get: { viewModel.actionMessage != nil },
                set: { if !$0 { viewModel.actionMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.actionMessage ?? "")
        }
        .confirmationDialog(
            "\(disconnectTarget?.label ?? "") 연결을 해제할까요?",
            isPresented: Binding(
                get: { disconnectTarget != nil },
                set: { if !$0 { disconnectTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("연결 해제", role: .destructive) {
                if let provider = disconnectTarget {
                    Task { await viewModel.disconnect(provider) }
                }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("해제하면 새 글이 이 채널에 자동으로 공유되지 않아요")
        }
        .task { await viewModel.load() }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let status = viewModel.status {
            statusList(status)
        } else if viewModel.isLoading {
            loadingState
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else {
            Color.clear
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.accent)
            Text("연결 상태를 확인하는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
    }

    private func errorState(_ message: String) -> some View {
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
    }

    // MARK: - 상태 화면

    private func statusList(_ status: SocialShareStatusResponse) -> some View {
        List {
            Section {
                ForEach(SocialProvider.allCases) { provider in
                    providerRow(provider, status: status.status(for: provider))
                }
            } header: {
                Text("연결하면 블로그 글을 발행할 때 선택한 채널에 자동으로 공유돼요. 프로필에 표시되는 소셜 링크와는 별개예요.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .textCase(nil)
                    .padding(.bottom, 8)
            } footer: {
                Text("페이스북은 페이지가 있어야 자동 게시할 수 있어요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    private func providerRow(
        _ provider: SocialProvider,
        status: SocialProviderStatus
    ) -> some View {
        HStack(spacing: 12) {
            Image(systemName: status.connected ? "checkmark.circle.fill" : "circle.dashed")
                .foregroundStyle(status.connected ? .green : Theme.secondaryText)

            VStack(alignment: .leading, spacing: 2) {
                Text(provider.label)
                    .foregroundStyle(.white)
                if status.connected {
                    Text(status.name ?? "연결됨")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
            }

            Spacer()

            trailingButton(provider, connected: status.connected)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func trailingButton(_ provider: SocialProvider, connected: Bool) -> some View {
        if viewModel.connectingProvider == provider || viewModel.disconnectingProvider == provider {
            ProgressView()
                .tint(Theme.accent)
        } else if connected {
            Button {
                disconnectTarget = provider
            } label: {
                Text("해제")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
            .disabled(viewModel.isBusy)
        } else {
            Button {
                Task { await viewModel.connect(provider) }
            } label: {
                Text("연결하기")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
            }
            .buttonStyle(.borderless)
            .disabled(viewModel.isBusy)
        }
    }
}

#Preview {
    NavigationStack {
        SocialShareSettingsView()
    }
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
