import SwiftUI

@main
struct Orbit42App: App {
    @State private var auth = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
    }
}

/// 로그인 상태에 따라 인트로 / AuthView / MainTabView 분기.
struct RootView: View {
    @Environment(AuthViewModel.self) private var auth
    /// 첫 실행에만 기능 소개를 보여준다.
    @AppStorage("hasSeenIntro") private var hasSeenIntro = false

    var body: some View {
        Group {
            if auth.isRestoring {
                splash
            } else if auth.isAuthenticated {
                MainTabView()
            } else if !hasSeenIntro {
                IntroView { hasSeenIntro = true }
            } else {
                AuthView()
            }
        }
        .animation(.default, value: auth.isAuthenticated)
        .animation(.default, value: hasSeenIntro)
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
                    .foregroundStyle(.white)
                ProgressView()
                    .padding(.top, 8)
            }
        }
    }
}
