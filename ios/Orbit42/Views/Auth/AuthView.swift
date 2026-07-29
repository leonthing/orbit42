import AuthenticationServices
import SwiftUI

/// 로그인 / 가입 화면.
/// Sign in with Apple + 이메일(아이디) 로그인/가입 폼.
/// 표시 이름·프로필 등은 가입 직후 온보딩 위저드에서 받는다.
struct AuthView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case login = "로그인"
        case signup = "가입하기"
        var id: String { rawValue }
    }

    @Environment(AuthViewModel.self) private var auth
    @Environment(\.colorScheme) private var colorScheme

    @State private var mode: Mode

    init(initialMode: Mode = .login) {
        _mode = State(initialValue: initialMode)
    }

    // 로그인 폼
    @State private var identifier = ""
    @State private var loginPassword = ""

    // 가입 폼
    @State private var username = ""
    @State private var email = ""
    @State private var signupPassword = ""

    @State private var errorMessage: String?
    @State private var isSubmitting = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 24) {
                    header

                    Picker("모드", selection: $mode) {
                        ForEach(Mode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)

                    Group {
                        switch mode {
                        case .login: loginForm
                        case .signup: signupForm
                        }
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                    }

                    submitButton
                    divider
                    appleButton
                    googleButton
                    consentNotice
                }
                .padding(24)
                .frame(maxWidth: 440)
            }
            .readableWidth()
            .scrollDismissesKeyboard(.interactively)
        }
        .onChange(of: mode) {
            errorMessage = nil
        }
    }

    // MARK: - 헤더

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "circle.dotted.circle")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Theme.accent)
            Text("orbit42")
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(Theme.primaryText)
            Text("시간을 자산으로 만드는 캘린더")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.top, 32)
    }

    // MARK: - 폼

    private var loginForm: some View {
        VStack(spacing: 12) {
            field("아이디 또는 이메일", text: $identifier)
                .textContentType(.username)
                .keyboardType(.emailAddress)
            secureField("비밀번호", text: $loginPassword)
                .textContentType(.password)
        }
    }

    private var signupForm: some View {
        VStack(spacing: 12) {
            field("아이디 (소문자·숫자·하이픈)", text: $username)
                .textContentType(.username)
            field("이메일", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
            secureField("비밀번호 (6자 이상)", text: $signupPassword)
                .textContentType(.newPassword)
        }
    }

    private func field(
        _ title: String,
        text: Binding<String>,
        autocapitalization: TextInputAutocapitalization = .never
    ) -> some View {
        TextField(title, text: text)
            .textInputAutocapitalization(autocapitalization)
            .autocorrectionDisabled()
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(Theme.primaryText)
    }

    private func secureField(_ title: String, text: Binding<String>) -> some View {
        SecureField(title, text: text)
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(Theme.primaryText)
    }

    // MARK: - 제출

    private var canSubmit: Bool {
        switch mode {
        case .login:
            return !identifier.isEmpty && !loginPassword.isEmpty
        case .signup:
            return !username.isEmpty && !email.isEmpty && !signupPassword.isEmpty
        }
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            Group {
                if isSubmitting {
                    ProgressView().tint(.white)
                } else {
                    Text(mode == .login ? "로그인" : "가입하기")
                        .font(.headline)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
        }
        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12))
        .foregroundStyle(.white)
        .disabled(!canSubmit || isSubmitting)
        .opacity(canSubmit ? 1 : 0.5)
    }

    private func submit() {
        errorMessage = nil
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            do {
                switch mode {
                case .login:
                    try await auth.login(identifier: identifier, password: loginPassword)
                case .signup:
                    // 표시 이름은 가입 직후 온보딩 위저드의 프로필 단계에서 받는다.
                    try await auth.signup(
                        username: username,
                        password: signupPassword,
                        email: email,
                        displayName: nil
                    )
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    /// 가입·로그인 공통 동의 안내 — 링크는 웹의 약관/방침 페이지로 연다.
    private var consentNotice: some View {
        Text("계속하면 orbit42의 [이용약관](https://orbit42.org/terms)과 [개인정보처리방침](https://orbit42.org/privacy)에 동의하게 돼요.")
            .font(.caption)
            .foregroundStyle(Theme.secondaryText)
            .tint(Theme.accent)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }

    // MARK: - Sign in with Apple

    private var divider: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Theme.fill(0.15)).frame(height: 1)
            Text("또는")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            Rectangle().fill(Theme.fill(0.15)).frame(height: 1)
        }
    }

    private var appleButton: some View {
        SignInWithAppleButton(.signIn) { request in
            // .email 필수 — 없으면 identity token에 이메일이 안 와서
            // 기존 계정과 연결할 수 없다 (서버는 이메일로 계정을 찾거나 만든다).
            request.requestedScopes = [.fullName, .email]
        } onCompletion: { result in
            handleAppleResult(result)
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        .frame(height: 50)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var googleButton: some View {
        Button {
            errorMessage = nil
            isSubmitting = true
            Task {
                defer { isSubmitting = false }
                do {
                    try await auth.signInWithGoogle()
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        } label: {
            HStack(spacing: 10) {
                Image("GoogleLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 20, height: 20)
                Text("Google로 계속하기")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(.black)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Theme.fill(0.15), lineWidth: 1)
            )
        }
        .disabled(isSubmitting)
    }

    private func handleAppleResult(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard
                let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = credential.identityToken,
                let identityToken = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = "Apple 로그인 정보를 읽지 못했어요. 다시 시도해 주세요."
                return
            }

            // fullName 은 최초 인증 시에만 내려온다.
            var fullName: String?
            if let components = credential.fullName {
                let formatted = PersonNameComponentsFormatter().string(from: components)
                    .trimmingCharacters(in: .whitespaces)
                if !formatted.isEmpty { fullName = formatted }
            }

            errorMessage = nil
            isSubmitting = true
            Task {
                defer { isSubmitting = false }
                do {
                    try await auth.signInWithApple(identityToken: identityToken, displayName: fullName)
                } catch {
                    errorMessage = error.localizedDescription
                }
            }

        case .failure(let error):
            // 사용자가 취소한 경우는 에러로 표시하지 않는다.
            if let authError = error as? ASAuthorizationError, authError.code == .canceled {
                return
            }
            errorMessage = "Apple 로그인에 실패했어요. 다시 시도해 주세요."
        }
    }
}

#Preview {
    AuthView()
        .environment(AuthViewModel())
        .tint(Theme.accent)
}
