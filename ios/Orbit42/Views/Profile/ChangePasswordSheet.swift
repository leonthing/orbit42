import SwiftUI

/// 비밀번호 변경 시트 — `POST /api/v1/me/password`.
/// 새 비밀번호 6자 이상 + 확인 일치는 클라이언트에서 먼저 검증한다.
struct ChangePasswordSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingSuccess = false

    private static let minLength = 6

    private var canSubmit: Bool {
        !currentPassword.isEmpty && !newPassword.isEmpty && !confirmPassword.isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("현재 비밀번호") {
                    SecureField("현재 비밀번호", text: $currentPassword)
                        .foregroundStyle(Theme.primaryText)
                        .textContentType(.password)
                }
                .listRowBackground(Theme.surface)

                Section {
                    SecureField("새 비밀번호 (6자 이상)", text: $newPassword)
                        .foregroundStyle(Theme.primaryText)
                        .textContentType(.newPassword)
                    SecureField("새 비밀번호 확인", text: $confirmPassword)
                        .foregroundStyle(Theme.primaryText)
                        .textContentType(.newPassword)
                } header: {
                    Text("새 비밀번호")
                } footer: {
                    if !confirmPassword.isEmpty, newPassword != confirmPassword {
                        Text("새 비밀번호가 서로 달라요.")
                            .foregroundStyle(.red)
                    }
                }
                .listRowBackground(Theme.surface)

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("비밀번호 변경")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Button("변경") { submit() }
                            .fontWeight(.semibold)
                            .disabled(!canSubmit)
                    }
                }
            }
            .alert("변경했어요", isPresented: $showingSuccess) {
                Button("확인") { dismiss() }
            } message: {
                Text("다음 로그인부터 새 비밀번호를 사용해 주세요.")
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func submit() {
        errorMessage = nil

        guard newPassword.count >= Self.minLength else {
            errorMessage = "새 비밀번호는 \(Self.minLength)자 이상이어야 해요."
            return
        }
        guard newPassword == confirmPassword else {
            errorMessage = "새 비밀번호가 서로 달라요. 다시 확인해 주세요."
            return
        }

        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let _: AckResponse = try await APIClient.shared.post(
                    "/api/v1/me/password",
                    body: ChangePasswordRequest(
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    )
                )
                showingSuccess = true
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "비밀번호를 변경하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    ChangePasswordSheet()
        .tint(Theme.accent)
}
