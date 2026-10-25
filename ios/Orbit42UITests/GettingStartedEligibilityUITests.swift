import XCTest

/// '다음에 할 일' 카드 대상 (개선-35) — 가입 14일 안이면 일정이 있어도(구글 연결) 보이고, 닫은 뒤 예약 탭 빈 화면에서 다시 연다.
/// 오래된 계정에는 저절로 뜨지 않는다. 실행: TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_EXPECT(new|old), TEST_RUNNER_SHOT_DIR
final class GettingStartedEligibilityUITests: XCTestCase {
    func testEligibility() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let expect = env["EXPECT"] else { throw XCTSkip("DEMO_TOKEN·EXPECT 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchEnvironment["RESET_GETTING_STARTED"] = "1"
        app.launchArguments += ["-calendarScheduleMode", "month"]
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(expect)-\(n).png")) }
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 30))
        let card = app.staticTexts["다음에 할 일"]
        if expect == "old" {
            sleep(6)
            shot("1-no-card")
            XCTAssertFalse(card.exists, "오래된 계정에 카드가 뜸")
            return
        }
        XCTAssertTrue(card.waitForExistence(timeout: 15), "새 가입자에게 카드가 안 뜸")
        sleep(1)
        shot("1-card")
        app.buttons["다음에 할 일 닫기"].tap()
        XCTAssertTrue(card.waitForNonExistence(timeout: 5), "닫아도 남음")
        app.tabBars.buttons["예약"].tap()
        let received = app.segmentedControls.buttons["받은 예약"]
        if received.waitForExistence(timeout: 5) { received.tap() }
        let reopen = app.buttons["reopenGettingStarted"]
        XCTAssertTrue(reopen.waitForExistence(timeout: 10), "다시 보기 버튼 없음")
        sleep(1)
        shot("2-reopen-button")
        reopen.tap()
        XCTAssertTrue(card.waitForExistence(timeout: 10), "다시 열어도 카드 없음")
        sleep(1)
        shot("3-card-again")
    }
}
