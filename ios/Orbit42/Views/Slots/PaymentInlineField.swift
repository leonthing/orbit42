import SwiftUI

/// 유료 예약 링크의 가격 칸 바로 아래 결제 안내 (개선-38).
/// 결제 안내는 계정 하나에 하나(설정 > 결제 안내와 같은 값) — 비어 있으면 유료 예약도 입금 확인 없이 바로 확정된다(서버 동작 그대로).
struct PaymentInlineField: View {
    @Binding var text: String

    var body: some View {
        TextField("결제 안내 — 예: 은행 000-000-000000 예금주 / 송금 링크", text: $text, axis: .vertical)
            .lineLimit(1...3)
            .font(.subheadline)
            .accessibilityIdentifier("paymentInline")
    }
}

/// 결제 안내가 비어 있을 때 한 번 묻는 문구
enum PaymentConfirmCopy {
    static let title = "입금 확인 없이 바로 확정돼요"
    static let message = "결제 안내가 비어 있으면 유료 예약도 돈을 받기 전에 바로 확정돼요. 계좌나 송금 링크를 적어 두면 입금을 확인한 뒤 확정할 수 있어요."
    static let footer = "적어 두면 예약한 분께 안내가 가고, 입금을 확인한 뒤 확정돼요. 모든 유료 예약 링크에 같이 쓰여요."
}

private struct PaymentInstructionsUpdate: Encodable {
    let paymentInstructions: String?
    private enum CodingKeys: String, CodingKey { case paymentInstructions }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(paymentInstructions, forKey: .paymentInstructions)
    }
}

@MainActor
enum PaymentInstructionsSaver {
    /// 바뀌었을 때만 계정의 결제 안내를 저장한다
    static func saveIfChanged(_ text: String, auth: AuthViewModel) async throws {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let current = (auth.user?.paymentInstructions ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed != current else { return }
        let response: MeResponse = try await APIClient.shared.patch(
            "/api/v1/me",
            body: PaymentInstructionsUpdate(paymentInstructions: trimmed.isEmpty ? nil : trimmed)
        )
        auth.updateUser(response.user)
    }
}
