import XCTest

/// 리포트 기본 4장 + 더 보기 (개선-37). TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR, TEST_RUNNER_SHOT_PREFIX
final class ReportLayoutUITests: XCTestCase {
    func testReport() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let prefix = env["SHOT_PREFIX"] ?? "report"
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(prefix)-\(n).png")) }
        XCTAssertTrue(app.tabBars.buttons["리포트"].waitForExistence(timeout: 30))
        app.tabBars.buttons["리포트"].tap()
        XCTAssertTrue(app.staticTexts["이번 달 시간으로 번 돈"].waitForExistence(timeout: 15), "번 돈 카드 없음")
        sleep(2)
        shot("1-main")
        let more = app.buttons["reportMore"]
        for _ in 0..<5 where !more.isHittable { app.swipeUp() }
        sleep(1)
        shot("2-bottom")
        more.tap()
        sleep(1)
        app.swipeUp()
        sleep(1)
        shot("3-more")
    }
}
