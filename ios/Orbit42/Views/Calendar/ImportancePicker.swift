import SwiftUI

/// 중요도 세 버튼 — 가벼움 / 보통(기본) / 중요함 (1.5.0 A, 나만 본다).
/// 고른 것은 액센트로 채운다. 중요함은 "!", 가벼움은 아래 화살표를 함께 써 색만으로 구분하지 않는다.
struct ImportancePicker: View {
    @Binding var selection: EventImportance

    var body: some View {
        HStack(spacing: 8) {
            ForEach(EventImportance.allCases) { level in
                let isSelected = selection == level
                Button {
                    selection = level
                } label: {
                    HStack(spacing: 4) {
                        switch level {
                        case .high: Image(systemName: "star").font(.caption.weight(.semibold))   // 체크 자리 별과 같은 모양
                        case .low: Image(systemName: "arrow.down").font(.caption.weight(.semibold))
                        case .normal: EmptyView()
                        }
                        Text(level.label)
                            .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    }
                    .foregroundStyle(isSelected ? Color.white : Theme.primaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .frame(maxWidth: .infinity)
                    .background(Capsule().fill(isSelected ? Theme.accent : Theme.fill(0.06)))
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .padding(.vertical, 2)
    }
}
