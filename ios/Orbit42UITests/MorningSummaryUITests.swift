import XCTest

/// 아침 일정 요약 (1.6.0 ③) — 설정에서 켜고 시각을 보이고, 예약된 알림은 DEBUG 로그(O42PENDING)로 바깥에서 센다.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN(테스트 계정), TEST_RUNNER_SHOT_DIR.
final class MorningSummaryUITests: XCTestCase {
    func testMorningSummarySettingAndSchedule() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchEnvironment["DUMP_PENDING"] = "1"
        app.launch()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

        XCTAssertTrue(app.tabBars.buttons["프로필"].waitForExistence(timeout: 20))
        app.tabBars.buttons["프로필"].tap()
        app.buttons["설정"].firstMatch.tap()
        app.staticTexts["내 캘린더"].firstMatch.tap()
        let toggle = app.switches["morningSummaryToggle"]
        for _ in 0..<6 where !toggle.exists { app.swipeUp() }
        XCTAssertTrue(toggle.waitForExistence(timeout: 5), "아침 일정 요약 스위치 없음")
        XCTAssertEqual(toggle.value as? String, "1", "기본 켬이어야 함")
        // 껐다 켜면 알림 권한을 묻는다 — 허용
        toggle.switches.firstMatch.tap()
        toggle.switches.firstMatch.tap()
        let allow = springboard.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "허용", "Allow")).firstMatch
        if allow.waitForExistence(timeout: 5) { allow.tap() }
        sleep(1)
        XCTAssertTrue(app.staticTexts["요약 받을 시각"].exists || app.datePickers.firstMatch.exists, "시각 고르기 없음")
        shot(app, "1-setting")
        sleep(4)   // 다시 계산(0.8초 모음) + 로그
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
