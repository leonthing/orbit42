import Observation
import SwiftUI

/// 탭 간 이동 요청 — 자산 탭 추천 카드 등에서 다른 탭으로 보낼 때 쓴다.
@MainActor
@Observable
final class TabRouter {
    var selection: MainTabView.Tab = MainTabView.initialTab
    /// 캘린더 탭이 다음 표시 때 열어야 할 세그먼트 ("schedule" | "slots") — 소비 후 nil
    var calendarModeRequest: String?
}

/// 메인 5탭: 캘린더(일정/타임슬롯) / 오르빗 / 예약 / 자산 / 프로필
struct MainTabView: View {
    enum Tab: String {
        case calendar, orbit, bookings, asset, profile
    }

    @Environment(TabRouter.self) private var router

    /// DEBUG 데모/스크린샷용: DEMO_TAB 환경변수(calendar|orbit|bookings|asset|profile)로
    /// 시작 탭 지정 (simctl launch 는 SIMCTL_CHILD_DEMO_TAB=... 으로 전달)
    /// 구 rawValue "slots" 는 캘린더 탭으로 통합되었으므로 calendar 로 매핑한다.
    static var initialTab: Tab {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["DEMO_TAB"] {
            if let tab = Tab(rawValue: raw) {
                return tab
            }
            if raw == "slots" {
                return .calendar
            }
        }
        #endif
        return .calendar
    }

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.selection) {
            CalendarView()
                .tabItem { Label("캘린더", systemImage: "calendar") }
                .tag(Tab.calendar)

            NavigationStack {
                SearchView()
            }
            .tabItem { Label("오르빗", systemImage: "circle.dotted.circle") }
            .tag(Tab.orbit)

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
        .environment(TabRouter())
        .tint(Theme.accent)
}
