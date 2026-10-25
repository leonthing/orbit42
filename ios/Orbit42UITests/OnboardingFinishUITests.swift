import XCTest

/// 온보딩 마지막 단계에서 끝내면(건너뛰기) 다음 실행에 다시 뜨지 않는지 — 실행 인자 없이 (1.6.0 ① 손질 확인)
final class OnboardingFinishUITests: XCTestCase {
    func testFinishPersists() throws {
        guard let token = ProcessInfo.processInfo.environment["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let skip = app.buttons["onboardingSkipLink"]
        if ProcessInfo.processInfo.environment["MODE"] == "create" {
            // 예시 고르기 → 만들기 → 공유 화면 → 시작하기 (링크 'T41 테스트'는 바깥에서 지움)
            let preset = app.buttons["preset-coffee"]
            XCTAssertTrue(preset.waitForExistence(timeout: 15)); preset.tap()
            let title = app.textFields.firstMatch
            XCTAssertTrue(title.waitForExistence(timeout: 5)); title.tap()
            title.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 12)); title.typeText("T41 테스트")
            app.buttons["만들기"].tap()
            let done = app.buttons["onboardingLinkDone"]
            XCTAssertTrue(done.waitForExistence(timeout: 15)); done.tap()
        } else if skip.waitForExistence(timeout: 15) { skip.tap() }
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 15), "끝낸 뒤 메인 없음")
        sleep(2)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 20), "다시 실행하니 메인이 아님")
        XCTAssertFalse(app.buttons["onboardingSkipLink"].exists, "다시 실행하니 온보딩이 또 뜸")
    }
}
