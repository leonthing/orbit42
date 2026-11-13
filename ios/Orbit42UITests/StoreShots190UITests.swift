import XCTest

/// 1.9.0 스토어 스크린샷 후보 2장 — 로컬 서버(NEXT_PUBLIC_V190_FORCE_OPEN=1) + 가상 이름 임시 계정(하린·도윤).
/// 둘러보기 예시 데이터에는 1:1 대화·할 일이 없어(둘러보기에선 닫힘) 임시 계정으로 찍고 바로 지운다.
///   TEST_RUNNER_ST_BASE=http://localhost:3001 TEST_RUNNER_ST_TOKEN=<토큰> xcodebuild test -only-testing:Orbit42UITests/StoreShots190UITests
final class StoreShots190UITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch() throws -> XCUIApplication {
        continueAfterFailure = true
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["ST_BASE"] ?? "http://localhost:3001"
        app.launchEnvironment["DEMO_TOKEN"] = try XCTUnwrap(env["ST_TOKEN"])
        app.launch()
        return app
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        sleep(2)
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    private func label(_ app: XCUIApplication, _ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    func testShots() throws {
        let app = try launch()
        // 후보 1: 1:1 대화방
        let tab = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "예약")).firstMatch
        XCTAssertTrue(tab.waitForExistence(timeout: 25))
        tab.tap()
        let seg = app.segmentedControls.buttons["대화"]
        XCTAssertTrue(seg.waitForExistence(timeout: 15))
        seg.tap()
        XCTAssertTrue(label(app, "도윤").waitForExistence(timeout: 10))
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "도윤")).firstMatch.tap()
        XCTAssertTrue(app.buttons["dmPeerLinks"].waitForExistence(timeout: 10))
        // 알림 권한 창이 뜨면 닫는다(스크린샷에 시스템 창이 찍히지 않게)
        let deny = XCUIApplication(bundleIdentifier: "com.apple.springboard").buttons["허용 안 함"]
        if deny.waitForExistence(timeout: 5) { deny.tap() }
        app.swipeDown()
        shot(app, "s190-1-dm")
        // 후보 2: 끝난 일정의 후속 칸
        app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "캘린더")).firstMatch.tap()
        XCTAssertTrue(app.buttons["calendar.todos"].waitForExistence(timeout: 15))
        if app.buttons["월 보기"].exists { app.buttons["월 보기"].tap() }
        let ev = app.staticTexts.matching(NSPredicate(format: "label == %@", "브랜드 디자인 리뷰")).firstMatch
        XCTAssertTrue(ev.waitForExistence(timeout: 10))
        ev.tap()
        XCTAssertTrue(app.buttons["followUp.addTodo"].waitForExistence(timeout: 10))
        shot(app, "s190-2-followups")
    }
}
