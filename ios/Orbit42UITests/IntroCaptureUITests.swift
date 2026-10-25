import XCTest

/// 인트로 이미지 촬영 (개선-48) — 둘러보기 예시 데이터로, 띠 숨김. TEST_RUNNER_SHOT_DIR 에 저장.
final class IntroCaptureUITests: XCTestCase {
    func testCaptureIntroScreens() throws {
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        app.launch()
        let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ name: String) {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "아침 운동")).firstMatch.waitForExistence(timeout: 10))
        sleep(2)
        shot("intro-calendar")
        app.tabBars.buttons["예약"].tap()
        let received = app.segmentedControls.buttons["받은 예약"]
        if received.waitForExistence(timeout: 5) { received.tap() }
        sleep(2)
        shot("intro-bookings")
        app.tabBars.buttons["오르빗"].tap()
        sleep(3)
        shot("intro-orbit")
    }

    /// 인트로 다섯 장 — '다음'으로 넘기며 찍고, 마지막 장의 둘러보기 버튼까지
    func testIntroPages() throws {
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launch()
        let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] ?? NSTemporaryDirectory()
        let next = app.buttons["다음"]
        XCTAssertTrue(next.waitForExistence(timeout: 15))
        for i in 1...5 {
            sleep(1)
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("page\(i).png"))
            if i < 5 { app.buttons["다음"].tap() }
        }
        XCTAssertTrue(app.buttons["시작하기"].exists, "마지막 장에 시작하기 없음")
        let browse = app.buttons["introBrowse"]
        XCTAssertTrue(browse.exists, "마지막 장에 둘러보기 없음")
        XCTAssertTrue(app.windows.firstMatch.frame.contains(browse.frame), "둘러보기가 화면 밖")
        browse.tap()
        XCTAssertTrue(app.buttons["browseBannerSignup"].waitForExistence(timeout: 10), "둘러보기로 안 들어감")
    }
}
