import SwiftUI

/// 프로필 탭 > 알림 설정 — 유형별 인앱/이메일 토글.
/// 토글 변경 즉시 PATCH 하고, 실패하면 원복 + alert 로 안내한다.
struct NotificationPrefsView: View {
    @State private var viewModel = NotificationPrefsViewModel()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("알림 설정")
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
        .task { await viewModel.load() }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let prefs = viewModel.prefs {
            prefList(prefs)
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
            Text("알림 설정을 불러오는 중이에요")
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

    // MARK: - 목록

    private func prefList(_ prefs: [NotificationPref]) -> some View {
        List {
            Section {
                ForEach(prefs) { pref in
                    prefRow(pref)
                }
            } header: {
                HStack {
                    Text("알림 유형")
                    Spacer()
                    Text("인앱")
                        .frame(width: Self.toggleColumnWidth)
                    Text("이메일")
                        .frame(width: Self.toggleColumnWidth)
                }
            } footer: {
                Text("토글을 바꾸면 바로 저장돼요")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    private static let toggleColumnWidth: CGFloat = 60

    private func prefRow(_ pref: NotificationPref) -> some View {
        HStack(spacing: 8) {
            Text(pref.label)
                .font(.subheadline)
                .foregroundStyle(Theme.primaryText)
                .lineLimit(2)

            Spacer(minLength: 0)

            Toggle("", isOn: channelBinding(pref, channel: "inApp"))
                .labelsHidden()
                .tint(Theme.accent)
                .frame(width: Self.toggleColumnWidth)
                .accessibilityLabel("\(pref.label) 인앱 알림")

            Toggle("", isOn: channelBinding(pref, channel: "email"))
                .labelsHidden()
                .tint(Theme.accent)
                .frame(width: Self.toggleColumnWidth)
                .accessibilityLabel("\(pref.label) 이메일 알림")
        }
        .padding(.vertical, 2)
    }

    /// 토글 바인딩 — set 에서 즉시 PATCH (뷰모델이 낙관적 반영/원복을 담당)
    private func channelBinding(_ pref: NotificationPref, channel: String) -> Binding<Bool> {
        Binding(
            get: {
                let current = viewModel.prefs?.first { $0.type == pref.type }
                return channel == "inApp" ? (current?.inApp ?? pref.inApp) : (current?.email ?? pref.email)
            },
            set: { newValue in
                Task {
                    await viewModel.setEnabled(type: pref.type, channel: channel, enabled: newValue)
                }
            }
        )
    }
}

#Preview {
    NavigationStack {
        NotificationPrefsView()
    }
    .tint(Theme.accent)
}
