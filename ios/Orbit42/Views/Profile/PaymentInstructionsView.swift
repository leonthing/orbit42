import SwiftUI

private struct UpdatePaymentInstructionsRequest: Encodable {
    let paymentInstructions: String?

    private enum CodingKeys: String, CodingKey { case paymentInstructions }

    /// 비울 때도 키를 보내야 서버가 지운다 (기본 합성은 nil 이면 키를 빼 버린다).
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(paymentInstructions, forKey: .paymentInstructions)
    }
}

/// 설정 > 결제 안내 (계좌이체).
/// PG 없이도 유료 세션을 받을 수 있게: 여기 적은 안내가 게스트 완료 화면·메일에 나가고,
/// 유료 슬롯 예약은 '입금 대기'로 들어와 호스트가 입금을 확인하면 확정된다.
struct PaymentInstructionsView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    @State private var text = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var saved = false
    @FocusState private var focused: Bool

    var body: some View {
        Form {
            Section {
                TextField(
                    "국민은행 123-456-789012 홍길동\n또는 토스 송금 링크",
                    text: $text,
                    axis: .vertical
                )
                .lineLimit(3...8)
                .focused($focused)
            } header: {
                Text("입금 안내")
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("유료 슬롯 예약은 '입금 대기'로 들어오고, 게스트에게 이 안내와 금액이 보여요.")
                    Text("입금을 확인하고 '입금 확인하고 확정'을 누르면 예약이 확정돼요.")
                    Text("24시간 안에 확인되지 않으면 예약은 자동으로 취소되고 시간이 다시 열려요.")
                    Text("비워 두면 지금처럼 '호스트 안내에 따라 결제'로 예약이 바로 들어와요.")
                }
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("결제 안내 (계좌이체)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(isSaving ? "저장 중…" : "저장") { save() }
                    .disabled(isSaving)
            }
        }
        .onAppear {
            text = auth.user?.paymentInstructions ?? ""
        }
        .alert("저장했어요", isPresented: $saved) {
            Button("확인") { dismiss() }
        }
    }

    private func save() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        isSaving = true
        errorMessage = nil
        focused = false
        Task {
            defer { isSaving = false }
            do {
                let response: MeResponse = try await APIClient.shared.patch(
                    "/api/v1/me",
                    body: UpdatePaymentInstructionsRequest(paymentInstructions: trimmed.isEmpty ? nil : trimmed)
                )
                auth.updateUser(response.user)
                saved = true
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "저장하지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }
}
