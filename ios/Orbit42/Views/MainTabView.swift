import SwiftUI

/// 메인 4탭: 캘린더 / 타임슬롯 / 예약 / 프로필
struct MainTabView: View {
    enum Tab: String {
        case calendar, slots, bookings, profile
    }

    @State private var selection: Tab = MainTabView.initialTab

    /// DEBUG 데모/스크린샷용: DEMO_TAB 환경변수(calendar|slots|bookings|profile)로
    /// 시작 탭 지정 (simctl launch 는 SIMCTL_CHILD_DEMO_TAB=... 으로 전달)
    private static var initialTab: Tab {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["DEMO_TAB"],
           let tab = Tab(rawValue: raw) {
            return tab
        }
        #endif
        return .calendar
    }

    var body: some View {
        TabView(selection: $selection) {
            CalendarView()
                .tabItem { Label("캘린더", systemImage: "calendar") }
                .tag(Tab.calendar)

            SlotsView()
                .tabItem { Label("타임슬롯", systemImage: "clock") }
                .tag(Tab.slots)

            PlaceholderView(
                title: "예약",
                systemImage: "calendar.badge.clock",
                message: "주고받은 예약을 관리하는 공간,\n곧 만나요."
            )
            .tabItem { Label("예약", systemImage: "checkmark.circle") }
            .tag(Tab.bookings)

            ProfileView()
                .tabItem { Label("프로필", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
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
