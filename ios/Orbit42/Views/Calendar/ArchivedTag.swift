import SwiftUI

/// 보관한 일정 표시 — 완료(초록 체크·취소선)와 구분되게 회색 "보관" 글자만 붙인다.
struct ArchivedTag: View {
    var compact = false

    var body: some View {
        Text("보관")
            .font(compact ? .system(size: 9, weight: .semibold) : .caption2.weight(.semibold))
            .foregroundStyle(Theme.secondaryText)
            .padding(.horizontal, compact ? 4 : 6)
            .padding(.vertical, compact ? 1 : 2)
            .background(Theme.fill(0.12), in: Capsule())
    }
}

extension CalendarEvent {
    /// 보관한 일정의 흐림 정도 — 완료(0.55)보다 더 흐리게.
    static let archivedOpacity = 0.4
}
