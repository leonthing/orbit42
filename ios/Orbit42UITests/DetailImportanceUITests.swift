import XCTest

/// 일정 상세 '중요도' 줄 (개선-21) — 상세에서 중요함을 고르면 닫았을 때 하루 보기 체크 자리가 별.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_IMP_DATE(yyyy-MM-dd), TEST_RUNNER_IMP_TITLE
final class DetailImportanceUITests: XCTestCase {
    func testSetImportantFromDetail() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let date = env["IMP_DATE"], let title = env["IMP_TITLE"] else {
            throw XCTSkip("DEMO_TOKEN·IMP_DATE·IMP_TITLE 필요")
        }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        app.open(URL(string: "orbit42://calendar?date=\(date)")!)

        // 엉뚱한 날의 일정을 누르지 않게 머리 날짜부터 확인
        let parts = date.split(separator: "-").compactMap { Int($0) }
        let header = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "\(parts[1])월 \(parts[2])일")).firstMatch
        XCTAssertTrue(header.waitForExistence(timeout: 20), "하루 보기 날짜가 \(date) 아님")

        let block = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
        XCTAssertTrue(block.waitForExistence(timeout: 20), "테스트 일정이 안 보임")
        block.tap()

        let row = app.buttons["detail.importance"]
        XCTAssertTrue(row.waitForExistence(timeout: 10), "상세에 중요도 줄 없음")
        XCTAssertTrue(row.label.contains("보통"), "처음엔 보통: \(row.label)")
        row.tap()
        let high = app.buttons["중요함"]
        XCTAssertTrue(high.waitForExistence(timeout: 5), "중요함 선택지 없음")
        high.tap()

        let saved = NSPredicate(format: "label CONTAINS %@", "중요함")
        expectation(for: saved, evaluatedWith: row)
        waitForExpectations(timeout: 10)
        XCTAssertTrue(app.staticTexts["알림: 30분·10분 전 (중요함 기본값)"].waitForExistence(timeout: 5), "알림 줄이 중요함 기본값으로 안 바뀜")
        sleep(1)
        attach(app, "1-detail-importance")

        app.buttons["닫기"].tap()
        let star = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "중요 일정")).firstMatch
        XCTAssertTrue(star.waitForExistence(timeout: 10), "하루 보기 체크 자리가 별로 안 바뀜")
        sleep(1)
        attach(app, "2-day-star")
    }

    private func attach(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
