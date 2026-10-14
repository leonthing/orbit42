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
    static let horizonDays = 14
    static let maxPending = 64

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
        guard allowed, settings.notifyOrbitEvents || settings.notifyGoogleEvents,
              KeychainStore.loadToken() != nil
        else {
            await removeOurs()
            return
        }
        guard let events = await fetchUpcoming() else { return }  // 못 받으면 기존 예약을 그대로 둔다
        let plans = Self.plan(events: events, settings: settings, now: Date())
        await removeOurs()
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
    static func plan(events: [CalendarEvent], settings: AppSettings, now: Date) -> [Plan] {
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
        return Array(plans.sorted { $0.fireDate < $1.fireDate }.prefix(maxPending))
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

    private func removeOurs() async {
        let ids = await center.pendingNotificationRequests()
            .map(\.identifier)
            .filter { $0.hasPrefix(Self.identifierPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: ids)
    }

    /// 확인용 — 지금 예약된 우리 알림 (식별자, 울릴 시각)
    func pendingSummary() async -> [(String, Date?)] {
        await center.pendingNotificationRequests()
            .filter { $0.identifier.hasPrefix(Self.identifierPrefix) }
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
