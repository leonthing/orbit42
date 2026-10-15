import SwiftUI

/// 길이 칩(30분·1시간·2시간) — 누르면 시작은 그대로 두고 끝만 바꾼다. 새 일정·수정 화면이 같이 쓴다.
struct DurationChips: View {
    let start: Date
    @Binding var end: Date

    private static let options: [(label: String, minutes: Int)] = [
        ("30분", 30), ("1시간", 60), ("2시간", 120),
    ]

    var body: some View {
        let current = Int(end.timeIntervalSince(start) / 60)
        HStack(spacing: 8) {
            Text("길이")
                .foregroundStyle(Theme.primaryText)
            Spacer()
            ForEach(Self.options, id: \.minutes) { option in
                let selected = current == option.minutes
                Button {
                    end = start.addingTimeInterval(TimeInterval(option.minutes * 60))
                } label: {
                    Text(option.label)
                        .font(.subheadline.weight(selected ? .semibold : .regular))
                        .foregroundStyle(selected ? .white : Theme.primaryText)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(selected ? Theme.accent : Theme.background, in: Capsule())
                }
                .buttonStyle(.borderless)
            }
        }
    }
}
