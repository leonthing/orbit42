import SwiftUI

/// 프로필 편집 시트 — 이름 + 소개(500자).
/// 저장: `PATCH /api/v1/me` → 응답 user 로 AuthViewModel 갱신.
struct EditProfileSheet: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    let user: User

    @State private var displayName: String
    @State private var bio: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    private static let bioLimit = 500

    init(user: User) {
        self.user = user
        _displayName = State(initialValue: user.displayName ?? "")
        _bio = State(initialValue: user.bio ?? "")
    }

    private var canSave: Bool {
        !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("이름") {
                    TextField("이름", text: $displayName)
                        .foregroundStyle(.white)
                }
                .listRowBackground(Theme.surface)

                Section {
                    TextEditor(text: $bio)
                        .frame(minHeight: 120)
                        .foregroundStyle(.white)
                        .scrollContentBackground(.hidden)
                } header: {
                    Text("소개")
                } footer: {
                    Text("\(bio.count)/\(Self.bioLimit)")
                        .frame(maxWidth: .infinity, alignment: .trailing)
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
            .navigationTitle("프로필 편집")
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
                        Button("저장") { save() }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .onChange(of: bio) { _, newValue in
                if newValue.count > Self.bioLimit {
                    bio = String(newValue.prefix(Self.bioLimit))
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    private func save() {
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let response: MeResponse = try await APIClient.shared.patch(
                    "/api/v1/me",
                    body: UpdateProfileRequest(
                        displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                        bio: bio.trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                )
                auth.updateUser(response.user)
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    EditProfileSheet(
        user: User(
            username: "leo",
            displayName: "Leo Kim",
            email: "leo@example.com",
            avatarUrl: nil,
            emailVerified: true,
            bio: "시간을 파는 사람"
        )
    )
    .environment(AuthViewModel())
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
