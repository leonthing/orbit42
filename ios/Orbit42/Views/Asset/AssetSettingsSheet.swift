import SwiftUI

/// 자산 설정 — 시간 자산 계산의 기준을 한곳에서 관리한다.
/// 급여(월급/시급), 근로시간, 수면. 앞으로 시간 자산 관련 설정이 여기에 모인다.
/// 수면만 바뀌었으면 수면만, 급여가 바뀌었으면 급여와 함께 전송한다.
struct AssetSettingsSheet: View {
    let viewModel: AssetViewModel

    @Environment(\.dismiss) private var dismiss
    @State private var incomeType: String = "monthly"
    @State private var amountText: String = ""
    @State private var sleepHours: Double = 7.0
    @FocusState private var amountFocused: Bool

    /// onAppear 시점 값 — 무엇이 바뀌었는지 판단용
    @State private var initialIncomeType: String = "monthly"
    @State private var initialAmount: Int = 0
    @State private var initialSleepHours: Double = 7.0

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

                    Section {
                        NavigationLink {
                            WorkHoursView()
                        } label: {
                            HStack {
                                Text("근로시간")
                                Spacer()
                                Text("요일별 설정")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                    } footer: {
                        Text("가동률 계산과 자동 슬롯의 기본값에 쓰여요.")
                    }
                    .listRowBackground(Theme.surface)

                    Section {
                        Stepper(value: $sleepHours, in: 4...12, step: 0.5) {
                            HStack {
                                Text("하루 수면")
                                Spacer()
                                Text("\(AssetFormat.hours(sleepHours))시간/일")
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                    } header: {
                        Text("수면")
                    } footer: {
                        Text("수면 시간은 미기록 시간에서 따로 보여드려요.")
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
            .navigationTitle("자산 설정")
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
                                if await save() {
                                    dismiss()
                                }
                            }
                        }
                        .fontWeight(.semibold)
                        .disabled(amountValue <= 0 && !sleepChanged)
                    }
                }
            }
            .onAppear {
                if let settings = viewModel.settings {
                    incomeType = settings.incomeType ?? "monthly"
                    if let amount = settings.amount {
                        amountText = AssetFormat.grouped(amount)
                    }
                    if let sleep = settings.sleepHoursPerDay {
                        sleepHours = sleep
                    }
                }
                initialIncomeType = incomeType
                initialAmount = amountValue
                initialSleepHours = sleepHours
                amountFocused = true
            }
        }
        .preferredColorScheme(.dark)
    }

    private var amountValue: Int {
        Int(amountText.replacingOccurrences(of: ",", with: "")) ?? 0
    }

    private var incomeChanged: Bool {
        incomeType != initialIncomeType || amountValue != initialAmount
    }

    private var sleepChanged: Bool {
        sleepHours != initialSleepHours
    }

    /// 수면만 바뀌었으면 수면만, 그 외에는 급여를(바뀐 수면과 함께) 전송한다.
    private func save() async -> Bool {
        if sleepChanged && !incomeChanged, initialAmount > 0 {
            return await viewModel.saveSleepHours(sleepHours)
        }
        if amountValue > 0 {
            return await viewModel.saveSettings(
                incomeType: incomeType,
                amount: amountValue,
                sleepHoursPerDay: sleepChanged ? sleepHours : nil
            )
        }
        // 급여 미입력 상태에서 수면만 조정한 경우
        return await viewModel.saveSleepHours(sleepHours)
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
