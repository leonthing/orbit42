import AuthenticationServices
import Foundation
import Observation

// MARK: - 모델 (GET/POST /api/v1/social/*)

/// 크로스포스팅 채널. rawValue 가 API 의 provider 값과 일치한다.
enum SocialProvider: String, CaseIterable, Identifiable, Sendable {
    case x
    case facebook
    case linkedin

    var id: String { rawValue }

    var label: String {
        switch self {
        case .x: return "X"
        case .facebook: return "페이스북 페이지"
        case .linkedin: return "링크드인"
        }
    }

    var systemImage: String {
        switch self {
        case .x: return "xmark"
        case .facebook: return "f.circle"
        case .linkedin: return "briefcase"
        }
    }
}

/// 채널 하나의 연결 상태. `name` 은 X 는 @핸들, 페이스북은 페이지명, 링크드인은 이름.
struct SocialProviderStatus: Decodable, Sendable {
    let connected: Bool
    let name: String?
}

/// `GET /api/v1/social/status`
struct SocialShareStatusResponse: Decodable, Sendable {
    let x: SocialProviderStatus
    let facebook: SocialProviderStatus
    let linkedin: SocialProviderStatus

    func status(for provider: SocialProvider) -> SocialProviderStatus {
        switch provider {
        case .x: return x
        case .facebook: return facebook
        case .linkedin: return linkedin
        }
    }
}

/// `GET /api/v1/social/connect-url?provider=...`
struct SocialConnectURLResponse: Decodable {
    let url: String
}

/// `POST /api/v1/social/disconnect`
struct SocialDisconnectRequest: Encodable {
    let provider: String
}

// MARK: - 뷰모델

/// 프로필 탭 > 글 자동 공유(크로스포스팅) 화면 상태 관리.
/// GoogleSettingsViewModel 과 동일한 패턴: 서버가 준 OAuth URL 을
/// `ASWebAuthenticationSession` 으로 열고
/// `orbit42://social-connected?provider=...`(성공) / `orbit42://social-error...`(실패)
/// 콜백으로 결과를 받는다.
@MainActor
@Observable
final class SocialShareViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var status: SocialShareStatusResponse?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 연결/해제 실패 안내 (alert 로 표시)
    var actionMessage: String?
    /// OAuth 진행 중인 채널 (버튼 비활성/스피너용)
    private(set) var connectingProvider: SocialProvider?
    /// 해제 요청 중인 채널
    private(set) var disconnectingProvider: SocialProvider?

    private let api: APIClient
    private let presentationContext = WebAuthPresentationContext()
    /// 진행 중인 세션을 강하게 잡아둔다 (해제되면 브라우저 시트가 즉시 닫힘)
    private var currentSession: ASWebAuthenticationSession?

    init(api: APIClient = .shared) {
        self.api = api
    }

    var isBusy: Bool { connectingProvider != nil || disconnectingProvider != nil }

    // MARK: - 상태 로딩

    func load(force: Bool = false) async {
        if !force, status != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: SocialShareStatusResponse = try await api.get("/api/v1/social/status")
            status = response
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "연결 상태를 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 연결

    func connect(_ provider: SocialProvider) async {
        guard connectingProvider == nil else { return }
        connectingProvider = provider
        defer {
            connectingProvider = nil
            currentSession = nil
        }

        do {
            let response: SocialConnectURLResponse = try await api.get(
                "/api/v1/social/connect-url?provider=\(provider.rawValue)"
            )
            guard let url = URL(string: response.url) else {
                throw APIError.invalidResponse
            }

            let callback = try await authenticate(with: url)
            if callback.host == "social-connected" {
                await load(force: true)
            } else {
                // orbit42://social-error?... 포함 그 외 콜백은 실패로 처리
                actionMessage = "연결에 실패했어요"
            }
        } catch let authError as ASWebAuthenticationSessionError where authError.code == .canceledLogin {
            // 사용자가 브라우저 시트를 닫음 — 조용히 무시
            return
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "연결에 실패했어요"
        }
    }

    // MARK: - 해제

    func disconnect(_ provider: SocialProvider) async {
        guard disconnectingProvider == nil else { return }
        disconnectingProvider = provider
        defer { disconnectingProvider = nil }

        do {
            let _: AckResponse = try await api.post(
                "/api/v1/social/disconnect",
                body: SocialDisconnectRequest(provider: provider.rawValue)
            )
            await load(force: true)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "연결을 해제하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 내부

    private func authenticate(with url: URL) async throws -> URL {
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
            session.presentationContextProvider = presentationContext
            currentSession = session
            session.start()
        }
    }
}
