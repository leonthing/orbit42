import XCTest
@testable import Orbit42

/// 1.7.0 공유 카드 — 예약 가능한 시각 → 한국 시간 날짜별 열린 구간.
final class ShareCardPlanTests: XCTestCase {
    private let iso = ISO8601DateFormatter()
    private func d(_ s: String) -> Date { iso.date(from: s)! }
    private func opt(_ start: String, _ end: String, closed: Bool = false) -> (start: Date, end: Date, closed: Bool) {
        (d(start), d(end), closed)
    }

    /// 30분 간격·60분 길이처럼 겹치는 시각은 하나의 구간으로, 떨어진 시각은 따로
    func testMergesContiguousAndOverlapping() {
        let now = d("2026-10-26T00:00:00+09:00")
        let days = ShareCardPlanner.plan([
            opt("2026-10-27T10:00:00+09:00", "2026-10-27T11:00:00+09:00"),
            opt("2026-10-27T10:30:00+09:00", "2026-10-27T11:30:00+09:00"),
            opt("2026-10-27T11:30:00+09:00", "2026-10-27T12:30:00+09:00"),
            opt("2026-10-27T15:00:00+09:00", "2026-10-27T16:00:00+09:00"),
        ], now: now)
        XCTAssertEqual(days.count, 1)
        XCTAssertEqual(days[0].ranges.map(ShareCardPlanner.rangeText), ["10:00–12:30", "15:00–16:00"])
        XCTAssertEqual(ShareCardPlanner.dayText(days[0].day), "10월 27일 (화)")
    }

    /// 닫은 시간·지난 시간·7일 밖은 빼고, 순서가 섞여 와도 정렬
    func testFiltersClosedPastAndBeyondSevenDays() {
        let now = d("2026-10-26T12:00:00+09:00")
        let days = ShareCardPlanner.plan([
            opt("2026-10-28T09:00:00+09:00", "2026-10-28T10:00:00+09:00"),
            opt("2026-10-26T10:00:00+09:00", "2026-10-26T11:00:00+09:00"),              // 지남
            opt("2026-10-27T14:00:00+09:00", "2026-10-27T15:00:00+09:00", closed: true), // 닫음
            opt("2026-11-02T11:59:00+09:00", "2026-11-02T12:29:00+09:00"),              // 7일 안(경계 직전)
            opt("2026-11-02T12:00:00+09:00", "2026-11-02T13:00:00+09:00"),              // 정확히 7일 — 밖
        ], now: now)
        XCTAssertEqual(days.map { ShareCardPlanner.dayText($0.day) }, ["10월 28일 (수)", "11월 2일 (월)"])
        XCTAssertEqual(days[1].ranges.map(ShareCardPlanner.rangeText), ["11:59–12:29"])
    }

    /// 달 넘김 주(10/29~11/4)와 한국 시간 자정 경계 — 기기 시간대와 상관없이 KST 날짜로 묶는다
    func testMonthBoundaryGroupsByKSTDay() {
        let now = d("2026-10-29T08:00:00+09:00")
        let days = ShareCardPlanner.plan([
            opt("2026-10-31T23:00:00+09:00", "2026-10-31T23:30:00+09:00"),
            opt("2026-10-31T15:30:00Z", "2026-10-31T16:00:00Z"), // = 11/1 00:30 KST
            opt("2026-11-03T10:00:00+09:00", "2026-11-03T11:00:00+09:00"),
        ], now: now)
        XCTAssertEqual(days.map { ShareCardPlanner.dayText($0.day) }, ["10월 31일 (토)", "11월 1일 (일)", "11월 3일 (화)"])
        XCTAssertEqual(days[1].ranges.map(ShareCardPlanner.rangeText), ["00:30–01:00"])
    }

    func testRangesTextOverflowAndCardURL() {
        let base = d("2026-10-27T01:00:00Z")
        let ranges = (0..<5).map { i in
            ShareCardRange(start: base.addingTimeInterval(Double(i) * 7200), end: base.addingTimeInterval(Double(i) * 7200 + 1800))
        }
        XCTAssertEqual(ShareCardPlanner.rangesText(ranges, max: 3), "10:00–10:30 · 12:00–12:30 · 14:00–14:30 외 2")
        XCTAssertEqual(ShareCardPlanner.cardURL("https://orbit42.org/a/s/b"), "https://orbit42.org/a/s/b?via=card")
        XCTAssertEqual(ShareCardPlanner.cardURL("https://orbit42.org/a/s/b?x=1"), "https://orbit42.org/a/s/b?x=1&via=card")
    }

    func testEmptyWhenNothingOpen() {
        XCTAssertTrue(ShareCardPlanner.plan([], now: Date()).isEmpty)
    }
}
