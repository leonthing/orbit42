import SwiftUI

/// 급여 기준 입력 시트 — 월급/시급 세그먼트 + 금액.
/// 저장하면 서버가 시급을 환산해 자산 탭 전체가 갱신된다.
struct IncomeSettingsSheet: View {
    let viewModel: AssetViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var incomeType: String = "monthly"
    @State private var amountText: String = ""
    @FocusState private var amountFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Form {
                    Section {
                        Picker("급여 유형", selection: $incomeType) {
                            Text("월급").tag("monthly")
                            Text("시급").tag("hourly")
                        }
                        .pickerStyle(.segmented)

                        HStack {
                            TextField(
                                incomeType == "monthly" ? "예: 3,500,000" : "예: 15,000",
                                text: $amountText
                            )
                            .keyboardType(.numberPad)
                            .focused($amountFocused)
                            .onChange(of: amountText) { _, newValue in
                                amountText = formatInput(newValue)
                            }
                            Text("원")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    } header: {
                        Text("내 급여 기준")
                    } footer: {
                        Text("월급은 월 209시간(주휴 포함 근로기준) 기준으로 환산해요. 대략적인 값이어도 충분해요. 이 정보는 나에게만 보여요.")
                    }
                    .listRowBackground(Theme.surface)

                    if let hourly = previewHourly {
                        Section {
                            HStack {
                                Text("내 1시간")
                                    .foregroundStyle(Theme.secondaryText)
                                Spacer()
                                Text(AssetFormat.won(hourly))
                                    .font(.headline)
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.accent)
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("급여 기준")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.isSaving {
                        ProgressView().tint(Theme.accent)
                    } else {
                        Button("저장") {
                            Task {
                                if await viewModel.saveSettings(
                                    incomeType: incomeType,
                                    amount: amountValue
                                ) {
                                    dismiss()
                                }
                            }
                        }
                        .fontWeight(.semibold)
                        .disabled(amountValue <= 0)
                    }
                }
            }
            .onAppear {
                if let settings = viewModel.settings {
                    incomeType = settings.incomeType ?? "monthly"
                    if let amount = settings.amount {
                        amountText = AssetFormat.grouped(amount)
                    }
                }
                amountFocused = true
            }
        }
        .preferredColorScheme(.dark)
    }

    private var amountValue: Int {
        Int(amountText.replacingOccurrences(of: ",", with: "")) ?? 0
    }

    /// 입력 중 즉석 환산 미리보기.
    private var previewHourly: Int? {
        guard amountValue > 0 else { return nil }
        return incomeType == "hourly" ? amountValue : amountValue / 209
    }

    /// 숫자만 남기고 천 단위 콤마를 다시 찍는다.
    private func formatInput(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        guard let value = Int(digits.prefix(12)) else { return "" }
        return value > 0 ? AssetFormat.grouped(value) : ""
    }
}
