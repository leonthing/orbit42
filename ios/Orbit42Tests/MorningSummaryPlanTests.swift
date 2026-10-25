import XCTest
@testable import Orbit42

/// 아침 일정 요약 (1.6.0 ③) — 일정이 있는 날만, 고른 시각에, 이미 지난 시각·끝난 일정은 빼고.
final class MorningSummaryPlanTests: XCTestCase {
    private var cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Asia/Seoul")!
        return c
    }()
    private let iso = ISO8601DateFormatter()

    private func event(_ id: String, _ start: String, _ end: String, title: String = "t", allDay: Bool = false,
                       completed: Bool = false, source: String = "local") -> CalendarEvent {
        let json: [String: Any] = ["id": id, "title": title, "startAt": start, "endAt": end, "allDay": allDay,
                                   "source": source, "completed": completed]
        return try! JSONDecoder().decode(CalendarEvent.self, from: JSONSerialization.data(withJSONObject: json))
    }

    /// 10/20(화) 07:00 KST 기준
    private var now: Date { iso.date(from: "2026-10-19T22:00:00Z")! }

    func testOnlyDaysWithEventsAtChosenTime() {
        let events = [
            event("a", "2026-10-20T10:00:00+09:00", "2026-10-20T11:00:00+09:00", title: "브랜드 미팅"),
            event("b", "2026-10-20T14:00:00+09:00", "2026-10-20T15:00:00+09:00", title: "리뷰"),
            event("c", "2026-10-22T09:00:00+09:00", "2026-10-22T10:00:00+09:00", title: "요가"),
        ]
        let plans = EventReminders.morningPlans(events: events, now: now, minutes: 8 * 60, calendar: cal)
        XCTAssertEqual(plans.count, 2, "일정 없는 21일·23일~ 은 건너뜀")
        XCTAssertEqual(plans[0].title, "오늘 일정 2개")
        XCTAssertEqual(cal.component(.hour, from: plans[0].fireDate), 8)
        XCTAssertTrue(plans[0].body.contains("브랜드 미팅"))
        XCTAssertEqual(cal.component(.day, from: plans[1].day), 22)
    }

    func testPastTimeTodaySkippedAndDoneEventsNotCounted() {
        let events = [
            event("a", "2026-10-20T10:00:00+09:00", "2026-10-20T11:00:00+09:00"),
            event("d", "2026-10-21T06:00:00+09:00", "2026-10-21T07:00:00+09:00"),   // 08:00 요약 전에 끝남
            event("e", "2026-10-21T10:00:00+09:00", "2026-10-21T11:00:00+09:00", completed: true),
        ]
        let at8 = EventReminders.morningPlans(events: events, now: now, minutes: 8 * 60, calendar: cal)
        XCTAssertEqual(at8.map { cal.component(.day, from: $0.day) }, [20], "21일은 끝난 일정·완료 일정뿐이라 건너뜀")
        // 지금 07:00, 요약 06:30 → 오늘 요약은 이미 지남
        let early = EventReminders.morningPlans(events: [events[0]], now: now, minutes: 6 * 60 + 30, calendar: cal)
        XCTAssertTrue(early.isEmpty)
    }

    func testAllDayCountsAndMoreLine() {
        let events = [
            event("x", "2026-10-20", "2026-10-21", title: "마감", allDay: true),
            event("a", "2026-10-20T09:00:00+09:00", "2026-10-20T10:00:00+09:00", title: "A"),
            event("b", "2026-10-20T10:00:00+09:00", "2026-10-20T11:00:00+09:00", title: "B"),
            event("c", "2026-10-20T12:00:00+09:00", "2026-10-20T13:00:00+09:00", title: "C"),
        ]
        let plans = EventReminders.morningPlans(events: events, now: now, minutes: 8 * 60, days: 1, calendar: cal)
        XCTAssertEqual(plans.first?.title, "오늘 일정 4개")
        XCTAssertTrue(plans.first?.body.hasSuffix("외 1개") ?? false, plans.first?.body ?? "")
    }
}
