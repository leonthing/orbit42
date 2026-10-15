import XCTest
@testable import Orbit42

/// 일정 알림 계획 (1.5.1 버그-3) — 고른 알림은 스위치와 상관없이, 중요함은 30·10분 전.
final class EventRemindersPlanTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-10-20T00:00:00Z")!   // 09:00 KST
    /// 구글 스위치 꺼짐(기본) · Orbit42 켜짐 · 기본 10분 전
    private let rules = EventReminders.Rules(notifyOrbitEvents: true, notifyGoogleEvents: false, defaultMinutes: 10)

    private func event(_ id: String, start: String, source: String = "google", importance: String? = nil,
                       reminder: Int? = nil, allDay: Bool = false, completed: Bool = false) -> CalendarEvent {
        var json: [String: Any] = ["id": id, "title": "t", "startAt": start, "endAt": start, "allDay": allDay,
                                   "source": source, "completed": completed]
        if let importance { json["importance"] = importance }
        if let reminder { json["reminderMinutes"] = reminder }
        let data = try! JSONSerialization.data(withJSONObject: json)
        return try! JSONDecoder().decode(CalendarEvent.self, from: data)
    }

    private func minutes(_ plans: [EventReminders.Plan], _ id: String) -> [Int] {
        plans.filter { $0.event.id == id }.map(\.minutes)
    }

    func testGoogleImportantRingsTwiceEvenWithSwitchOff() {
        let e = event("g1", start: "2026-10-20T14:00:00+09:00", importance: "high")
        let plans = EventReminders.plan(events: [e], rules: rules, now: now)
        XCTAssertEqual(minutes(plans, "g1"), [30, 10])
        XCTAssertEqual(plans.map(\.immediate), [false, false])
    }

    func testGoogleNormalStaysSilentWithSwitchOff() {
        let e = event("g2", start: "2026-10-20T14:00:00+09:00")
        XCTAssertTrue(EventReminders.plan(events: [e], rules: rules, now: now).isEmpty)
        var on = rules; on.notifyGoogleEvents = true
        XCTAssertEqual(minutes(EventReminders.plan(events: [e], rules: on, now: now), "g2"), [10])
    }

    func testChosenReminderWinsOverImportanceAndSwitch() {
        let chosen = event("g3", start: "2026-10-20T14:00:00+09:00", importance: "high", reminder: 60)
        XCTAssertEqual(minutes(EventReminders.plan(events: [chosen], rules: rules, now: now), "g3"), [60])
        let normal = event("g4", start: "2026-10-20T14:00:00+09:00", reminder: 5)
        XCTAssertEqual(minutes(EventReminders.plan(events: [normal], rules: rules, now: now), "g4"), [5])
        let none = event("g5", start: "2026-10-20T14:00:00+09:00", importance: "high", reminder: -1)
        XCTAssertTrue(EventReminders.plan(events: [none], rules: rules, now: now).isEmpty, "직접 '없음'을 고르면 중요함이어도 안 울림")
    }

    func testOrbitSwitchOffStillRingsChosen() {
        var off = rules; off.notifyOrbitEvents = false
        let plain = event("o1", start: "2026-10-20T14:00:00+09:00", source: "local")
        let important = event("o2", start: "2026-10-20T14:00:00+09:00", source: "local", importance: "high")
        let plans = EventReminders.plan(events: [plain, important], rules: off, now: now)
        XCTAssertEqual(minutes(plans, "o1"), [])
        XCTAssertEqual(minutes(plans, "o2"), [30, 10])
    }

    func testLateMarkFiresOnceImmediatelyOnlyWhenJustChosen() {
        // 09:05 시작, 지금 09:00 → 30·10분 전 둘 다 지남
        let e = event("g6", start: "2026-10-20T09:05:00+09:00", importance: "high")
        XCTAssertTrue(EventReminders.plan(events: [e], rules: rules, now: now).isEmpty, "그냥 새로 고칠 땐 다시 울리지 않음")
        let plans = EventReminders.plan(events: [e], rules: rules, now: now, justChosen: ["g6"])
        XCTAssertEqual(plans.count, 1)
        XCTAssertEqual(plans.first?.immediate, true)
        XCTAssertEqual(plans.first?.minutes, 5)
        XCTAssertTrue(plans.first?.body.hasPrefix("5분 뒤") ?? false)
    }

    func testPartlyPassedKeepsOnlyFuture() {
        // 09:20 시작 → 30분 전(08:50)은 지남, 10분 전(09:10)만
        let e = event("g7", start: "2026-10-20T09:20:00+09:00", importance: "high")
        let plans = EventReminders.plan(events: [e], rules: rules, now: now, justChosen: ["g7"])
        XCTAssertEqual(minutes(plans, "g7"), [10])
        XCTAssertEqual(plans.first?.immediate, false)
    }

    func testStartedOrExcludedNeverRing() {
        let started = event("g8", start: "2026-10-20T08:55:00+09:00", importance: "high")
        let allDay = event("g9", start: "2026-10-21", importance: "high", allDay: true)
        let done = event("g10", start: "2026-10-20T14:00:00+09:00", importance: "high", completed: true)
        XCTAssertTrue(EventReminders.plan(events: [started, allDay, done], rules: rules, now: now, justChosen: ["g8"]).isEmpty)
    }

    func testLimitCountsSecondAlertAndKeepsEarliest() {
        // 중요함 40개 = 알림 80개 → 한도 64개, 가까운 순
        let events = (0..<40).map { i in
            event("h\(i)", start: ISO8601DateFormatter().string(from: now.addingTimeInterval(Double(i + 1) * 3600)), importance: "high")
        }
        let plans = EventReminders.plan(events: events, rules: rules, now: now, limit: 64)
        XCTAssertEqual(plans.count, 64)
        XCTAssertEqual(plans.map(\.fireDate), plans.map(\.fireDate).sorted())
        XCTAssertEqual(minutes(plans, "h0"), [30, 10])
        XCTAssertTrue(minutes(plans, "h39").isEmpty, "가장 먼 일정은 한도 밖")
    }
}
