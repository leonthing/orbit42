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
    /// 방금 가입한 계정인지 — true 면 팔로우 추천 온보딩을 먼저 보여준다.
    private(set) var needsFollowOnboarding = false

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
        if let idx = args.firstIndex(of: "-demoToken"), idx + 1 < args.count {
            KeychainStore.saveToken(args[idx + 1])
        } else if let envToken = ProcessInfo.processInfo.environment["DEMO_TOKEN"],
                  !envToken.isEmpty {
            KeychainStore.saveToken(envToken)
        }
        #endif
        guard KeychainStore.loadToken() != nil else { return }
        do {
            let response: MeResponse = try await api.get("/api/v1/me")
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
            needsFollowOnboarding = true
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

    func logout() {
        KeychainStore.deleteToken()
        user = nil
        needsFollowOnboarding = false
    }

    /// 팔로우 추천 온보딩 완료(또는 건너뛰기) — 메인 탭으로 진입한다.
    func finishFollowOnboarding() {
        needsFollowOnboarding = false
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
            needsFollowOnboarding = true
        }
        user = response.user
    }
}
