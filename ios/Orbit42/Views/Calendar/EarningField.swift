import SwiftUI

/// 일정 추가·수정의 '금액' 한 줄 — 이 일정으로 번 돈(원). 비우면 기록 없음.
/// 숫자 키패드, 입력하는 동안 천 단위 쉼표. 저장은 PUT /api/v1/time-asset/event-earning.
/// 금액은 본인 캘린더에만 보인다(서버가 본인 일정에만 earningKrw 를 내려 준다).
struct EarningField: View {
    /// 숫자만 든 글자("50000"). 쉼표는 화면에만 붙인다 — 입력 중에 글자를 바꿔 쓰면
    /// 빠른 입력에서 숫자가 빠졌다(1.8.0 써보기 메모 1).
    @Binding var text: String

    var body: some View {
        Section {
            HStack(spacing: 8) {
                Text("금액")
                    .foregroundStyle(Theme.primaryText)
                Spacer(minLength: 8)
                AmountTextField(digits: $text, placeholder: "없음")
                    .accessibilityIdentifier("earningField")
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

    /// 화면 글자("50,000") ↔ 상태(숫자만 "50000"). 상태를 다시 쓰는 onChange 가 없어
    /// 키 입력 사이에 글자가 덮이지 않는다. 붙여넣은 "50,000원"은 50000.
    static func displayBinding(_ digits: Binding<String>) -> Binding<String> {
        Binding(
            get: { format(digits.wrappedValue) },
            set: { digits.wrappedValue = digitsOnly($0) }
        )
    }

    /// 숫자만 남김(최대 11자리, 앞의 0 제거)
    static func digitsOnly(_ raw: String) -> String {
        let digits = String(raw.filter { $0.isASCII && $0.isNumber }.prefix(11))
        return Int(digits).map(String.init) ?? ""
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

    /// 기존 값 → 입력 칸 상태(숫자만)
    static func text(for amount: Int?) -> String {
        amount.map(String.init) ?? ""
    }

    /// 화면 표시용 "₩30,000"
    static func won(_ amount: Int) -> String {
        "₩\(wonFormatter.string(from: NSNumber(value: amount)) ?? "\(amount)")"
    }

    static let wonFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter
    }()
}

/// 숫자 키패드 금액 칸(UIKit) — 키 하나·붙여넣기마다 델리게이트에서 바로 숫자만 골라
/// 상태(digits)에 넣고 쉼표 붙인 글자를 같은 자리에서 그린다. 비동기 재포맷이 없어
/// 아무리 빨리 쳐도 숫자가 빠지지 않는다 (1.8.0 써보기 메모 1).
struct AmountTextField: UIViewRepresentable {
    @Binding var digits: String
    var placeholder: String

    func makeUIView(context: Context) -> UITextField {
        let field = UITextField()
        field.keyboardType = .numberPad
        field.textAlignment = .right
        field.placeholder = placeholder
        field.textColor = UIColor(Theme.primaryText)
        field.font = .preferredFont(forTextStyle: .body)
        field.adjustsFontForContentSizeCategory = true
        field.delegate = context.coordinator
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.text = EarningField.format(digits)
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        context.coordinator.parent = self
        let shown = EarningField.format(digits)
        if field.text != shown { field.text = shown }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextFieldDelegate {
        var parent: AmountTextField
        init(parent: AmountTextField) { self.parent = parent }

        func textField(_ field: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
            let current = field.text ?? ""
            guard let r = Range(range, in: current) else { return false }
            var proposed = current.replacingCharacters(in: r, with: string)
            // 쉼표 하나만 지우려는 백스페이스는 그 앞 숫자를 지운다
            if string.isEmpty, range.length == 1, current[r] == ",", r.lowerBound > current.startIndex {
                let before = current.index(before: r.lowerBound)
                proposed = current.replacingCharacters(in: before..<r.upperBound, with: "")
            }
            let digits = EarningField.digitsOnly(proposed)
            field.text = EarningField.format(digits)
            // 커서는 끝으로 (금액은 보통 뒤에서 치고 지운다)
            let end = field.endOfDocument
            field.selectedTextRange = field.textRange(from: end, to: end)
            field.sendActions(for: .editingChanged)
            if parent.digits != digits { parent.digits = digits }
            return false
        }
    }
}
