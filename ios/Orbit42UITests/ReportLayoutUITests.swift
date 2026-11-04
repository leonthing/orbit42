import XCTest

/// 리포트 기본 4장 + 더 보기 (개선-37). TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR, TEST_RUNNER_SHOT_PREFIX
final class ReportLayoutUITests: XCTestCase {
    func testReport() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let prefix = env["SHOT_PREFIX"] ?? "report"
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        if let base = env["API_BASE"] { app.launchEnvironment["API_BASE"] = base }
        app.launch()
        let later = app.buttons["지금은 안 함"]
        if later.waitForExistence(timeout: 6) { later.tap() }
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(prefix)-\(n).png")) }
        XCTAssertTrue(app.tabBars.buttons["리포트"].waitForExistence(timeout: 30))
        app.tabBars.buttons["리포트"].tap()
        // 앞선 실행에서 주·년 보기를 골라 두었으면 월로 돌린다(선택은 기기에 남는다)
        let monthSeg = app.segmentedControls["earnPeriodPicker"].buttons["월"]
        if monthSeg.waitForExistence(timeout: 10) { monthSeg.tap() }
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

    /// '번 돈' 카드 주·월·년 전환 + 다시 열어도 유지 (1.8.0). 서버에 periods 가 있어야 한다(로컬 API_BASE)
    func testEarnPeriods() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let prefix = env["SHOT_PREFIX"] ?? "period"
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        var app = XCUIApplication()
        func launch() {
            app = XCUIApplication()
            app.launchEnvironment["DEMO_TOKEN"] = token
            if let base = env["API_BASE"] { app.launchEnvironment["API_BASE"] = base }
            app.launch()
            let later = app.buttons["지금은 안 함"]
            if later.waitForExistence(timeout: 6) { later.tap() }
            XCTAssertTrue(app.tabBars.buttons["리포트"].waitForExistence(timeout: 30))
            app.tabBars.buttons["리포트"].tap()
        }
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(prefix)-\(n).png")) }
        launch()
        let picker = app.segmentedControls["earnPeriodPicker"]
        XCTAssertTrue(picker.waitForExistence(timeout: 15), "주·월·년 선택 없음")
        for (seg, title, name) in [("주", "이번 주 시간으로 번 돈", "week"), ("월", "이번 달 시간으로 번 돈", "month"), ("년", "올해 시간으로 번 돈", "year")] {
            picker.buttons[seg].tap()
            XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5), "\(seg) 보기 제목 없음")
            sleep(1)
            shot(name)
        }
        // 년을 고른 채로 다시 열면 년 보기 그대로
        app.terminate()
        launch()
        XCTAssertTrue(app.staticTexts["올해 시간으로 번 돈"].waitForExistence(timeout: 15), "다시 열었을 때 년 보기가 유지 안 됨")
        app.segmentedControls["earnPeriodPicker"].buttons["월"].tap()
        XCTAssertTrue(app.staticTexts["이번 달 시간으로 번 돈"].waitForExistence(timeout: 5))
    }
}
