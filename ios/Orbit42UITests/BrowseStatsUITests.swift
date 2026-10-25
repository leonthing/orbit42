import XCTest

/// 1.8.0 둘러보기 집계 — DEBUG 앱은 기본으로 보내지 않고(BROWSE_STAT_TEST=1 일 때만), 보내면 탭 첫 진입·가입 시트 연 동작·닫음을 센다.
/// 실행: 로컬 서버(BROWSE_STAT_DEV=1) — 표 값은 바깥 스크립트가 확인하고 되돌린다.
final class BrowseStatsUITests: XCTestCase {
    private var app: XCUIApplication!

    private func run(statTest: Bool) {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        if statTest { app.launchEnvironment["BROWSE_STAT_TEST"] = "1" }
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        for name in ["예약", "오르빗", "리포트", "예약"] {   // 예약 두 번 — 첫 진입만 세야 한다
            let t = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
            XCTAssertTrue(t.waitForExistence(timeout: 10))
            t.tap()
            sleep(1)
        }
        app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "캘린더")).firstMatch.tap()
        let add = app.buttons["일정 추가"]
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        let title = app.textFields["제목"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.tap()
        title.typeText("집계 확인")
        app.buttons["저장"].tap()
        let keep = app.buttons["계속 둘러보기"]
        XCTAssertTrue(keep.waitForExistence(timeout: 5), "가입 안내 시트가 안 뜸")
        keep.tap()
        sleep(2)
    }

    func testDefaultDebugSendsNothing() throws { run(statTest: false) }
    func testStatTestSendsSteps() throws { run(statTest: true) }
}
