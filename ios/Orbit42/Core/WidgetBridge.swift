import Foundation
import WidgetKit

/// 앱 → 홈 화면 위젯. 위젯은 15분마다 서버에서 일정을 직접 받고,
/// 앱에서 일정·표시 설정이 바뀌면 이걸로 바로 다시 받게 한다.
enum WidgetBridge {
    static func reload() {
        WidgetCenter.shared.reloadAllTimelines()
    }
}
