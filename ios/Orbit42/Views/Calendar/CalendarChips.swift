import SwiftUI

/// 일정 만들기·수정의 캘린더 선택 — 드롭다운 대신 캘린더마다 버튼 하나.
/// 고른 캘린더는 캘린더 색으로 채우고 체크 표시를 붙인다(색만으로 구분하지 않는다).
/// 버튼은 폭이 모자라면 다음 줄로 넘어가, 긴 이름이 여러 개여도 모두 보인다.
struct CalendarChips: View {
    let calendars: [CalendarInfo]
    @Binding var selection: String?
    /// 보이지만 누를 수 없는 캘린더 (이유는 부르는 쪽이 아래에 적는다)
    var disabledIds: Set<String> = []

    var body: some View {
        WrapLayout(spacing: 8, lineSpacing: 8) {
            ForEach(calendars) { calendar in
                chip(calendar)
            }
        }
        .padding(.vertical, 4)
    }

    private func chip(_ calendar: CalendarInfo) -> some View {
        let isSelected = selection == calendar.id
        let isDisabled = disabledIds.contains(calendar.id) && !isSelected
        return Button {
            selection = calendar.id
        } label: {
            HStack(spacing: 6) {
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.caption.weight(.bold))
                } else {
                    Circle()
                        .fill(calendar.displayColor)
                        .frame(width: 9, height: 9)
                }
                Text(calendar.name)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? Color.white : Theme.primaryText)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule().fill(isSelected ? calendar.displayColor : Theme.fill(0.06))
            )
            .overlay(
                Capsule().strokeBorder(isSelected ? Color.clear : Theme.fill(0.12), lineWidth: 1)
            )
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.4 : 1)
        .accessibilityLabel(calendar.name)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// 왼쪽부터 채우고 폭이 모자라면 다음 줄로 넘기는 간단한 흐름 배치.
struct WrapLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, lineHeight: CGFloat = 0, widest: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(ProposedViewSize(width: maxWidth, height: nil))
            if x > 0 && x + size.width > maxWidth {
                y += lineHeight + lineSpacing
                x = 0
                lineHeight = 0
            }
            x += size.width + spacing
            widest = max(widest, x - spacing)
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: proposal.width ?? widest, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, lineHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            if x > bounds.minX && x + size.width > bounds.maxX {
                y += lineHeight + lineSpacing
                x = bounds.minX
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
