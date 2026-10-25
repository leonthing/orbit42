import Foundation
import UserNotifications

/// 일정 알림 (1.5.0 A 2차) — 서버 푸시 없이 기기 로컬 알림으로.
/// 앞 14일치 일정을 받아 '시작 - 알림 시점'에 울리도록 예약하고, 일정이 바뀔 때마다 통째로 다시 계산한다.
/// iOS 대기 알림 한도(64개) 안에서 가까운 것부터. 종일·완료·보관 일정은 알리지 않는다.
/// 사용자가 고른 알림(일정별 알림 시점, '중요함')은 늘 울린다 — 구글 일정이어도.
/// 설정의 두 스위치는 그 밖의 일정을 기본 알림 시점으로 울릴지만 정한다(구글 일정 스위치는 기본 꺼짐).
/// '중요함'은 30분 전 + 10분 전 두 번(일정별로 시점을 골랐으면 그 값 한 번).
@MainActor
final class EventReminders {
    static let shared = EventReminders()

    static let identifierPrefix = "orbit42.event."
    /// 다시 알림 (1.5.0 B) — 일정 알림과 따로 지우고 넣는다
    static let remindPrefix = "orbit42.remind."
    /// 아침 일정 요약 (1.6.0 ③)
    static let morningPrefix = "orbit42.morning."
    nonisolated static let morningDays = 7
    static let horizonDays = 14
    nonisolated static let maxPending = 64

    private var pending: Task<Void, Never>?
    /// 방금 '중요함'으로 바꾸거나 알림을 고른 일정 — 알림 시각이 이미 지났어도 시작 전이면 바로 한 번 알린다.
    /// 다음 계산 한 번에만 쓰고 비운다(새로 고칠 때마다 다시 울리지 않게).
    private var justChosen: [String: Date] = [:]
    private let center = UNUserNotificationCenter.current()

    /// 일정을 바꾼 직후 여러 번 불려도 한 번만 돌도록 잠깐 모아서 다시 계산한다.
    func refreshSoon() {
        pending?.cancel()
        pending = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            await refresh()
        }
    }

    /// 사용자가 이 일정에 알림을 원한다고 고른 순간('중요함'·알림 시점) — 권한을 그때 묻고, 늦게 고른 경우 바로 한 번 알린다.
    func userChose(eventId: String) {
        justChosen[eventId] = Date()
        Task { @MainActor in
            await requestAuthorizationIfNeeded()
            refreshSoon()
        }
    }

    /// 지금 권한 상태 — 설정 화면의 "알림이 꺼져 있어요"에 쓴다.
    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    /// 아직 묻지 않았으면 묻는다 — 첫 실행이 아니라 알림을 켜거나 첫 일정을 만들 때 부른다.
    @discardableResult
    func requestAuthorizationIfNeeded() async -> Bool {
        let status = await authorizationStatus()
        switch status {
        case .notDetermined:
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
            if granted { await refresh() }
            return granted
        case .authorized, .provisional, .ephemeral:
            return true
        default:
            return false
        }
    }

    /// 대기 알림을 다시 맞춘다. 권한이 없으면 아무것도 예약하지 않는다(묻지도 않는다).
    func refresh() async {
        let settings = AppSettings.shared
        let status = await authorizationStatus()
        let allowed = status == .authorized || status == .provisional || status == .ephemeral
        guard allowed, KeychainStore.loadToken() != nil
        else {
            await removeOurs()
            return
        }
        guard let events = await fetchUpcoming() else { return }  // 못 받으면 기존 예약을 그대로 둔다
        // 다시 알림을 먼저 넣고, 남은 자리를 일정 알림에 (64개 한도에서 다시 알림이 밀리지 않게).
        // 다시 알림은 사용자가 직접 건 것이라 '일정 알림' 설정과 관계없이 울린다.
        let reminders = (await fetchReminders() ?? []).filter { !$0.missing && $0.remindDate > Date() }
        let remindPlans = Array(reminders.prefix(Self.maxPending))
        let now = Date()
        let chosen = Set(justChosen.filter { now.timeIntervalSince($0.value) < 600 }.keys)
        justChosen.removeAll()
        let mornings = settings.morningSummary
            ? Self.morningPlans(events: events, now: now, minutes: settings.morningSummaryMinutes)
            : []
        let plans = Self.plan(events: events, rules: Rules(settings), now: now,
                              limit: Self.maxPending - remindPlans.count - mornings.count, justChosen: chosen)
        await removeOurs()
        for morning in mornings {
            let content = UNMutableNotificationContent()
            content.title = morning.title
            content.body = morning.body
            content.sound = .default
            content.userInfo = ["morningDate": morning.day.timeIntervalSince1970]
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: morning.fireDate)
            try? await center.add(UNNotificationRequest(
                identifier: Self.morningPrefix + Self.dayKey(morning.day),
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            ))
        }
        for reminder in remindPlans {
            let content = UNMutableNotificationContent()
            content.title = "다시 알림 · \(reminder.title ?? "일정")"
            content.body = reminder.body
            content.sound = .default
            content.userInfo = ["eventId": reminder.eventId, "start": (reminder.startDate ?? reminder.remindDate).timeIntervalSince1970]
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.remindDate)
            try? await center.add(UNNotificationRequest(
                identifier: Self.remindPrefix + reminder.eventId,
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            ))
        }
        for plan in plans {
            let content = UNMutableNotificationContent()
            content.title = plan.event.title
            content.body = plan.body
            content.sound = .default
            content.userInfo = ["eventId": plan.event.id, "start": plan.event.startAt.timeIntervalSince1970]
            let trigger: UNNotificationTrigger
            if plan.immediate {
                trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
            } else {
                let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: plan.fireDate)
                trigger = UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            }
            let request = UNNotificationRequest(
                identifier: Self.identifierPrefix + plan.event.id + "#\(plan.minutes)",
                content: content,
                trigger: trigger
            )
            try? await center.add(request)
        }
        #if DEBUG
        // 확인용 — 예약된 알림을 로그로 (UI 테스트가 log stream 으로 읽는다)
        if ProcessInfo.processInfo.environment["DUMP_PENDING"] == "1" {
            for (id, date) in await pendingSummary() {
                NSLog("O42PENDING %@ %@", id, date.map { "\($0)" } ?? "-")
            }
        }
        #endif
    }

    struct Plan {
        let event: CalendarEvent
        let fireDate: Date
        /// 시작 몇 분 전 알림인지 (즉시 알림은 남은 분)
        let minutes: Int
        /// 알림 시각이 지났지만 방금 고른 경우 — 바로 한 번
        let immediate: Bool
        let body: String
    }

    /// 계산에 쓰는 설정 값 — 테스트에서 AppSettings 없이 넣을 수 있게 따로 둔다.
    struct Rules {
        var notifyOrbitEvents: Bool
        var notifyGoogleEvents: Bool
        var defaultMinutes: Int

        init(notifyOrbitEvents: Bool, notifyGoogleEvents: Bool, defaultMinutes: Int) {
            self.notifyOrbitEvents = notifyOrbitEvents
            self.notifyGoogleEvents = notifyGoogleEvents
            self.defaultMinutes = defaultMinutes
        }

        @MainActor init(_ settings: AppSettings) {
            self.init(
                notifyOrbitEvents: settings.notifyOrbitEvents,
                notifyGoogleEvents: settings.notifyGoogleEvents,
                defaultMinutes: settings.defaultReminder.rawValue
            )
        }
    }

    /// '중요함' 일정의 알림 시점 (일정별로 고른 값이 없을 때)
    nonisolated static let importantMinutes = [30, 10]

    /// 이 일정을 시작 몇 분 전에 울릴지 — 빈 배열이면 울리지 않는다.
    nonisolated static func offsets(for event: CalendarEvent, rules: Rules) -> [Int] {
        if let chosen = event.reminderMinutes {                  // 일정별로 고른 값이 우선 (스위치와 무관)
            return chosen >= 0 ? [chosen] : []
        }
        if event.importance == .high { return importantMinutes } // 중요함 (스위치와 무관)
        let on = event.isGoogle ? rules.notifyGoogleEvents : rules.notifyOrbitEvents
        return on && rules.defaultMinutes >= 0 ? [rules.defaultMinutes] : []
    }

    /// 무엇을 언제 울릴지 — 순수 계산(테스트·확인용으로 따로 둔다).
    nonisolated static func plan(
        events: [CalendarEvent],
        rules: Rules,
        now: Date,
        limit: Int = maxPending,
        justChosen: Set<String> = []
    ) -> [Plan] {
        var seen = Set<String>()
        var plans: [Plan] = []
        for event in events {
            guard !event.allDay, !event.completed, !event.archived, !event.isInvite else { continue }
            guard seen.insert(event.id).inserted else { continue }
            let offsets = offsets(for: event, rules: rules)
            guard !offsets.isEmpty, event.startAt > now else { continue }
            let future = offsets.compactMap { minutes -> Plan? in
                let fire = event.startAt.addingTimeInterval(-Double(minutes) * 60)
                guard fire > now else { return nil }
                return Plan(event: event, fireDate: fire, minutes: minutes, immediate: false, body: body(for: event, minutes: minutes))
            }
            if future.isEmpty, justChosen.contains(event.id) {
                // 늦게 고름 — 알림 시각은 지났지만 아직 시작 전: 바로 한 번 ("5분 뒤 · 오후 8:25")
                let left = max(0, Int((event.startAt.timeIntervalSince(now) / 60).rounded(.up)))
                plans.append(Plan(event: event, fireDate: now, minutes: left, immediate: true, body: body(for: event, minutes: left)))
            } else {
                plans.append(contentsOf: future)
            }
        }
        return Array(plans.sorted { $0.fireDate < $1.fireDate }.prefix(max(0, limit)))
    }

    // MARK: 아침 일정 요약 (1.6.0 ③)

    struct MorningPlan {
        let day: Date
        let fireDate: Date
        let title: String
        let body: String
    }

    /// 앞 며칠 동안 일정이 있는 날마다 그 날 `minutes`(0시부터 분)에 한 번 — 순수 계산.
    /// 완료·보관·초대 대기 일정과, 요약 시각 전에 이미 끝난 일정은 세지 않는다. 남는 일정이 없는 날은 건너뛴다.
    nonisolated static func morningPlans(events: [CalendarEvent], now: Date, minutes: Int,
                                         days: Int = morningDays, calendar: Calendar = .current) -> [MorningPlan] {
        let live = events.filter { !$0.completed && !$0.archived && !$0.isInvite }
        var out: [MorningPlan] = []
        let today = calendar.startOfDay(for: now)
        for offset in 0..<days {
            guard let day = calendar.date(byAdding: .day, value: offset, to: today),
                  let fire = calendar.date(byAdding: .minute, value: minutes, to: day),
                  fire > now else { continue }
            let allDay = live.filter { e in
                e.allDay && calendar.startOfDay(for: e.startAt) <= day
                    && day <= calendar.startOfDay(for: e.effectiveEnd(calendar: calendar))
            }
            let timed = live.filter { e in
                !e.allDay && calendar.isDate(e.startAt, inSameDayAs: day) && e.endAt > fire
            }.sorted { $0.startAt < $1.startAt }
            let count = allDay.count + timed.count
            guard count > 0 else { continue }
            var parts = timed.prefix(3).map { "\(timeFormatter.string(from: $0.startAt)) \($0.title)" }
            if parts.count < 3 { parts += allDay.prefix(3 - parts.count).map { "종일 \($0.title)" } }
            var body = parts.joined(separator: "\n")
            if count > parts.count { body += "\n외 \(count - parts.count)개" }
            out.append(MorningPlan(day: day, fireDate: fire, title: "오늘 일정 \(count)개", body: body))
        }
        return out
    }

    nonisolated static func dayKey(_ day: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: day)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    nonisolated private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "a h:mm"
        return f
    }()

    /// "10분 뒤 · 오전 10:00" (+ 장소 한 줄)
    nonisolated static func body(for event: CalendarEvent, minutes: Int) -> String {
        let lead: String
        switch minutes {
        case 0: lead = "지금"
        case 60: lead = "1시간 뒤"
        default: lead = "\(minutes)분 뒤"
        }
        var text = "\(lead) · \(timeFormatter.string(from: event.startAt))"
        if let location = event.location, !location.isEmpty { text += "\n\(location)" }
        return text
    }

    private func fetchUpcoming() async -> [CalendarEvent]? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "Asia/Seoul")
        f.dateFormat = "yyyy-MM-dd"
        let today = Date()
        let end = Calendar.current.date(byAdding: .day, value: Self.horizonDays - 1, to: today) ?? today
        let response: CalendarEventsResponse? = try? await APIClient.shared.get(
            "/api/v1/calendar/events?from=\(f.string(from: today))&to=\(f.string(from: end))"
        )
        return response?.events
    }

    /// 걸려 있는 다시 알림 (본인만, 지금 이후) — 설정의 목록에도 쓴다
    func fetchReminders() async -> [ActiveReminder]? {
        let response: RemindersResponse? = try? await APIClient.shared.get("/api/v1/reminders")
        return response?.reminders
    }

    /// 다시 알림 시각 — 그날 오전 9시(기기 시간대)
    nonisolated static func nineAM(on day: Date) -> Date {
        let cal = Calendar.current
        return cal.date(bySettingHour: 9, minute: 0, second: 0, of: cal.startOfDay(for: day)) ?? day
    }

    /// 고를 수 있는 첫날 — 오늘 오전 9시가 지났으면 내일부터
    nonisolated static func firstSelectableDay(now: Date = Date()) -> Date {
        let cal = Calendar.current
        let today = cal.startOfDay(for: now)
        return nineAM(on: today) > now ? today : (cal.date(byAdding: .day, value: 1, to: today) ?? today)
    }

    private func removeOurs() async {
        let ids = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(Self.identifierPrefix) || $0.hasPrefix(Self.remindPrefix) || $0.hasPrefix(Self.morningPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    /// 확인용 — 지금 예약된 우리 알림 (식별자, 울릴 시각)
    func pendingSummary() async -> [(String, Date?)] {
        await center.pendingNotificationRequests()
            .filter { $0.identifier.hasPrefix(Self.identifierPrefix) || $0.identifier.hasPrefix(Self.remindPrefix) || $0.identifier.hasPrefix(Self.morningPrefix) }
            .map { ($0.identifier, ($0.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate()) }
    }
}

/// 알림을 누르면 그 일정 상세로 — 앱이 꺼져 있다가 알림으로 켜져도 받도록 앱 시작 때 delegate 로 둔다.
/// 라우터가 붙기 전에 온 탭은 들고 있다가 붙는 순간 넘긴다.
@MainActor
final class NotificationTapHandler: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationTapHandler()

    weak var router: TabRouter? {
        didSet { flush() }
    }
    private var waiting: CalendarEventRequest?

    func install() {
        UNUserNotificationCenter.current().delegate = self
    }

    private var waitingDay: Date?

    private func flush() {
        guard let router else { return }
        if let day = waitingDay {
            waitingDay = nil
            router.selection = .calendar
            router.calendarDateRequest = day
        }
        guard let request = waiting else { return }
        waiting = nil
        router.selection = .calendar
        router.calendarEventRequest = request
    }

    // async 판 delegate 는 완료 콜백이 메인 밖에서 불려 UIKit 단언으로 앱이 죽는다(실측) —
    // 완료 핸들러 판을 쓰고 메인에서 처리·완료한다.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        let eventId = info["eventId"] as? String
        let start = (info["start"] as? Double).map(Date.init(timeIntervalSince1970:)) ?? Date()
        let morningDay = (info["morningDate"] as? Double).map(Date.init(timeIntervalSince1970:))
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                if let morningDay {
                    // 아침 요약 — 그날 하루 보기로
                    self.waitingDay = morningDay
                    self.flush()
                } else if let eventId {
                    self.waiting = CalendarEventRequest(eventId: eventId, date: start)
                    self.flush()
                }
            }
            completionHandler()
        }
    }

    /// 앱을 쓰는 중에도 배너로 보여 준다
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        DispatchQueue.main.async { completionHandler([.banner, .sound, .list]) }
    }
}


// MARK: - 다시 알림 (GET /api/v1/reminders)

struct RemindersResponse: Decodable {
    let reminders: [ActiveReminder]
}

struct ActiveReminder: Decodable, Identifiable {
    let eventId: String
    let remindAt: String
    let title: String?
    let startAt: String?
    let allDay: Bool
    let calendarId: String?
    /// 지워졌거나 구글 연결이 끊겨 일정을 못 찾음 — 알림은 예약하지 않고 목록에서 취소만 할 수 있다
    let missing: Bool
    var id: String { eventId }

    var remindDate: Date { APIDateParser.parse(remindAt) ?? .distantPast }
    var startDate: Date? { startAt.flatMap(APIDateParser.parse) }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E)"
        return f
    }()
    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "a h:mm"
        return f
    }()

    /// 알림 본문 — 일정 날짜(와 시각)
    var body: String {
        guard let start = startDate else { return "다시 볼 일정이에요" }
        let day = Self.dayFormatter.string(from: start)
        return allDay ? "\(day) 종일 일정" : "\(day) \(Self.timeFormatter.string(from: start)) 일정"
    }
}
