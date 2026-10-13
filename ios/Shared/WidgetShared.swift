import Foundation
import Security

/// 앱과 홈 화면 위젯이 함께 쓰는 것 — 공유 키체인(토큰 사본·표시 설정)과 위젯 일정 캐시.
/// 앱(Orbit42)과 위젯 확장(Orbit42Widget) 두 타겟에 모두 컴파일된다.
/// App Group 없이 키체인 공유만 쓴다 — 일정은 위젯이 서버에서 직접 받는다.
enum SharedConfig {
    /// 팀 접두사가 붙은 공유 키체인 그룹 — 엔타이틀먼트의 `$(AppIdentifierPrefix)org.orbit42.shared`
    static let keychainGroup = "K635G7H22M.org.orbit42.shared"

    static var baseURL: URL {
        #if DEBUG && targetEnvironment(simulator)
        URL(string: "http://localhost:3000")!
        #else
        URL(string: "https://orbit42.org")!
        #endif
    }

    /// 위젯 → 앱 딥링크: 받은 예약 목록
    static let bookingsURL = URL(string: "orbit42://bookings")!

    /// 위젯 → 앱 딥링크: orbit42://calendar?date=2026-10-13
    static func calendarURL(for day: Date) -> URL {
        URL(string: "orbit42://calendar?date=\(APIDateParser.encodeDateOnly(day))")!
    }
}

// MARK: - 공유 키체인

/// 공유 그룹의 키체인 항목 하나 (계정 이름별).
private struct SharedKeychainItem {
    let account: String

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "org.orbit42.app",
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: SharedConfig.keychainGroup,
        ]
    }

    @discardableResult
    func save(_ data: Data) -> Bool {
        let update: [String: Any] = [kSecValueData as String: data]
        if SecItemUpdate(baseQuery as CFDictionary, update as CFDictionary) == errSecSuccess { return true }
        var add = baseQuery
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    func load() -> Data? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    func delete() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}

/// 로그인 토큰의 공유 사본. 앱의 원래 토큰(KeychainStore)은 그대로 두고
/// 위젯이 읽을 수 있는 그룹에 한 벌 더 둔다 — 공유 쪽이 실패해도 앱 로그인은 영향 없다.
enum SharedKeychain {
    private static let item = SharedKeychainItem(account: "auth-token-shared")

    @discardableResult
    static func save(_ token: String) -> Bool {
        #if DEBUG
        // 실패 경로 테스트: 공유 키체인 쓰기가 실패해도 앱 로그인이 유지되는지
        if ProcessInfo.processInfo.environment["DEMO_SHARED_KEYCHAIN_FAIL"] == "1" { return false }
        #endif
        guard let data = token.data(using: .utf8) else { return false }
        return item.save(data)
    }

    static func load() -> String? {
        item.load().flatMap { String(data: $0, encoding: .utf8) }
    }

    static func delete() {
        item.delete()
    }
}

/// 앱의 캘린더 표시 설정 중 위젯도 따라야 하는 것 — 숨긴 캘린더, 주 시작 요일.
struct SharedDisplaySettings: Codable, Equatable {
    var hiddenCalendarIds: [String] = []
    /// 1=일요일 … 7=토요일, 0=미정(기기 설정)
    var firstWeekday: Int = 0

    private static let item = SharedKeychainItem(account: "widget-display-settings")

    static func load() -> SharedDisplaySettings {
        guard let data = item.load(),
              let settings = try? JSONDecoder().decode(SharedDisplaySettings.self, from: data)
        else { return SharedDisplaySettings() }
        return settings
    }

    /// 바뀐 경우에만 쓴다. - Returns: 실제로 바뀌었는지
    @discardableResult
    static func update(_ change: (inout SharedDisplaySettings) -> Void) -> Bool {
        var settings = load()
        let before = settings
        change(&settings)
        guard settings != before, let data = try? JSONEncoder().encode(settings) else { return false }
        item.save(data)
        return true
    }
}

// MARK: - 위젯용 일정

struct WidgetEvent: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let title: String
    let start: Date
    /// 실질 종료 시각 — 종일 일정은 마지막 날 23:59:59, 자정 끝은 직전 초 (앱 effectiveEnd 와 같은 규칙)
    let end: Date
    let allDay: Bool
    /// 위젯 체크박스로 바꾼 뒤 캐시에 바로 반영하려고 var
    var completed: Bool
    let tentative: Bool
    let calendarId: String?

    func occurs(on day: Date, calendar: Calendar) -> Bool {
        let dayStart = calendar.startOfDay(for: day)
        guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart) else { return false }
        return start < dayEnd && end >= dayStart
    }
}

struct WidgetMonth: Codable, Sendable {
    var events: [WidgetEvent]
    /// 캘린더 id → "#rrggbb"
    var colors: [String: String]
}

struct WidgetFeed: Codable, Sendable {
    var updatedAt: Date
    /// "2026-10" → 그 달 일정
    var months: [String: WidgetMonth]
    /// 받은 예약 중 승인 대기 건수 (앱 예약 탭 배지와 같은 수) — 못 받았으면 nil
    var pendingBookings: Int?

    static func monthKey(year: Int, month: Int) -> String {
        String(format: "%04d-%02d", year, month)
    }
}

// MARK: - 서버 응답 → 위젯 일정 (앱 CalendarEvent 와 같은 해석)

enum WidgetFeedDecoder {
    private struct RawResponse: Decodable {
        let events: [RawEvent]
        let calendars: [RawCalendar]
    }

    private struct RawCalendar: Decodable {
        let id: String
        let color: String
    }

    private struct RawEvent: Decodable {
        let id: String
        let title: String
        let startAt: String
        let endAt: String
        let allDay: Bool?
        let calendarId: String?
        let completed: Bool?
        let tentative: Bool?
    }

    static func decodeMonth(_ data: Data, calendar: Calendar) throws -> WidgetMonth {
        let raw = try JSONDecoder().decode(RawResponse.self, from: data)
        let events: [WidgetEvent] = raw.events.compactMap { event in
            guard let start = APIDateParser.parse(event.startAt),
                  let endAt = APIDateParser.parse(event.endAt)
            else { return nil }
            return WidgetEvent(
                id: event.id,
                title: event.title,
                start: start,
                end: effectiveEnd(start: start, end: endAt,
                                  endWasDateOnly: APIDateParser.isDateOnly(event.endAt),
                                  calendar: calendar),
                allDay: event.allDay ?? false,
                completed: event.completed ?? false,
                tentative: event.tentative ?? false,
                calendarId: event.calendarId
            )
        }
        var colors: [String: String] = [:]
        for info in raw.calendars { colors[info.id] = info.color }
        return WidgetMonth(events: events, colors: colors)
    }

    static func effectiveEnd(start: Date, end rawEnd: Date, endWasDateOnly: Bool, calendar: Calendar) -> Date {
        var end = max(rawEnd, start)
        if endWasDateOnly {
            if let nextDay = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: end)) {
                end = nextDay.addingTimeInterval(-1)
            }
        } else if end > start, end == calendar.startOfDay(for: end) {
            end = end.addingTimeInterval(-1)
        }
        return end
    }
}

// MARK: - 위젯 일정 캐시 (위젯 확장 자신의 컨테이너 — 네트워크 실패·오프라인 때 마지막 값)

enum WidgetStore {
    private static var fileURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("widget-feed.json")
    }

    static func load() -> WidgetFeed? {
        guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try? decoder.decode(WidgetFeed.self, from: data)
    }

    /// 받은 달들을 기존 사본에 덮어쓴다. 오래된 달(3달 이전)은 정리한다.
    static func merge(_ months: [String: WidgetMonth], now: Date = .now) {
        var feed = load() ?? WidgetFeed(updatedAt: now, months: [:])
        for (key, month) in months { feed.months[key] = month }
        let cutoff = Calendar(identifier: .gregorian).date(byAdding: .month, value: -3, to: now) ?? now
        let comps = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: cutoff)
        let cutoffKey = WidgetFeed.monthKey(year: comps.year ?? 0, month: comps.month ?? 0)
        feed.months = feed.months.filter { $0.key >= cutoffKey }
        feed.updatedAt = now
        save(feed)
    }

    static func setPendingBookings(_ count: Int) {
        guard var feed = load() else { return }
        feed.pendingBookings = count
        save(feed)
    }

    /// 위젯 체크박스 — 서버 저장이 끝난 완료 상태를 캐시의 모든 달에 반영한다.
    static func setCompleted(eventId: String, completed: Bool) {
        guard var feed = load() else { return }
        for key in feed.months.keys {
            guard var month = feed.months[key] else { continue }
            for index in month.events.indices where month.events[index].id == eventId {
                month.events[index].completed = completed
            }
            feed.months[key] = month
        }
        save(feed)
    }

    static func clear() {
        guard let url = fileURL else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private static func save(_ feed: WidgetFeed) {
        guard let url = fileURL else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        guard let data = try? encoder.encode(feed) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
