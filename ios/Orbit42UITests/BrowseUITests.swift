import XCTest

/// 가입 없이 둘러보기 (개선-47) — 로그인 화면 → 둘러보기 → 각 탭 → 저장 동작 → 가입 안내 → 가입 폼.
/// 실행: TEST_RUNNER_DEMO_LOGGED_OUT=1, TEST_RUNNER_SHOT_DIR. 서버 요청은 바깥에서 로컬 서버 로그로 센다.
final class BrowseUITests: XCTestCase {
    private var app: XCUIApplication!

    func testBrowseTabsAndSignupPrompt() throws {
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launch()

        // 인트로 → 로그인 화면
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10), "둘러보기 버튼 없음")
        sleep(1)
        shot("0-login")
        // 스크롤 없이 보이는지 (iPhone SE 확인용)
        let visible = app.windows.firstMatch.frame.contains(browse.frame)
        print("BROWSE_BUTTON_VISIBLE=\(visible)")
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? "\(visible)".write(toFile: "\(dir)/button_visible", atomically: true, encoding: .utf8)
        }
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        mark("BROWSE_BEGIN")
        browse.tap()

        // 캘린더 — 예시 일정 + 위 띠
        XCTAssertTrue(app.buttons["browseBannerSignup"].waitForExistence(timeout: 10), "둘러보기 띠 없음")
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "브랜드 시안 작업")).firstMatch.waitForExistence(timeout: 10), "예시 일정 없음")
        sleep(1)
        shot("1-calendar")

        // 예약 — 받은 예약 / 예약 링크
        app.tabBars.buttons["예약"].tap()
        sleep(2)
        shot("2-bookings")
        let links = app.segmentedControls.buttons["예약 링크"]
        if links.waitForExistence(timeout: 5) {
            links.tap()
            sleep(2)
            shot("2b-links")
            // 공개 페이지 미리보기 (게스트에게 보이는 화면)
            let coffee = app.staticTexts["커피챗 30분"].firstMatch
            if coffee.waitForExistence(timeout: 5) {
                coffee.tap()
                sleep(2)
                XCTAssertTrue(app.otherElements["guestPreviewHint"].exists || app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "손님에게 이렇게 보여요")).firstMatch.exists, "손님 화면 안내 없음")
                shot("2c-preview")
                app.navigationBars.buttons.element(boundBy: 0).tap()
                sleep(1)
            }
        }
        app.tabBars.buttons["오르빗"].tap()
        sleep(2)
        shot("2d-orbit")

        // 오르빗 · 리포트 · 프로필
        app.tabBars.buttons["리포트"].tap()
        sleep(2)
        shot("3-report")
        app.tabBars.buttons["프로필"].tap()
        sleep(2)
        shot("3b-profile")
        // 프로필 → 내 공개 페이지 보기 → 손님 화면
        let publicPage = app.staticTexts["내 공개 페이지 보기"].firstMatch
        if publicPage.waitForExistence(timeout: 5) {
            publicPage.tap()
            sleep(2)
            shot("3c-guest-profile")
            app.navigationBars.buttons.element(boundBy: 0).tap()
            sleep(1)
        }

        // 저장하는 동작 — 캘린더에서 새 일정 저장 → 가입 안내
        app.tabBars.buttons["캘린더"].tap()
        sleep(1)
        let add = app.buttons["일정 추가"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 5), "추가 버튼 없음")
        add.tap()
        let title = app.textFields["제목"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("둘러보기 일정")
        app.buttons["저장"].firstMatch.tap()
        let signup = app.buttons["browseSignup"]
        XCTAssertTrue(signup.waitForExistence(timeout: 5), "가입 안내 시트 없음")
        sleep(1)
        shot("4-prompt")
        mark("BROWSE_END")
        signup.tap()

        // 가입 폼(평소 흐름)
        XCTAssertTrue(app.buttons["browseStart"].waitForExistence(timeout: 10), "로그인 화면으로 안 돌아옴")
        XCTAssertFalse(app.buttons["browseBannerSignup"].exists, "둘러보기 띠가 남음")
        XCTAssertTrue(app.textFields.containing(NSPredicate(format: "placeholderValue CONTAINS %@", "이메일")).firstMatch.exists
                      || app.buttons["가입하기"].exists, "가입 폼 아님")
        sleep(1)
        shot("5-signup")
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    /// 바깥 스크립트가 서버 로그를 자를 수 있게 시각을 남긴다
    private func mark(_ name: String) {
        guard let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] else { return }
        try? "\(Date().timeIntervalSince1970)".write(toFile: "\(dir)/\(name)", atomically: true, encoding: .utf8)
    }
}
