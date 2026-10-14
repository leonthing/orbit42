import Foundation
import UserNotifications

/// 일정 알림 (1.5.0 A 2차) — 서버 푸시 없이 기기 로컬 알림으로.
/// 앞 14일치 일정을 받아 '시작 - 알림 시점'에 울리도록 예약하고, 일정이 바뀔 때마다 통째로 다시 계산한다.
/// iOS 대기 알림 한도(64개) 안에서 가까운 것부터. 종일·완료·보관 일정은 알리지 않는다.
/// 구글 일정은 설정 "구글 일정도 알림"을 켰을 때만 (구글 쪽 알림 설정은 건드리지 않음).
@MainActor
final class EventReminders {
    static let shared = EventReminders()

    static let identifierPrefix = "orbit42.event."
    /// 다시 알림 (1.5.0 B) — 일정 알림과 따로 지우고 넣는다
    static let remindPrefix = "orbit42.remind."
    static let horizonDays = 14
    nonisolated static let maxPending = 64

    private var pending: Task<Void, Never>?
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
        let plans = Self.plan(events: events, settings: settings, now: Date(), limit: Self.maxPending - remindPlans.count)
        await removeOurs()
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
            let parts = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: plan.fireDate)
            let request = UNNotificationRequest(
                identifier: Self.identifierPrefix + plan.event.id,
                content: content,
                trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)
            )
            try? await center.add(request)
        }
    }

    struct Plan {
        let event: CalendarEvent
        let fireDate: Date
        let body: String
    }

    /// 무엇을 언제 울릴지 — 순수 계산(테스트·확인용으로 따로 둔다).
    static func plan(events: [CalendarEvent], settings: AppSettings, now: Date, limit: Int = maxPending) -> [Plan] {
        var seen = Set<String>()
        let plans: [Plan] = events.compactMap { event in
            guard !event.allDay, !event.completed, !event.archived, !event.isInvite else { return nil }
            guard seen.insert(event.id).inserted else { return nil }
            if event.isGoogle ? !settings.notifyGoogleEvents : !settings.notifyOrbitEvents { return nil }
            let minutes = event.reminderMinutes ?? settings.defaultReminder.rawValue
            guard minutes >= 0 else { return nil }
            let fire = event.startAt.addingTimeInterval(-Double(minutes) * 60)
            guard fire > now else { return nil }
            return Plan(event: event, fireDate: fire, body: body(for: event, minutes: minutes))
        }
        return Array(plans.sorted { $0.fireDate < $1.fireDate }.prefix(max(0, limit)))
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "a h:mm"
        return f
    }()

    /// "10분 뒤 · 오전 10:00" (+ 장소 한 줄)
    static func body(for event: CalendarEvent, minutes: Int) -> String {
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
            .filter { $0.hasPrefix(Self.identifierPrefix) || $0.hasPrefix(Self.remindPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    /// 확인용 — 지금 예약된 우리 알림 (식별자, 울릴 시각)
    func pendingSummary() async -> [(String, Date?)] {
        await center.pendingNotificationRequests()
            .filter { $0.identifier.hasPrefix(Self.identifierPrefix) || $0.identifier.hasPrefix(Self.remindPrefix) }
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

    private func flush() {
        guard let router, let request = waiting else { return }
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
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                if let eventId {
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
