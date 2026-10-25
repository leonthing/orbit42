import XCTest

/// 아침 요약 기본값 (1.6.0 ③, CEO 의견) — 기존 사용자는 캘린더에서 한 번만 묻고, 새 가입자는 온보딩에서 고른다. 둘러보기에선 묻지 않는다.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN(테스트 계정), TEST_RUNNER_SHOT_DIR.
final class MorningAskUITests: XCTestCase {
    private func launch(token: String?, reset: Bool, extra: [String: String] = [:]) -> XCUIApplication {
        let app = XCUIApplication()
        if let token { app.launchEnvironment["DEMO_TOKEN"] = token }
        if reset { app.launchEnvironment["RESET_MORNING_ASKED"] = "1" }
        for (k, v) in extra { app.launchEnvironment[k] = v }
        app.launch()
        return app
    }

    /// 기존 사용자: 카드 → 괜찮아요 → 다시 켜도 안 나옴
    func testExistingUserAskedOnceDecline() throws {
        guard let token = ProcessInfo.processInfo.environment["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        var app = launch(token: token, reset: true)
        let card = app.descendants(matching: .any)["morningAskCard"]
        XCTAssertTrue(card.waitForExistence(timeout: 20), "기존 사용자에게 카드가 안 나옴")
        shot(app, "1-ask-card")
        app.buttons["morningAskNo"].tap()
        sleep(1)
        XCTAssertFalse(card.exists, "괜찮아요 뒤에도 카드가 남음")
        app.terminate()
        app = launch(token: token, reset: false)
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 20))
        sleep(3)
        XCTAssertFalse(app.descendants(matching: .any)["morningAskCard"].exists, "다시 켰는데 카드가 또 나옴")
        // 설정에서도 꺼져 있다
        XCTAssertEqual(morningToggleValue(app), "0")
    }

    /// 기존 사용자: 받기 → (권한 허용) → 설정에서 켜짐
    func testExistingUserAskedOnceAccept() throws {
        guard let token = ProcessInfo.processInfo.environment["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = launch(token: token, reset: true)
        let card = app.descendants(matching: .any)["morningAskCard"]
        XCTAssertTrue(card.waitForExistence(timeout: 20))
        app.buttons["morningAskYes"].tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "허용", "Allow")).firstMatch
        if allow.waitForExistence(timeout: 4) { allow.tap() }
        sleep(1)
        XCTAssertFalse(card.exists)
        XCTAssertEqual(morningToggleValue(app), "1", "받기 뒤 설정이 켜져야 함")
    }

    /// 둘러보기: 카드 없음
    func testBrowseNeverAsks() throws {
        let app = launch(token: nil, reset: true, extra: ["DEMO_LOGGED_OUT": "1"])
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 10))
        sleep(3)
        XCTAssertFalse(app.descendants(matching: .any)["morningAskCard"].exists, "둘러보기에서 카드가 나옴")
    }

    /// 새 가입자: 온보딩 알림 단계에 '아침 8시에 오늘 일정 요약 받기'(기본 체크) — 화면만 찍는다
    func testOnboardingNotificationStepShowsChoice() throws {
        guard let token = ProcessInfo.processInfo.environment["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = launch(token: token, reset: true, extra: ["DEMO_ONBOARDING_STEP": "notifications"])
        let choice = app.buttons["onboardingMorningSummary"]
        XCTAssertTrue(choice.waitForExistence(timeout: 20), "온보딩 알림 단계에 아침 요약 선택 없음")
        XCTAssertEqual(choice.value as? String, "선택됨", "기본 체크여야 함")
        XCTAssertTrue(choice.isHittable, "스크롤 없이 보여야 함")
        shot(app, "2-onboarding-notifications")
    }

    private func morningToggleValue(_ app: XCUIApplication) -> String? {
        app.tabBars.buttons["프로필"].tap()
        app.buttons["설정"].firstMatch.tap()
        app.staticTexts["내 캘린더"].firstMatch.tap()
        let toggle = app.switches["morningSummaryToggle"]
        for _ in 0..<6 where !toggle.exists { app.swipeUp() }
        _ = toggle.waitForExistence(timeout: 5)
        return toggle.value as? String
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
