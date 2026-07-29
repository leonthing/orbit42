import SwiftUI

/// 넓은 화면(iPad·가로 모드)에서 본문이 가로로 늘어지지 않도록 최대 폭을 제한하고
/// 가운데 정렬한다. iPhone(compact) 에서는 아무것도 하지 않는다.
///
/// 배경 레이어에는 걸지 않는다 — `ZStack { Theme.background; content }` 구조에서
/// `content` 에만 걸어야 배경은 화면 전체를 채우고 본문만 가운데로 모인다.
private struct ReadableWidth: ViewModifier {
    @Environment(\.horizontalSizeClass) private var sizeClass
    let maxWidth: CGFloat

    func body(content: Content) -> some View {
        if sizeClass == .regular {
            content
                .frame(maxWidth: maxWidth)
                .frame(maxWidth: .infinity)
        } else {
            content
        }
    }
}

extension View {
    /// 넓은 화면에서만 본문 폭을 제한한다. 달력처럼 넓을수록 좋은 화면에는 쓰지 않는다.
    func readableWidth(_ maxWidth: CGFloat = 700) -> some View {
        modifier(ReadableWidth(maxWidth: maxWidth))
    }
}
