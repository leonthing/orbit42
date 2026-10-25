import AuthenticationServices
import Foundation
import Observation

/// 로그인 상태 관리.
/// 앱 시작 시 Keychain 토큰으로 `/api/v1/me` 를 호출해 세션을 복원하고, 401 이면 로그아웃 처리한다.
@MainActor
@Observable
final class AuthViewModel {
    private(set) var user: User?
    /// 앱 시작 직후 세션 복원 중 여부 (스플래시 표시용)
    private(set) var isRestoring = true
    /// 방금 가입한 계정인지 — true 면 온보딩 위저드를 먼저 보여준다.
    /// 끝내기 전에 앱을 끄면 다음 실행 때 멈춘 단계부터 이어진다(계정별로 기기에 저장, 개선-23).
    private(set) var needsOnboarding = false
    /// 이어서 열 온보딩 단계 (OnboardingFlowView.Step rawValue)
    private(set) var onboardingStep: String?

    var isAuthenticated: Bool { user != nil }

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 세션 복원

    func restoreSession() async {
        defer { isRestoring = false }
        #if DEBUG
        // 개발 데모/UI 테스트용 세션 주입:
        // `-demoToken <token>` 런치 아규먼트 또는 DEMO_TOKEN 환경변수
        // (simctl launch 는 SIMCTL_CHILD_DEMO_TOKEN=... 으로 전달)
        let args = ProcessInfo.processInfo.arguments
        // UI 테스트: 로그아웃 상태로 시작 (둘러보기 확인용)
        if ProcessInfo.processInfo.environment["DEMO_LOGGED_OUT"] == "1" { KeychainStore.deleteToken() }
        // UI 테스트: '다음에 할 일' 카드 기기 값 초기화 (개선-35)
        if ProcessInfo.processInfo.environment["RESET_GETTING_STARTED"] == "1" {
            for key in UserDefaults.standard.dictionaryRepresentation().keys where key.hasPrefix("gettingStarted.") {
                UserDefaults.standard.removeObject(forKey: key)
            }
        }
        if let idx = args.firstIndex(of: "-demoToken"), idx + 1 < args.count {
            KeychainStore.saveToken(args[idx + 1])
        } else if let envToken = ProcessInfo.processInfo.environment["DEMO_TOKEN"],
                  !envToken.isEmpty {
            KeychainStore.saveToken(envToken)
        }
        #endif
        guard KeychainStore.loadToken() != nil else { return }
        KeychainStore.syncSharedCopy()
        do {
            let response: MeResponse = try await api.get("/api/v1/me")
            resumeOnboardingIfNeeded(for: response.user)
            #if DEBUG
            // UI 테스트용: Apple 가입처럼 '방금 가입한 계정'으로 온보딩을 연다 (이미 진행 중이면 그 단계부터)
            if ProcessInfo.processInfo.environment["DEMO_ONBOARDING"] == "1", !needsOnboarding {
                startOnboarding(for: response.user)
            }
            #endif
            user = response.user
        } catch APIError.unauthorized {
            logout()
        } catch {
            // 네트워크 등 일시적 오류: 토큰은 유지하고 로그인 화면으로.
        }
    }

    // MARK: - 인증

    func login(identifier: String, password: String) async throws {
        let response: AuthResponse = try await api.post(
            "/api/v1/auth/login",
            body: LoginRequest(identifier: identifier, password: password)
        )
        apply(response)
    }

    func signup(username: String, password: String, email: String, displayName: String?) async throws {
        let response: AuthResponse = try await api.post(
            "/api/v1/auth/signup",
            body: SignupRequest(username: username, password: password, email: email, displayName: displayName)
        )
        apply(response)
    }

    func signInWithApple(identityToken: String, displayName: String?) async throws {
        let response: AuthResponse = try await api.post(
            "/api/v1/auth/apple",
            body: AppleAuthRequest(identityToken: identityToken, displayName: displayName)
        )
        apply(response)
    }

    /// "Google로 계속하기" — 서버가 만든 OAuth URL 을 인앱 브라우저로 열고,
    /// 콜백(orbit42://signin?token=...)의 Bearer 토큰으로 세션을 연다.
    /// 사용자가 브라우저 시트를 닫으면 조용히 종료한다.
    func signInWithGoogle() async throws {
        struct GoogleURLResponse: Decodable { let url: String }
        let res: GoogleURLResponse = try await api.get("/api/v1/auth/google-url")
        guard let authURL = URL(string: res.url) else {
            throw APIError.invalidResponse
        }

        let callbackURL: URL
        do {
            callbackURL = try await webAuthenticate(url: authURL)
        } catch let authError as ASWebAuthenticationSessionError
            where authError.code == .canceledLogin {
            return
        }

        let queryItems = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false)?
            .queryItems
        guard callbackURL.host == "signin",
              let token = queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty
        else {
            throw APIError.server(
                message: "Google 로그인에 실패했어요. 다시 시도해 주세요.",
                statusCode: 400
            )
        }

        KeychainStore.saveToken(token)
        let response: MeResponse = try await api.get("/api/v1/me")
        if queryItems?.contains(where: { $0.name == "new" && $0.value == "1" }) == true {
            startOnboarding(for: response.user)
        } else {
            resumeOnboardingIfNeeded(for: response.user)
        }
        user = response.user
    }

    private let webAuthContext = WebAuthPresentationContext()
    private var webAuthSession: ASWebAuthenticationSession?

    private func webAuthenticate(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "orbit42"
            ) { callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? APIError.invalidResponse)
                }
            }
            session.presentationContextProvider = webAuthContext
            webAuthSession = session
            session.start()
        }
    }

    // MARK: - 가입 없이 둘러보기 (개선-47)

    /// 예시 사용자로 탭을 연다 — 토큰 없음, 서버 요청 없음(APIClient 가 예시 데이터로 답한다)
    func startBrowsing() {
        guard let demo = BrowseFixtures.user else { return }
        BrowseMode.shared.start()
        needsOnboarding = false
        onboardingStep = nil
        user = demo
    }

    /// 둘러보기에서 나감 — 예시 상태를 지우고 로그인 화면으로 (BrowseMode.leave 가 부른다)
    func stopBrowsing() {
        guard user?.username == BrowseFixtures.username else { return }
        user = nil
        needsOnboarding = false
        onboardingStep = nil
    }

    func logout() {
        if BrowseMode.shared.active { BrowseMode.shared.end(toSignup: nil) }
        KeychainStore.deleteToken()
        WidgetBridge.reload()
        user = nil
        needsOnboarding = false
        onboardingStep = nil
    }

    /// 온보딩 완료(또는 건너뛰기) — 메인 탭으로 진입한다.
    func finishOnboarding() {
        if let username = user?.username {
            UserDefaults.standard.removeObject(forKey: Self.onboardingKey(username))
        }
        needsOnboarding = false
        onboardingStep = nil
    }

    /// 온보딩 단계가 바뀔 때마다 기록 — 앱을 꺼도 여기부터 다시 연다.
    func saveOnboardingStep(_ step: String) {
        guard let username = user?.username else { return }
        onboardingStep = step
        UserDefaults.standard.set(step, forKey: Self.onboardingKey(username))
    }

    private static func onboardingKey(_ username: String) -> String { "onboarding.step.\(username)" }

    private func startOnboarding(for user: User) {
        BrowseMode.shared.noteNewAccount()
        needsOnboarding = true
        onboardingStep = UserDefaults.standard.string(forKey: Self.onboardingKey(user.username)) ?? "consent"
        UserDefaults.standard.set(onboardingStep, forKey: Self.onboardingKey(user.username))
    }

    /// 기록된 온보딩 단계가 있으면(끝내기 전에 앱을 껐으면) 그 단계부터. 기존 계정은 기록이 없어 그대로 메인.
    private func resumeOnboardingIfNeeded(for user: User) {
        guard let step = UserDefaults.standard.string(forKey: Self.onboardingKey(user.username)) else { return }
        needsOnboarding = true
        onboardingStep = step
    }

    // MARK: - 프로필 갱신

    /// 프로필 편집 등에서 서버가 돌려준 최신 user 객체로 교체한다.
    func updateUser(_ newUser: User) {
        user = newUser
    }

    // MARK: - 내부

    private func apply(_ response: AuthResponse) {
        KeychainStore.saveToken(response.token)
        if response.isNew == true {
            startOnboarding(for: response.user)
        } else {
            resumeOnboardingIfNeeded(for: response.user)
        }
        user = response.user
    }
}
