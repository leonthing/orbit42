import XCTest
@testable import Orbit42

/// 완료 체크 모양 (1.5.2 개선-19) — 중요함은 동그라미 대신 별, 보관하면 다시 동그라미.
final class CompletionMarkTests: XCTestCase {
    private func event(importance: String? = nil, completed: Bool = false, status: String? = nil) -> CalendarEvent {
        var json: [String: Any] = ["id": "e", "title": "t", "startAt": "2026-10-20T14:00:00+09:00",
                                   "endAt": "2026-10-20T15:00:00+09:00", "allDay": false, "source": "local", "completed": completed]
        if let importance { json["importance"] = importance }
        if let status { json["status"] = status }
        let data = try! JSONSerialization.data(withJSONObject: json)
        return try! JSONDecoder().decode(CalendarEvent.self, from: data)
    }

    func testImportantUsesStar() {
        XCTAssertEqual(CompletionMark.symbol(event(importance: "high")), "star")
        XCTAssertEqual(CompletionMark.symbol(event(importance: "high", completed: true)), "star.fill")
        XCTAssertEqual(CompletionMark.label(event(importance: "high")), "중요 일정, 완료로 표시")
        XCTAssertEqual(CompletionMark.label(event(importance: "high", completed: true)), "중요 일정, 완료 해제")
    }

    func testOthersKeepCircle() {
        for importance in [nil, "normal", "low"] {
            XCTAssertEqual(CompletionMark.symbol(event(importance: importance)), "circle")
            XCTAssertEqual(CompletionMark.symbol(event(importance: importance, completed: true)), "checkmark.circle.fill")
            XCTAssertEqual(CompletionMark.label(event(importance: importance)), "완료로 표시")
        }
    }

    func testArchivedImportantFallsBackToCircle() {
        let e = event(importance: "high", status: "archived")
        XCTAssertEqual(CompletionMark.symbol(e), "circle")
        XCTAssertEqual(CompletionMark.label(e), "완료로 표시")
    }
}
