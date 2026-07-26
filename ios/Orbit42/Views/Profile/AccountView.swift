import SwiftUI

/// 계정 관리 — 비밀번호 변경 시트 + 계정 삭제(2단계 확인).
/// 삭제: confirmationDialog → "삭제" 입력 alert → `DELETE /api/v1/me/account` → 로그아웃.
struct AccountView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var showingChangePassword = false
    @State private var showingDeleteDialog = false
    @State private var showingDeleteConfirmAlert = false
    @State private var deleteConfirmText = ""
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                Button {
                    showingChangePassword = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "key")
                            .font(.body)
                            .foregroundStyle(Theme.accent)
                            .frame(width: 26)
                        Text("비밀번호 변경")
                            .foregroundStyle(.white)
                    }
                }
            }
            .listRowBackground(Theme.surface)

            Section {
                Button(role: .destructive) {
                    showingDeleteDialog = true
                } label: {
                    HStack(spacing: 12) {
                        if isDeleting {
                            ProgressView()
                                .frame(width: 26)
                        } else {
                            Image(systemName: "trash")
                                .font(.body)
                                .frame(width: 26)
                        }
                        Text("계정 삭제")
                    }
                }
                .disabled(isDeleting)
            } footer: {
                Text("모든 슬롯·예약·글이 영구 삭제되며 되돌릴 수 없어요.")
                    .foregroundStyle(Theme.secondaryText)
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
        .navigationTitle("계정")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingChangePassword) {
            ChangePasswordSheet()
        }
        .confirmationDialog(
            "정말 계정을 삭제할까요?",
            isPresented: $showingDeleteDialog,
            titleVisibility: .visible
        ) {
            Button("계속", role: .destructive) {
                deleteConfirmText = ""
                showingDeleteConfirmAlert = true
            }
            Button("취소", role: .cancel) {}
        } message: {
            Text("모든 슬롯·예약·글이 영구 삭제되며 되돌릴 수 없어요.")
        }
        .alert("계정 삭제", isPresented: $showingDeleteConfirmAlert) {
            TextField("삭제", text: $deleteConfirmText)
            Button("영구 삭제", role: .destructive) {
                deleteAccount()
            }
            .disabled(deleteConfirmText.trimmingCharacters(in: .whitespaces) != "삭제")
            Button("취소", role: .cancel) {}
        } message: {
            Text("계속하려면 \"삭제\" 를 입력해 주세요. 모든 슬롯·예약·글이 영구 삭제되며 되돌릴 수 없어요.")
        }
    }

    private func deleteAccount() {
        guard deleteConfirmText.trimmingCharacters(in: .whitespaces) == "삭제" else {
            errorMessage = "\"삭제\" 를 정확히 입력해야 계정을 삭제할 수 있어요."
            return
        }
        errorMessage = nil
        isDeleting = true
        Task {
            defer { isDeleting = false }
            do {
                let _: AckResponse = try await APIClient.shared.delete("/api/v1/me/account")
                auth.logout()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    NavigationStack {
        AccountView()
    }
    .environment(AuthViewModel())
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
