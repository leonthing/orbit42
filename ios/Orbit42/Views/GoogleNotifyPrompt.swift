import SwiftUI

/// 구글을 연결한 사용자에게 한 번만 — "구글 일정도 이 앱에서 알릴까요?" (1.5.1 버그-3)
/// 구글 일정 스위치는 기본 꺼짐이라 모르고 지나가면 구글 일정 알림이 하나도 없다.
/// 이미 연결된 사람은 앱을 열 때, 처음 연결하는 사람은 연결 직후에 묻고, 답과 상관없이 다시 묻지 않는다.
struct GoogleNotifyPrompt: ViewModifier {
    static let googleConnected = Notification.Name("orbit42.googleConnected")

    @State private var showing = false

    func body(content: Content) -> some View {
        content
            .task { await checkConnected() }
            .onReceive(NotificationCenter.default.publisher(for: Self.googleConnected)) { _ in
                if shouldAsk { showing = true }
            }
            .alert("구글 일정도 이 앱에서 알릴까요?", isPresented: $showing) {
                Button("켜기") {
                    AppSettings.shared.markAskedGoogleNotify()
                    AppSettings.shared.setNotifyGoogleEvents(true)
                    Task {
                        await EventReminders.shared.requestAuthorizationIfNeeded()
                        await EventReminders.shared.refresh()
                    }
                }
                Button("지금은 안 함", role: .cancel) {
                    AppSettings.shared.markAskedGoogleNotify()
                }
            } message: {
                Text("구글 캘린더 앱에서도 울릴 수 있어 기본으로 꺼 두었어요. '중요함'과 일정마다 고른 알림은 이 설정과 상관없이 울려요. 나중에 프로필 › 내 캘린더 › 알림에서 바꿀 수 있어요.")
            }
    }

    private var shouldAsk: Bool {
        !AppSettings.shared.askedGoogleNotify && !AppSettings.shared.notifyGoogleEvents
    }

    private func checkConnected() async {
        guard shouldAsk else { return }
        guard let status: GoogleStatusResponse = try? await APIClient.shared.get("/api/v1/google/status"),
              status.connected else { return }
        // 화면이 자리 잡은 뒤에 (시작 직후 다른 시트와 겹치지 않게)
        try? await Task.sleep(nanoseconds: 1_200_000_000)
        if shouldAsk { showing = true }
    }
}
