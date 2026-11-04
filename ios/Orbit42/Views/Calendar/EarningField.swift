import SwiftUI

/// 일정 추가·수정의 '금액' 한 줄 — 이 일정으로 번 돈(원). 비우면 기록 없음.
/// 숫자 키패드, 입력하는 동안 천 단위 쉼표. 저장은 PUT /api/v1/time-asset/event-earning.
/// 금액은 본인 캘린더에만 보인다(서버가 본인 일정에만 earningKrw 를 내려 준다).
struct EarningField: View {
    @Binding var text: String

    var body: some View {
        Section {
            HStack(spacing: 8) {
                Text("금액")
                    .foregroundStyle(Theme.primaryText)
                Spacer(minLength: 8)
                TextField("없음", text: $text)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(Theme.primaryText)
                    .accessibilityIdentifier("earningField")
                    .onChange(of: text) { _, newValue in
                        let formatted = Self.format(newValue)
                        if formatted != newValue { text = formatted }
                    }
                if !text.isEmpty {
                    Text("원")
                        .foregroundStyle(Theme.secondaryText)
                }
            }
        } footer: {
            Text("이 일정으로 번 돈을 적어 두면 캘린더와 리포트 수입에 반영돼요. 나만 볼 수 있어요.")
        }
        .listRowBackground(Theme.surface)
    }

    /// "30000" → "30,000" (숫자만 남김, 최대 11자리)
    static func format(_ raw: String) -> String {
        let digits = String(raw.filter(\.isNumber).prefix(11))
        guard let value = Int(digits) else { return "" }
        return wonFormatter.string(from: NSNumber(value: value)) ?? digits
    }

    /// "30,000" → 30000, 빈 칸은 nil
    static func parse(_ text: String) -> Int? {
        Int(text.filter(\.isNumber))
    }

    /// 기존 값 → 입력 칸 글자
    static func text(for amount: Int?) -> String {
        amount.map { format(String($0)) } ?? ""
    }

    /// 화면 표시용 "₩30,000"
    static func won(_ amount: Int) -> String {
        "₩\(wonFormatter.string(from: NSNumber(value: amount)) ?? "\(amount)")"
    }

    private static let wonFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter
    }()
}
