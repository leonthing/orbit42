import XCTest

/// 일정 상세의 '기록 더하기' 접기 (개선-36) — 둘러보기 예시 데이터로. TEST_RUNNER_SHOT_DIR
final class RecordsFoldUITests: XCTestCase {
    func testFold() throws {
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        app.launchArguments += ["-calendarScheduleMode", "month"]
        app.launch()
        let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(n).png")) }
        let login = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(login.waitForExistence(timeout: 15)); login.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        func open(_ title: String) {
            let row = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
            XCTAssertTrue(row.waitForExistence(timeout: 10), "\(title) 없음")
            row.tap()
        }
        func close() { app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "닫기", "Close")).firstMatch.tap(); sleep(1) }
        // 내일 일정(아직 안 지남) — 접힘, 수익 없음
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "26")).firstMatch.tap()
        sleep(1)
        open("저녁 약속")
        let add = app.buttons["addRecords"]
        for _ in 0..<4 where !add.exists { app.swipeUp() }
        XCTAssertTrue(add.waitForExistence(timeout: 5), "기록 더하기 없음")
        XCTAssertFalse(app.staticTexts["자산 분류"].exists, "자산 분류가 접히지 않음")
        shot("1-future-folded")
        add.tap()
        sleep(1)
        for _ in 0..<2 { app.swipeUp() }
        XCTAssertTrue(app.staticTexts["자산 분류"].waitForExistence(timeout: 5) || app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "자산 분류")).firstMatch.exists, "펼쳐도 자산 분류 없음")
        XCTAssertFalse(app.staticTexts["수익 기록"].exists, "앞으로의 일정에 수익 기록이 보임")
        shot("2-future-expanded")
        close()
        // 지난 날로 — 분류가 적힌 일정은 펼쳐져 있음
        app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "23")).firstMatch.tap()
        sleep(1)
        open("디자인 스터디")
        sleep(1)
        for _ in 0..<4 { app.swipeUp() }
        XCTAssertFalse(app.buttons["addRecords"].exists, "값이 있는데 접혀 있음")
        XCTAssertTrue(app.staticTexts["수익 기록"].exists || app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "수익 기록")).firstMatch.exists, "지난 일정에 수익 기록 없음")
        shot("3-past-with-value-expanded")
    }
}
