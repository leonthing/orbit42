import SwiftUI

/// 메인 4탭: 캘린더 / 타임슬롯 / 예약 / 프로필
struct MainTabView: View {
    enum Tab: String {
        case calendar, slots, bookings, asset, profile
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

            BookingsView()
                .tabItem { Label("예약", systemImage: "checkmark.circle") }
                .tag(Tab.bookings)

            AssetView()
                .tabItem { Label("자산", systemImage: "wonsign.circle") }
                .tag(Tab.asset)

            ProfileView()
                .tabItem { Label("프로필", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
    }
}

#Preview {
    MainTabView()
        .environment(AuthViewModel())
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
