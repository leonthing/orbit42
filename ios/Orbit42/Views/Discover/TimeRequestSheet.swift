import SwiftUI

/// 시간 요청 시트 — 열린 슬롯이 없어도 상대에게 시간을 요청한다.
/// 메시지(필수) + 시간 + 예산(선택) + 희망 시간대(선택) → POST /users/{username}/time-request
struct TimeRequestSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: TimeRequestViewModel
    @State private var didSubmit = false

    private let displayName: String

    init(username: String, displayName: String) {
        _viewModel = State(initialValue: TimeRequestViewModel(username: username))
        self.displayName = displayName
    }

    var body: some View {
        NavigationStack {
            Group {
                if didSubmit {
                    sentView
                } else {
                    form
                }
            }
            .background(Theme.background)
            .navigationTitle("시간 요청")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(didSubmit ? "닫기" : "취소") { dismiss() }
                        .disabled(viewModel.isSubmitting)
                }
                if !didSubmit {
                    ToolbarItem(placement: .confirmationAction) {
                        if viewModel.isSubmitting {
                            ProgressView()
                                .tint(Theme.accent)
                        } else {
                            Button("보내기") { submit() }
                                .fontWeight(.semibold)
                                .disabled(!viewModel.canSubmit)
                        }
                    }
                }
            }
            .interactiveDismissDisabled(viewModel.isSubmitting)
        }
    }

    // MARK: - 입력 폼

    private var form: some View {
        Form {
            Section {
                TextEditor(text: $viewModel.message)
                    .foregroundStyle(Theme.primaryText)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 100)
                    .overlay(alignment: .topLeading) {
                        if viewModel.message.isEmpty {
                            Text("어떤 시간이 필요한지 알려주세요")
                                .foregroundStyle(Theme.secondaryText)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                                .allowsHitTesting(false)
                        }
                    }
            } header: {
                Text("\(displayName)님에게 보낼 메시지")
                    .foregroundStyle(Theme.secondaryText)
                    .textCase(nil)
            }
            .listRowBackground(Theme.surface)

            Section {
                Picker("필요한 시간", selection: $viewModel.durationMin) {
                    ForEach(TimeRequestViewModel.durationChoices, id: \.self) { minutes in
                        Text("\(minutes)분").tag(minutes)
                    }
                }
                .tint(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)

            Section {
                HStack {
                    Text("예산")
                        .foregroundStyle(Theme.primaryText)
                    Spacer()
                    TextField("금액 (선택)", text: $viewModel.budgetText)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .foregroundStyle(Theme.primaryText)
                        .frame(maxWidth: 140)
                    Text("원")
                        .foregroundStyle(Theme.secondaryText)
                }
                TextField("희망 시간대 (선택, 예: 평일 저녁)", text: $viewModel.preferredTimes)
                    .foregroundStyle(Theme.primaryText)
            }
            .listRowBackground(Theme.surface)

            if let errorMessage = viewModel.errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
                .listRowBackground(Theme.surface)
            }
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - 전송 완료

    private var sentView: some View {
        VStack(spacing: 16) {
            Image(systemName: "paperplane.circle.fill")
                .font(.system(size: 56, weight: .light))
                .foregroundStyle(Theme.accent)
            Text("요청을 보냈어요")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
            Text("\(displayName)님이 확인하면 알려드릴게요")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)

            Button {
                dismiss()
            } label: {
                Text("닫기")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 40)
                    .padding(.vertical, 12)
                    .background(Theme.accent, in: Capsule())
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func submit() {
        viewModel.errorMessage = nil
        Task {
            if await viewModel.submit() {
                didSubmit = true
            }
        }
    }
}

#Preview {
    TimeRequestSheet(username: "leo", displayName: "Leo")
        .tint(Theme.accent)
}
