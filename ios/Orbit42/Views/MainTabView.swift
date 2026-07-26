import SwiftUI

/// 메인 4탭: 캘린더 / 타임슬롯 / 예약 / 프로필
struct MainTabView: View {
    var body: some View {
        TabView {
            CalendarView()
                .tabItem { Label("캘린더", systemImage: "calendar") }

            PlaceholderView(
                title: "타임슬롯",
                systemImage: "clock.badge.checkmark",
                message: "내 시간을 열고 거래하는\n타임슬롯, 곧 만나요."
            )
            .tabItem { Label("타임슬롯", systemImage: "clock") }

            PlaceholderView(
                title: "예약",
                systemImage: "calendar.badge.clock",
                message: "주고받은 예약을 관리하는 공간,\n곧 만나요."
            )
            .tabItem { Label("예약", systemImage: "checkmark.circle") }

            ProfileView()
                .tabItem { Label("프로필", systemImage: "person.crop.circle") }
        }
    }
}

/// 아직 준비 중인 탭의 뼈대 화면.
struct PlaceholderView: View {
    let title: String
    let systemImage: String
    let message: String

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(spacing: 16) {
                    Image(systemName: systemImage)
                        .font(.system(size: 44, weight: .light))
                        .foregroundStyle(Theme.accent)
                    Text("곧 만나요")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                    Text(message)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.secondaryText)
                }
                .padding(32)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    MainTabView()
        .environment(AuthViewModel())
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
