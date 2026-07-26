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

    func logout() {
        KeychainStore.deleteToken()
        user = nil
    }

    // MARK: - 내부

    private func apply(_ response: AuthResponse) {
        KeychainStore.saveToken(response.token)
        user = response.user
    }
}
