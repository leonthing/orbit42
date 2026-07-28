import SwiftUI

/// 주간 목표 설정 — 수입(₩/주)·투자 시간(시간/주).
/// 비워두면 그 목표는 해제된다.
struct WeeklyGoalsSheet: View {
    let viewModel: AssetViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var earnText = ""
    @State private var investText = ""
    @State private var didPrefill = false
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Form {
                    Section {
                        HStack {
                            TextField("예: 500,000", text: $earnText)
                                .keyboardType(.numberPad)
                                .foregroundStyle(Theme.primaryText)
                                .multilineTextAlignment(.trailing)
                                .onChange(of: earnText) { _, newValue in
                                    earnText = Self.formatInput(newValue)
                                }
                            Text("원/주")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    } header: {
                        Text("주간 수입 목표")
                    } footer: {
                        Text("수입 일정(자동 계산)과 직접 기록한 수익이 진행률에 잡혀요.")
                    }
                    .listRowBackground(Theme.surface)

                    Section {
                        HStack {
                            TextField("예: 5", text: $investText)
                                .keyboardType(.decimalPad)
                                .foregroundStyle(Theme.primaryText)
                                .multilineTextAlignment(.trailing)
                            Text("시간/주")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    } header: {
                        Text("주간 투자 시간 목표")
                    } footer: {
                        Text("학습·건강 등 투자로 분류된 시간이 진행률에 잡혀요. 비워두면 목표가 해제돼요.")
                    }
                    .listRowBackground(Theme.surface)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("주간 목표")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView().tint(Theme.accent)
                    } else {
                        Button("저장") { save() }
                            .fontWeight(.semibold)
                    }
                }
            }
            .onAppear { prefill() }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func prefill() {
        guard !didPrefill else { return }
        didPrefill = true
        if let goals = viewModel.summary?.goals {
            if let earn = goals.earnKrw { earnText = AssetFormat.grouped(earn) }
            if let invest = goals.investHours {
                investText = invest == invest.rounded()
                    ? String(Int(invest))
                    : String(invest)
            }
        }
    }

    private var earnValue: Int? {
        let digits = earnText.filter(\.isNumber)
        guard let value = Int(digits), value > 0 else { return nil }
        return value
    }

    private var investValue: Double? {
        guard let value = Double(investText.trimmingCharacters(in: .whitespaces)),
              value > 0
        else { return nil }
        return value
    }

    private func save() {
        isSaving = true
        Task {
            defer { isSaving = false }
            if await viewModel.saveWeeklyGoals(earnKrw: earnValue, investHours: investValue) {
                dismiss()
            }
        }
    }

    private static func formatInput(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        guard let value = Int(digits.prefix(12)), value > 0 else { return "" }
        return AssetFormat.grouped(value)
    }
}
