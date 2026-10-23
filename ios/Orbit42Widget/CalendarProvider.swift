import SwiftUI
import WidgetKit

/// 위젯 한 장면 — 그 시점의 일정 묶음.
struct CalendarEntry: TimelineEntry {
    enum State {
        case loggedOut
        case ready
    }

    let date: Date
    let state: State
    /// 숨긴 캘린더를 뺀, 중복 없는 일정 (시작 시각 순)
    let events: [WidgetEvent]
    let colors: [String: String]
    let calendar: Calendar
    /// 승인 대기 예약 + 답하지 않은 시간 요청 (없거나 모르면 0)
    var pendingRequests: Int = 0

    func color(of event: WidgetEvent) -> Color {
        guard let id = event.calendarId, let hex = colors[id], let color = Color(widgetHex: hex) else {
            return WidgetPalette.accent
        }
        return color
    }

    /// 그 날에 걸친 일정 — 종일 먼저, 그다음 시작 순 (앱 목록과 같은 순서)
    func events(on day: Date) -> [WidgetEvent] {
        events.filter { $0.occurs(on: day, calendar: calendar) }.sorted(by: Self.order)
    }

    /// 아직 끝나지 않은 일정 — 오늘 이후, 날짜 순
    func upcoming(limit: Int) -> [WidgetEvent] {
        let todayStart = calendar.startOfDay(for: date)
        return events
            .filter { $0.allDay ? $0.end >= todayStart : $0.end > date }
            .sorted { lhs, rhs in
                let l = max(lhs.start, todayStart), r = max(rhs.start, todayStart)
                let ld = calendar.startOfDay(for: l), rd = calendar.startOfDay(for: r)
                if ld != rd { return ld < rd }
                return Self.order(lhs, rhs)
            }
            .prefix(limit)
            .map { $0 }
    }

    static func order(_ lhs: WidgetEvent, _ rhs: WidgetEvent) -> Bool {
        if lhs.allDay != rhs.allDay { return lhs.allDay }
        if lhs.start != rhs.start { return lhs.start < rhs.start }
        return lhs.title < rhs.title
    }
}

struct CalendarProvider: TimelineProvider {
    func placeholder(in context: Context) -> CalendarEntry {
        Self.sampleEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (CalendarEntry) -> Void) {
        if context.isPreview, SharedKeychain.load() == nil {
            completion(Self.sampleEntry())
            return
        }
        Task { completion(await Self.loadEntry(now: .now, fetch: !context.isPreview)) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CalendarEntry>) -> Void) {
        Task {
            let now = Date()
            // 체크박스를 누른 직후면 캐시로 바로 그린다 (서버 저장은 Intent 가 이어서 한다)
            let entry = await Self.loadEntry(now: now, fetch: !WidgetStore.hasRecentLocalChange)
            completion(Timeline(entries: Self.entries(from: entry), policy: .after(now.addingTimeInterval(15 * 60))))
        }
    }

    // MARK: - 데이터

    static func makeCalendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        let first = SharedDisplaySettings.load().firstWeekday
        calendar.firstWeekday = (1...7).contains(first) ? first : Calendar.current.firstWeekday
        return calendar
    }

    /// 서버에서 이번 달·다음 달을 받아 사본을 갱신하고, 실패하면 사본으로 그린다.
    static func loadEntry(now: Date, fetch: Bool) async -> CalendarEntry {
        let calendar = makeCalendar()
        guard let token = SharedKeychain.load() else {
            WidgetStore.clear()  // 로그아웃 — 지난 계정의 일정을 남기지 않는다
            return CalendarEntry(date: now, state: .loggedOut, events: [], colors: [:], calendar: calendar)
        }
        if fetch {
            let unauthorized = await refresh(token: token, now: now, calendar: calendar)
            if unauthorized {
                WidgetStore.clear()
                return CalendarEntry(date: now, state: .loggedOut, events: [], colors: [:], calendar: calendar)
            }
        }
        let feed = WidgetStore.load()
        let hidden = Set(SharedDisplaySettings.load().hiddenCalendarIds)
        var seen = Set<String>()
        var events: [WidgetEvent] = []
        var colors: [String: String] = [:]
        for key in (feed?.months.keys.sorted() ?? []) {
            guard let month = feed?.months[key] else { continue }
            colors.merge(month.colors) { _, new in new }
            for event in month.events where seen.insert(event.id).inserted {
                if let id = event.calendarId, hidden.contains(id) { continue }
                events.append(event)
            }
        }
        return CalendarEntry(date: now, state: .ready, events: events, colors: colors, calendar: calendar,
                             pendingRequests: feed?.pendingBookings ?? 0)
    }

    /// - Returns: 토큰이 무효(401)면 true
    private static func refresh(token: String, now: Date, calendar: Calendar) async -> Bool {
        var months: [String: WidgetMonth] = [:]
        for offset in 0...1 {
            guard let day = calendar.date(byAdding: .month, value: offset, to: now) else { continue }
            let comps = calendar.dateComponents([.year, .month], from: day)
            guard let year = comps.year, let month = comps.month else { continue }
            var components = URLComponents(url: SharedConfig.baseURL, resolvingAgainstBaseURL: false)!
            components.path = "/api/v1/calendar/events"
            components.queryItems = [
                URLQueryItem(name: "year", value: String(year)),
                URLQueryItem(name: "month", value: String(month)),
            ]
            var request = URLRequest(url: components.url!, timeoutInterval: 15)
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            guard let (data, response) = try? await URLSession.shared.data(for: request),
                  let http = response as? HTTPURLResponse
            else { return false }
            if http.statusCode == 401 { return true }
            guard (200..<300).contains(http.statusCode),
                  let decoded = try? WidgetFeedDecoder.decodeMonth(data, calendar: calendar)
            else { return false }
            months[WidgetFeed.monthKey(year: year, month: month)] = decoded
        }
        if !months.isEmpty { WidgetStore.merge(months, now: now) }
        if let pending = await fetchPendingRequests(token: token) { WidgetStore.setPendingBookings(pending) }
        return false
    }

    /// 내가 답할 일 수 — 앱 예약 탭 배지(PendingBookingsCounter)와 같은 셈 (개선-30):
    /// 받은 예약 중 승인 대기이거나 상대가 보낸 시간 변경 제안이 온 것(한 예약은 한 번)
    /// + 내가 한 예약 중 상대가 보낸 제안이 온 것 + 프로필로 받은 시간 요청 중 미답. 내가 보낸 제안은 세지 않는다.
    private static func fetchPendingRequests(token: String) async -> Int? {
        struct Response: Decodable {
            struct Proposal: Decodable { let byMe: Bool? }
            struct Row: Decodable {
                let status: String?
                let scheduledEndAt: String?
                let reschedule: Proposal?
                /// 응답 없이 시간이 지난 대기 예약은 빼고 센다 (개선-31)
                var isOpenPending: Bool {
                    guard status == "pending" else { return false }
                    guard let raw = scheduledEndAt else { return true }
                    let f = ISO8601DateFormatter()
                    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                    let end = f.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
                    return (end ?? .distantFuture) > Date()
                }
                var hasIncomingProposal: Bool { reschedule.map { $0.byMe != true } ?? false }
            }
            let host: [Row]
            let guest: [Row]?
            let pendingTimeRequests: Int?
        }
        var components = URLComponents(url: SharedConfig.baseURL, resolvingAgainstBaseURL: false)!
        components.path = "/api/v1/bookings"
        var request = URLRequest(url: components.url!, timeoutInterval: 15)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let decoded = try? JSONDecoder().decode(Response.self, from: data)
        else { return nil }
        let host = decoded.host.filter { $0.isOpenPending || $0.hasIncomingProposal }.count
        let guest = (decoded.guest ?? []).filter(\.hasIncomingProposal).count
        return host + guest + (decoded.pendingTimeRequests ?? 0)
    }

    /// 지금 + 앞으로 12시간 안에 끝나는 일정마다 + 자정 — 다음 갱신 전에도 지난 일정이 빠지도록.
    static func entries(from entry: CalendarEntry) -> [CalendarEntry] {
        guard entry.state == .ready else { return [entry] }
        let now = entry.date
        var dates = Set(entry.events
            .filter { !$0.allDay && $0.end > now && $0.end < now.addingTimeInterval(12 * 3600) }
            .map { $0.end.addingTimeInterval(1) })
        if let midnight = entry.calendar.date(byAdding: .day, value: 1, to: entry.calendar.startOfDay(for: now)) {
            dates.insert(midnight)
        }
        let later = dates.sorted().prefix(12).map {
            CalendarEntry(date: $0, state: .ready, events: entry.events, colors: entry.colors,
                          calendar: entry.calendar, pendingRequests: entry.pendingRequests)
        }
        return [entry] + later
    }

    /// 위젯 갤러리 미리보기 — 실제 데이터가 아닌 예시
    static func sampleEntry() -> CalendarEntry {
        let calendar = makeCalendar()
        let now = Date()
        let today = calendar.startOfDay(for: now)
        func at(_ dayOffset: Int, _ hour: Int, _ minutes: Int = 0) -> Date {
            let day = calendar.date(byAdding: .day, value: dayOffset, to: today) ?? today
            return calendar.date(bySettingHour: hour, minute: minutes, second: 0, of: day) ?? day
        }
        let events = [
            WidgetEvent(id: "s1", title: "포트폴리오 코칭", start: at(0, 14), end: at(0, 15), allDay: false,
                        completed: false, tentative: false, calendarId: "work", importance: "high"),
            WidgetEvent(id: "s2", title: "커피챗", start: at(0, 17), end: at(0, 18), allDay: false,
                        completed: false, tentative: false, calendarId: "meet", importance: "low"),
            WidgetEvent(id: "s3", title: "F 저녁 약속", start: at(0, 19), end: at(0, 21), allDay: false,
                        completed: false, tentative: false, calendarId: "life"),
            WidgetEvent(id: "s4", title: "면접 준비 상담", start: at(1, 11), end: at(1, 12), allDay: false,
                        completed: false, tentative: false, calendarId: "work"),
        ]
        return CalendarEntry(
            date: now, state: .ready, events: events,
            colors: ["work": "#6366f1", "meet": "#0ea5e9", "life": "#ef4444"],
            calendar: calendar,
            pendingRequests: 2
        )
    }
}

extension CalendarEntry.State: Equatable {}
