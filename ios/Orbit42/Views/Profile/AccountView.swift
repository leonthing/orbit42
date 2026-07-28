import AuthenticationServices
import SwiftUI

/// 계정 관리 — 비밀번호 변경 시트 + Apple 계정 연결 + 계정 삭제(2단계 확인).
/// 삭제: confirmationDialog → "삭제" 입력 alert → `DELETE /api/v1/me/account` → 로그아웃.
struct AccountView: View {
    @Environment(AuthViewModel.self) private var auth

    @State private var showingChangePassword = false
    @State private var showingDeleteDialog = false
    @State private var showingDeleteConfirmAlert = false
    @State private var deleteConfirmText = ""
    @State private var isDeleting = false
    @State private var errorMessage: String?
    @State private var isLinkingApple = false
    @State private var appleLinkMessage: String?
    private let appleLinker = AppleLinkCoordinator()

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
                            .foregroundStyle(Theme.primaryText)
                    }
                }
            }
            .listRowBackground(Theme.surface)

            // Apple 계정 연결 — Apple이 이메일을 안 주는 재인증 상태여도
            // 로그인된 세션에 sub 를 연결하면 이후 Apple 로그인이 동작한다.
            Section {
                if auth.user?.appleLinked == true {
                    HStack(spacing: 12) {
                        Image(systemName: "applelogo")
                            .font(.body)
                            .foregroundStyle(Theme.primaryText)
                            .frame(width: 26)
                        Text("Apple 계정 연결됨")
                            .foregroundStyle(Theme.primaryText)
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color(red: 0x22 / 255, green: 0xC5 / 255, blue: 0x5E / 255))
                    }
                } else {
                    Button {
                        linkApple()
                    } label: {
                        HStack(spacing: 12) {
                            if isLinkingApple {
                                ProgressView().frame(width: 26)
                            } else {
                                Image(systemName: "applelogo")
                                    .font(.body)
                                    .foregroundStyle(Theme.primaryText)
                                    .frame(width: 26)
                            }
                            Text("Apple 계정 연결")
                                .foregroundStyle(Theme.primaryText)
                        }
                    }
                    .disabled(isLinkingApple)
                }
            } footer: {
                Text("연결하면 다음부터 Apple로 바로 로그인할 수 있어요.")
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
        .alert(
            "안내",
            isPresented: Binding(
                get: { appleLinkMessage != nil },
                set: { if !$0 { appleLinkMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(appleLinkMessage ?? "")
        }
    }

    // MARK: - Apple 계정 연결

    private func linkApple() {
        isLinkingApple = true
        appleLinker.authorize { result in
            Task { @MainActor in
                defer { isLinkingApple = false }
                switch result {
                case .success(let identityToken):
                    do {
                        struct LinkAppleRequest: Encodable { let identityToken: String }
                        let _: AckResponse = try await APIClient.shared.post(
                            "/api/v1/me/link-apple",
                            body: LinkAppleRequest(identityToken: identityToken)
                        )
                        // appleLinked 갱신을 위해 프로필 재조회
                        let me: MeResponse = try await APIClient.shared.get("/api/v1/me")
                        auth.updateUser(me.user)
                        appleLinkMessage = "Apple 계정이 연결됐어요. 다음부터 Apple로 로그인할 수 있어요."
                    } catch let apiError as APIError {
                        appleLinkMessage = apiError.errorDescription
                    } catch {
                        appleLinkMessage = "연결하지 못했어요. 네트워크를 확인해 주세요."
                    }
                case .canceled:
                    break
                case .failure:
                    appleLinkMessage = "Apple 인증에 실패했어요. 다시 시도해 주세요."
                }
            }
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

/// Apple 인증을 직접 실행해 identity token 을 돌려주는 코디네이터.
/// (SignInWithAppleButton 은 Form 행에 맞지 않아 직접 컨트롤러를 돈다)
final class AppleLinkCoordinator: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {

    enum LinkResult {
        case success(identityToken: String)
        case canceled
        case failure
    }

    private var completion: ((LinkResult) -> Void)?

    func authorize(completion: @escaping (LinkResult) -> Void) {
        self.completion = completion
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let tokenData = credential.identityToken,
            let token = String(data: tokenData, encoding: .utf8)
        else {
            completion?(.failure)
            return
        }
        completion?(.success(identityToken: token))
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            completion?(.canceled)
        } else {
            completion?(.failure)
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}

#Preview {
    NavigationStack {
        AccountView()
    }
    .environment(AuthViewModel())
    .tint(Theme.accent)
}
