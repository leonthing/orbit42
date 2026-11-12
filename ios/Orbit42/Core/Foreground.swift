import SwiftUI
import UIKit

extension View {
    /// 앱이 뒤(홈 화면·다른 앱)에서 앞으로 돌아올 때마다 — 그 사이 웹·다른 기기에서 바뀐 것을 다시 받는다(버그-2).
    /// 제어 센터·알림 센터를 잠깐 내린 것은 뒤로 간 게 아니라 부르지 않는다.
    func onReturnToForeground(_ action: @escaping () async -> Void) -> some View {
        onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            Task { await action() }
        }
    }
}
