import XCTest

/// 온보딩 마지막 '내 예약 링크 만들기' (1.6.0 ①) — 테스트 계정을 그 단계로 열고(기기 값), 무료 링크 'T41 테스트'를 만든 뒤
/// 공유 화면에서 링크 복사(처음 공유 기록) → 시작하기. 만든 링크·기록은 바깥에서 지운다.
final class OnboardingLinkUITests: XCTestCase {
    func testLinkStep() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let user = env["DEMO_USERNAME"] else { throw XCTSkip("DEMO_TOKEN·DEMO_USERNAME 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchArguments += ["-onboarding.step.\(user)", "link"]
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(n).png")) }
        let make = app.buttons["onboardingMakeLink"]
        XCTAssertTrue(make.waitForExistence(timeout: 20), "링크 만들기 단계가 안 뜸")
        XCTAssertTrue(app.buttons["onboardingSkipLink"].exists, "건너뛰기 없음")
        sleep(1)
        shot("1-link-step")
        make.tap()
        let title = app.textFields.firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.typeText("T41 테스트")
        app.buttons["만들기"].tap()
        let done = app.buttons["onboardingLinkDone"]
        XCTAssertTrue(done.waitForExistence(timeout: 15), "공유 화면으로 안 감")
        XCTAssertTrue(app.buttons["copyBioURL"].exists, "바이오 주소 복사 없음")
        sleep(1)
        shot("2-share")
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "링크 복사")).firstMatch.tap()
        sleep(2)
        done.tap()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 10), "시작하기 뒤 메인으로 안 감")
    }
}
