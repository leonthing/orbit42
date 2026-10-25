import XCTest

/// 1.7.0 "이번 주 빈 시간" 공유 카드 — 둘러보기 예시(서버 불필요).
/// SHARECARD_SHOT_DIR 에 실제 내보내는 카드 이미지(2크기 × 3테마)가 그대로 저장된다. 화면 캡처는 SHOT_DIR.
final class ShareCardUITests: XCTestCase {
    private var app: XCUIApplication!

    private func launch(_ extra: [String: String] = [:]) {
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        let env = ProcessInfo.processInfo.environment
        if let dir = env["SHARECARD_SHOT_DIR"] { app.launchEnvironment["SHARECARD_SHOT_DIR"] = dir }
        for (k, v) in extra { app.launchEnvironment[k] = v }
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        let tab = app.tabBars.buttons["예약"].exists ? app.tabBars.buttons["예약"] : app.buttons.matching(NSPredicate(format: "label == %@", "예약")).firstMatch
        XCTAssertTrue(tab.waitForExistence(timeout: 10))
        tab.tap()
        sleep(1)
        app.segmentedControls.buttons["예약 링크"].tap()
        sleep(1)
    }

    private func openCard(_ title: String) {
        let share = app.buttons["\(title) 공유"]
        XCTAssertTrue(share.waitForExistence(timeout: 10))
        share.tap()
        let item = app.buttons["이번 주 빈 시간 카드"]
        XCTAssertTrue(item.waitForExistence(timeout: 5))
        item.tap()
    }

    func testCardsAllSizesAndThemes() throws {
        launch()
        openCard("커피챗 30분")
        XCTAssertTrue(app.images["shareCardPreview"].waitForExistence(timeout: 10), "카드 미리보기 없음")
        for size in ["스토리 9:16", "정사각 1:1"] {
            app.segmentedControls.buttons[size].tap()
            for theme in ["violet", "paper", "midnight"] {
                app.buttons["shareCardTheme.\(theme)"].tap()
                sleep(1)
            }
        }
        app.segmentedControls.buttons["스토리 9:16"].tap()
        app.buttons["shareCardTheme.violet"].tap()
        sleep(1)
        shot("card-composer")
        // 공유 시트가 뜬다(이미지 + 링크)
        app.buttons["shareCardShare"].tap()
        sleep(2)
        shot("card-share-sheet")
    }

    func testLongNameManyRanges() throws {
        launch(["SHARECARD_LONG_NAME": "1"])
        openCard("포트폴리오 멘토링 60분")
        XCTAssertTrue(app.images["shareCardPreview"].waitForExistence(timeout: 10))
        sleep(1)
        shot("card-longname-story")
        app.segmentedControls.buttons["정사각 1:1"].tap()
        sleep(1)
        shot("card-longname-square")
    }

    func testEmptyWeek() throws {
        launch(["SHARECARD_EMPTY": "1"])
        openCard("커피챗 30분")
        XCTAssertTrue(app.staticTexts["이번 주는 열린 시간이 없어요. 가능한 시간을 늘려 볼까요?"].waitForExistence(timeout: 10))
        shot("card-empty")
        app.buttons["shareCardEdit"].tap()
        XCTAssertTrue(app.staticTexts["길이"].waitForExistence(timeout: 10), "편집 화면으로 안 감")
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
