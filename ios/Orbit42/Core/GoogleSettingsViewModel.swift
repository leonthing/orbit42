import AuthenticationServices
import Foundation
import Observation
import UIKit

/// 프로필 탭 > Google 캘린더 연동 화면 상태 관리.
/// 연결 플로우: 서버가 준 OAuth URL 을 `ASWebAuthenticationSession` 으로 열고
/// `orbit42://google-connected`(성공) / `orbit42://google-error?reason=...`(실패)
/// 콜백으로 결과를 받는다.
@MainActor
@Observable
final class GoogleSettingsViewModel {
    /// nil 이면 아직 최초 로딩 전.
    private(set) var status: GoogleStatusResponse?
    private(set) var isLoading = false
    /// 최초 로딩/새로고침 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 연결/해제 실패 안내 (alert 로 표시)
    var actionMessage: String?
    private(set) var isConnecting = false
    private(set) var isDisconnecting = false

    var extraAccounts: [GoogleExtraAccount] { status?.extraAccounts ?? [] }

    private let api: APIClient
    private let presentationContext = WebAuthPresentationContext()
    /// 진행 중인 세션을 강하게 잡아둔다 (해제되면 브라우저 시트가 즉시 닫힘)
    private var currentSession: ASWebAuthenticationSession?

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 상태 로딩

    func load(force: Bool = false) async {
        if !force, status != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: GoogleStatusResponse = try await api.get("/api/v1/google/status")
            status = response
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "연동 상태를 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 연결

    /// 연결 플로우 실행. `add` 가 true 면 추가 계정 연결(`?add=1`).
    func connect(add: Bool = false) async {
        guard !isConnecting else { return }
        isConnecting = true
        defer {
            isConnecting = false
            currentSession = nil
        }

        do {
            let path = add ? "/api/v1/google/connect-url?add=1" : "/api/v1/google/connect-url"
            let response: GoogleConnectURLResponse = try await api.get(path)
            guard let url = URL(string: response.url) else {
                throw APIError.invalidResponse
            }

            let callback = try await authenticate(with: url)
            if callback.host == "google-connected" {
                await load(force: true)
            } else {
                // orbit42://google-error?reason=... 포함 그 외 콜백은 실패로 처리
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

    func disconnect() async {
        guard !isDisconnecting else { return }
        isDisconnecting = true
        defer { isDisconnecting = false }

        do {
            let _: AckResponse = try await api.post("/api/v1/google/disconnect", body: EmptyRequestBody())
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

/// ASWebAuthenticationSession 이 브라우저 시트를 띄울 윈도우 앵커 제공.
final class WebAuthPresentationContext: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
