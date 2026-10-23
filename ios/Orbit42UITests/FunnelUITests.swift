import XCTest

/// 앱 예약 경로의 방문 흐름 집계 (개선-32) — 프로필 → 예약 링크 → 시간 고름 → 예약.
/// 실행: 로컬 서버 + 게스트 TEST_RUNNER_DEMO_TOKEN (호스트와 예약 1건이 있는 계정), TEST_RUNNER_SHOT_DIR.
final class FunnelUITests: XCTestCase {
    func testAppFunnelPath() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 30))
        app.tabBars.buttons["예약"].tap()
        let seg = app.segmentedControls.buttons["내가 한 예약"]
        XCTAssertTrue(seg.waitForExistence(timeout: 10))
        seg.tap()
        let row = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "11월 20일")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15))
        row.tap()
        // ① 호스트 프로필
        let host = app.staticTexts["김호스트"].firstMatch
        XCTAssertTrue(host.waitForExistence(timeout: 10))
        host.tap()
        XCTAssertTrue(app.navigationBars["@f32host"].waitForExistence(timeout: 15), "호스트 프로필이 안 열림")
        sleep(2)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        // ② 예약 링크
        let link = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "예약 링크 보기")).firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 10))
        link.tap()
        // ③ 시간 고름
        let chip = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", ":00")).firstMatch
        XCTAssertTrue(chip.waitForExistence(timeout: 15), "시간 선택지가 없음")
        sleep(2)
        chip.tap()
        // ④ 예약
        let book = app.buttons["예약하기"]
        XCTAssertTrue(book.waitForExistence(timeout: 10))
        book.tap()
        sleep(4)
        let s = app.screenshot()
        if let dir = env["SHOT_DIR"] {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("ios-booked.png"))
        }
    }
}
