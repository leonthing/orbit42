import Observation
import SwiftUI

/// 캘린더 탭에서 열어야 할 특정 일정 — 알림 딥링크용.
struct CalendarEventRequest: Equatable {
    let eventId: String
    /// 일정이 있는 날 (해당 달을 불러오고 그 날을 선택하기 위해 필요)
    let date: Date
}

/// 탭 간 이동 요청 — 자산 탭 추천 카드 등에서 다른 탭으로 보낼 때 쓴다.
@MainActor
@Observable
final class TabRouter {
    var selection: MainTabView.Tab = MainTabView.initialTab
    /// 예약 탭이 다음 표시 때 열어야 할 구역 ("bookings" | "links") — 소비 후 nil
    var bookingsSectionRequest: String?
    /// 캘린더 탭이 열어야 할 일정 상세 — 소비 후 nil
    var calendarEventRequest: CalendarEventRequest?
    /// 캘린더 탭이 선택해야 할 날짜 — 홈 화면 위젯 딥링크용, 소비 후 nil
    var calendarDateRequest: Date?
    /// 예약 탭이 열어야 할 예약 상세 — 일정 상세의 "예약에서 관리", 소비 후 nil
    var bookingDetailRequest: BookingDetailTarget?
    /// 예약 링크 구역에서 '새 예약 링크' 화면을 바로 연다 — 다음에 할 일 카드·받은 예약 빈 화면, 소비 후 false
    var newBookingLinkRequest = false

    /// 예약 탭 > 예약 링크 > 새 예약 링크
    func openNewBookingLink() {
        selection = .bookings
        bookingsSectionRequest = "links"
        newBookingLinkRequest = true
    }

    /// 일정 상세 → 그 예약 상세로 (받은 예약 / 내가 한 예약 구역을 먼저 맞춘다)
    func openBooking(id: String, role: BookingRole) {
        selection = .bookings
        bookingsSectionRequest = role == .host ? "received" : "sent"
        bookingDetailRequest = BookingDetailTarget(id: id, role: role)
    }

    /// 위젯 딥링크 — orbit42://calendar?date=2026-10-13 (그 날짜의 캘린더),
    /// orbit42://bookings (받은 예약 목록).
    @discardableResult
    func handle(url: URL) -> Bool {
        guard url.scheme == "orbit42" else { return false }
        if url.host == "bookings" {
            selection = .bookings
            bookingsSectionRequest = "received"
            return true
        }
        guard url.host == "calendar" else { return false }
        let raw = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "date" })?.value
        selection = .calendar
        calendarDateRequest = raw.flatMap(APIDateParser.parse) ?? Date()
        return true
    }
}

/// 메인 5탭: 캘린더 / 예약(예약·예약 링크) / 오르빗 / 리포트 / 프로필
/// 1:1 세션을 파는 사람에게 "새 예약 → 승인·입금 확인"이 핵심이라 예약을 탭으로 올렸다.
struct MainTabView: View {
    enum Tab: String {
        case calendar, bookings, orbit, asset, profile
        /// 구 탭 이름 호환 (타임라인 탭은 프로필 안으로 들어갔다)
        static func from(raw: String) -> Tab? {
            if raw == "timeline" { return .profile }
            // 예약 링크는 예약 탭 안의 구역이 됐다
            if raw == "slots" { return .bookings }
            return Tab(rawValue: raw)
        }
    }

    @Environment(TabRouter.self) private var router
    /// 관계 궤도 — 오르빗 탭과 캘린더 탭이 함께 쓴다.
    @State private var people = PeopleStore()
    /// 승인·입금 확인 대기 예약 수 — 예약 탭 배지
    @State private var pendingBookings = PendingBookingsCounter()
    @Environment(\.scenePhase) private var scenePhase

    /// DEBUG 데모/스크린샷용: DEMO_TAB 환경변수(calendar|orbit|bookings|asset|profile)로
    /// 시작 탭 지정 (simctl launch 는 SIMCTL_CHILD_DEMO_TAB=... 으로 전달)
    /// 구 rawValue "slots" 는 예약 탭의 "예약 링크" 구역으로 연다.
    static var initialTab: Tab {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["DEMO_TAB"],
           let tab = Tab.from(raw: raw) {
            return tab
        }
        #endif
        return .calendar
    }

    var body: some View {
        // 가입 없이 둘러보는 중이면 위에 늘 띠 (개선-47) — 탭 위에 쌓아야 각 탭의 상단 버튼을 가리지 않는다
        VStack(spacing: 0) {
            if BrowseMode.shared.active && !BrowseMode.hideBannerForCapture {
                BrowseBanner()
                    .background(Theme.accent.ignoresSafeArea(edges: .top))
            }
            tabs
        }
    }

    private var tabs: some View {
        @Bindable var router = router
        return TabView(selection: $router.selection) {
            CalendarView()
                .tabItem { Label("캘린더", systemImage: "calendar") }
                .tag(Tab.calendar)

            BookingsTabView()
                .tabItem { Label("예약", systemImage: "checkmark.circle") }
                .badge(pendingBookings.count)
                .tag(Tab.bookings)

            NavigationStack {
                SearchView()
            }
            .tabItem { Label("오르빗", systemImage: "circle.dotted.circle") }
            .tag(Tab.orbit)

            AssetView()
                .tabItem { Label("리포트", systemImage: "chart.bar") }
                .tag(Tab.asset)

            ProfileView()
                .tabItem { Label("프로필", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
        .environment(people)
        .environment(pendingBookings)
        .modifier(GoogleNotifyPrompt())
        .task {
            NotificationTapHandler.shared.router = router
            await pendingBookings.refresh()
            await EventReminders.shared.refresh()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await pendingBookings.refresh() }
                // 다른 기기·웹에서 바뀐 일정도 앱을 열 때 알림에 반영
                EventReminders.shared.refreshSoon()
            }
        }
    }
}

#Preview {
    MainTabView()
        .environment(AuthViewModel())
        .environment(TabRouter())
        .tint(Theme.accent)
}
