import SwiftUI

@main
struct Orbit42App: App {
    @State private var auth = AuthViewModel()
    @State private var router = TabRouter()
    /// 화면 모드 — "system"(기본) | "light" | "dark"
    @AppStorage("appearanceMode") private var appearanceMode = "system"

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(router)
                .preferredColorScheme(
                    appearanceMode == "light" ? .light
                        : appearanceMode == "dark" ? .dark
                        : nil
                )
                .tint(Theme.accent)
        }
    }
}

/// 로그인 상태에 따라 인트로 / AuthView / MainTabView 분기.
/// 비로그인 상태의 앱 실행은 항상 서비스 소개(인트로)부터 시작하고,
/// 마지막 장 "시작하기" → 가입 폼, 우상단 "로그인" → 로그인 폼으로 넘어간다.
struct RootView: View {
    @Environment(AuthViewModel.self) private var auth
    /// nil 이면 아직 인트로 단계. 인트로에서 고른 목적지(가입/로그인)로 이동한다.
    @State private var authIntent: AuthIntent?

    var body: some View {
        Group {
            if auth.isRestoring {
                splash
            } else if auth.isAuthenticated {
                if auth.needsOnboarding {
                    OnboardingFlowView()
                } else {
                    MainTabView()
                }
            } else if let authIntent {
                AuthView(initialMode: authIntent == .signup ? .signup : .login)
            } else {
                IntroView { intent in
                    self.authIntent = intent
                }
            }
        }
        .animation(.default, value: auth.isAuthenticated)
        .onChange(of: auth.isAuthenticated) { wasAuthenticated, isAuthenticated in
            if wasAuthenticated && !isAuthenticated {
                // 로그아웃 직후엔 인트로를 다시 보여줄 필요 없이 로그인 폼으로.
                authIntent = .login
            }
        }
        .task {
            await auth.restoreSession()
        }
    }

    private var splash: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "circle.dotted.circle")
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Theme.accent)
                Text("orbit42")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                ProgressView()
                    .padding(.top, 8)
            }
        }
    }
}
