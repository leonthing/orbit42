import SwiftUI

/// 프로필 탭 > Google 캘린더 — 연동 상태/연결/추가 계정/해제.
struct GoogleSettingsView: View {
    @State private var viewModel = GoogleSettingsViewModel()
    @State private var showingDisconnectConfirm = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("Google 캘린더")
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
            "Google 캘린더 연결을 해제할까요?",
            isPresented: $showingDisconnectConfirm,
            titleVisibility: .visible
        ) {
            Button("연결 해제", role: .destructive) {
                Task { await viewModel.disconnect() }
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("가져온 Google 일정이 더 이상 표시되지 않아요")
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
            Text("연동 상태를 확인하는 중이에요")
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

    private func statusList(_ status: GoogleStatusResponse) -> some View {
        List {
            if status.connected {
                connectedSections
            } else {
                disconnectedSection
            }
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    @ViewBuilder
    private var connectedSections: some View {
        Section {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("연결됨")
                        .foregroundStyle(Theme.primaryText)
                    Text("Google 일정이 캘린더에 함께 표시돼요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(Theme.surface)

        if !viewModel.extraAccounts.isEmpty {
            Section("추가 계정") {
                ForEach(viewModel.extraAccounts) { account in
                    HStack(spacing: 10) {
                        Image(systemName: "person.crop.circle")
                            .foregroundStyle(Theme.secondaryText)
                        Text(account.email)
                            .font(.subheadline)
                            .foregroundStyle(Theme.primaryText)
                    }
                }
            }
            .listRowBackground(Theme.surface)
        }

        Section {
            Button {
                Task { await viewModel.connect(add: true) }
            } label: {
                Label("추가 계정 연결", systemImage: "plus.circle")
            }
            .disabled(viewModel.isConnecting)

            Button(role: .destructive) {
                showingDisconnectConfirm = true
            } label: {
                Label("연결 해제", systemImage: "xmark.circle")
            }
            .disabled(viewModel.isDisconnecting)
        }
        .listRowBackground(Theme.surface)
    }

    private var disconnectedSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 10) {
                    Image(systemName: "circle.dashed")
                        .foregroundStyle(Theme.secondaryText)
                    Text("연결 안 됨")
                        .foregroundStyle(Theme.primaryText)
                }
                Text("Google 캘린더를 연결하면 일정이 함께 표시되고, 캘린더도 양쪽에서 관리할 수 있어요")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                Button {
                    Task { await viewModel.connect() }
                } label: {
                    Group {
                        if viewModel.isConnecting {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("연결하기")
                                .font(.subheadline.weight(.semibold))
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .disabled(viewModel.isConnecting)
            }
            .padding(.vertical, 6)
        }
        .listRowBackground(Theme.surface)
    }
}

#Preview {
    NavigationStack {
        GoogleSettingsView()
    }
    .tint(Theme.accent)
}
