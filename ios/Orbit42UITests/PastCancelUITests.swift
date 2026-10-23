import XCTest

/// 끝 시각이 지난 예약에는 '취소'가 없다 (개선-31) 캡처.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR, TEST_RUNNER_SHOT_PREFIX(host/guest)
/// 테스트 데이터: 10/15 확정(지난), 10/18 대기(지난, 응답 없이 지남), 11/20 확정, 11/22 대기.
final class PastCancelUITests: XCTestCase {
    func testNoCancelOnEnded() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let role = env["SHOT_PREFIX"] ?? "host"
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 30))
        app.tabBars.buttons["예약"].tap()
        let seg = app.segmentedControls.buttons[role == "host" ? "받은 예약" : "내가 한 예약"]
        XCTAssertTrue(seg.waitForExistence(timeout: 10))
        seg.tap()
        let lapsed = app.staticTexts["응답 없이 지남"].firstMatch
        scrollTo(app, lapsed)
        XCTAssertTrue(lapsed.waitForExistence(timeout: 15), "지난 대기 예약 표시가 없음")
        sleep(1)
        shot(app, env, "\(role)-1-list")

        for (day, name) in [("10월 15일", "2-past-confirmed-detail"), ("10월 18일", "3-past-pending-detail")] {
            let row = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", day)).firstMatch
            scrollTo(app, row)
            row.tap()
            XCTAssertTrue(app.navigationBars["예약 상세"].waitForExistence(timeout: 10))
            sleep(1)
            XCTAssertFalse(app.buttons["예약 취소"].exists, "\(day) 상세에 예약 취소가 보임")
            XCTAssertFalse(app.buttons["거절"].exists, "\(day) 상세에 거절이 보임")
            shot(app, env, "\(role)-\(name)")
            app.navigationBars.buttons.element(boundBy: 0).tap()
            sleep(1)
        }
    }

    private func scrollTo(_ app: XCUIApplication, _ element: XCUIElement) {
        var tries = 0
        while (!element.exists || !element.isHittable) && tries < 6 { app.swipeUp(); tries += 1 }
    }

    private func shot(_ app: XCUIApplication, _ env: [String: String], _ name: String) {
        let s = app.screenshot()
        let a = XCTAttachment(screenshot: s); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = env["SHOT_DIR"] {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("ios-\(name).png"))
        }
    }
}
