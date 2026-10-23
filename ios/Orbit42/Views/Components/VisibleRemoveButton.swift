import SwiftUI

/// 행 오른쪽의 작은 '빼기' 버튼 — 밀기로만 지울 수 있던 항목을 눈에 보이게 (개선-26).
/// 밀기는 그대로 두고, 같은 동작을 이 버튼으로도 할 수 있게 한다.
struct VisibleRemoveButton: View {
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "minus.circle.fill")
                .font(.body)
                .foregroundStyle(.red.opacity(0.85))
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// 사진 썸네일 모서리의 작은 지우기 버튼 — 꾹 눌러야만 지울 수 있던 사진용 (개선-26)
struct ThumbnailRemoveButton: View {
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 18))
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, .black.opacity(0.6))
                .padding(3)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(accessibilityLabel)
    }
}
