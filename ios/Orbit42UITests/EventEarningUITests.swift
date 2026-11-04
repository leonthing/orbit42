import XCTest

/// 일정 추가·수정 '금액' + 하루 보기 블록 금액 (1.8.0, Leo 11/4).
/// 실행: 로컬 서버(API_BASE) + TEST_RUNNER_DEMO_TOKEN(테스트 계정), TEST_RUNNER_API_BASE,
/// TEST_RUNNER_EARN_DATE(yyyy-MM-dd), TEST_RUNNER_EARN_TITLE, TEST_RUNNER_EARN_CAL(캘린더 이름, 비우면 기본),
/// TEST_RUNNER_EARN_KEEP=1 이면 마지막 '지우기' 단계를 건너뛴다(리포트 캡처용), TEST_RUNNER_SHOT_DIR.
final class EventEarningUITests: XCTestCase {
    private var app: XCUIApplication!
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var shotPrefix = "earn"

    func testEarningAddEditClear() throws {
        guard let token = env["DEMO_TOKEN"], let date = env["EARN_DATE"], let title = env["EARN_TITLE"] else {
            throw XCTSkip("DEMO_TOKEN·EARN_DATE·EARN_TITLE 필요")
        }
        shotPrefix = env["SHOT_PREFIX"] ?? "earn"
        launch(token: token, date: date)
        if env["EARN_CLEAR_ONLY"] == "1" {
            try clearStep(title)
            return
        }

        // 1) 추가 — 금액 줄에 30000 → 30,000
        let add = app.buttons["일정 추가"]
        XCTAssertTrue(add.waitForExistence(timeout: 20), "일정 추가 버튼 없음")
        add.tap()
        let titleField = app.textFields["제목"]
        XCTAssertTrue(titleField.waitForExistence(timeout: 10))
        titleField.tap()
        titleField.typeText(title)
        if let cal = env["EARN_CAL"], !cal.isEmpty {
            let chip = app.buttons[cal]
            XCTAssertTrue(chip.waitForExistence(timeout: 10), "캘린더 칩 \(cal) 없음")
            chip.tap()
        }
        let earning = app.textFields["earningField"]
        for _ in 0..<4 where !earning.isHittable { app.swipeUp() }
        XCTAssertTrue(earning.waitForExistence(timeout: 5), "추가 화면에 금액 줄 없음")
        earning.tap()
        earning.typeText("30000")
        XCTAssertEqual(earning.value as? String, "30,000", "천 단위 쉼표")
        shot("1-add")
        app.navigationBars.buttons["저장"].tap()

        // 2) 하루 보기 블록에 ₩30,000
        XCTAssertTrue(blockEarning("₩30,000").waitForExistence(timeout: 20), "블록에 금액 없음")
        sleep(1)
        shot("2-day")

        // 3) 상세 — 수익 기록 ₩30,000
        openBlock(title)
        XCTAssertTrue(app.staticTexts["₩30,000"].waitForExistence(timeout: 10), "상세에 금액 없음")
        shot("3-detail")

        // 4) 수정 — 30,000 이 채워져 있고 50,000 으로 바꾼다
        app.buttons["수정"].firstMatch.tap()
        let editField = app.textFields["earningField"]
        for _ in 0..<6 where !editField.isHittable { app.swipeUp() }
        XCTAssertEqual(editField.value as? String, "30,000", "수정 화면에 기존 금액")
        replace(editField, with: "50000")
        shot("4-edit")
        app.navigationBars.buttons["저장"].tap()
        XCTAssertTrue(blockEarning("₩50,000").waitForExistence(timeout: 20), "수정한 금액이 블록에 안 보임")

        // 5) 다시 열어도 그대로
        app.terminate()
        launch(token: token, date: date)
        XCTAssertTrue(blockEarning("₩50,000").waitForExistence(timeout: 20), "다시 열었을 때 금액이 없음")

        if env["EARN_KEEP"] == "1" { return }
        try clearStep(title)
    }

    /// 6) 지우기 — 수정에서 칸을 비우면 기록 없음 (옆 날 블록과 헷갈리지 않게 이 일정 블록 안에서 찾는다)
    private func clearStep(_ title: String) throws {
        XCTAssertTrue(blockEarning("₩50,000").waitForExistence(timeout: 20), "지우기 전 금액 없음")
        openBlock(title)
        app.buttons["수정"].firstMatch.tap()
        let clearField = app.textFields["earningField"]
        for _ in 0..<6 where !clearField.isHittable { app.swipeUp() }
        replace(clearField, with: "")
        app.navigationBars.buttons["저장"].tap()
        let gone = NSPredicate(format: "exists == false")
        expectation(for: gone, evaluatedWith: blockEarning("₩50,000"))
        waitForExpectations(timeout: 20)
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch.exists)
    }

    /// 하루 보기 캡처 — EARN_DATE 에 금액 일정을 미리 넣어 두고 블록이 화면에 나온 모습을 찍는다
    func testDayShot() throws {
        guard let token = env["DEMO_TOKEN"], let date = env["EARN_DATE"] else { throw XCTSkip("DEMO_TOKEN·EARN_DATE 필요") }
        shotPrefix = env["SHOT_PREFIX"] ?? "day"
        launch(token: token, date: date)
        XCTAssertTrue(app.staticTexts.matching(identifier: "blockEarning").firstMatch.waitForExistence(timeout: 20), "블록 금액 없음")
        sleep(2)
        shot("day")
    }

    /// 리포트 '이번 달 시간으로 번 돈' 캡처 — 금액 넣기 전·후 (SHOT_PREFIX 로 구분)
    func testReportShot() throws {
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotPrefix = env["SHOT_PREFIX"] ?? "report"
        app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        if let base = env["API_BASE"] { app.launchEnvironment["API_BASE"] = base }
        app.launch()
        dismissAlerts()
        XCTAssertTrue(app.tabBars.buttons["리포트"].waitForExistence(timeout: 30))
        app.tabBars.buttons["리포트"].tap()
        XCTAssertTrue(app.staticTexts["이번 달 시간으로 번 돈"].waitForExistence(timeout: 15), "번 돈 카드 없음")
        sleep(2)
        shot("report")
    }

    private func launch(token: String, date: String) {
        app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        if let base = env["API_BASE"] { app.launchEnvironment["API_BASE"] = base }
        app.launch()
        dismissAlerts()
        app.open(URL(string: "orbit42://calendar?date=\(date)")!)
        let parts = date.split(separator: "-").compactMap { Int($0) }
        let header = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "\(parts[1])월 \(parts[2])일")).firstMatch
        XCTAssertTrue(header.waitForExistence(timeout: 20), "하루 보기 날짜가 \(date) 아님")
    }

    /// 처음 실행 안내(구글 일정 알림 등) — 이 기기 설정만 바뀐다
    private func dismissAlerts() {
        let later = app.buttons["지금은 안 함"]
        if later.waitForExistence(timeout: 6) { later.tap() }
    }

    private func blockEarning(_ label: String) -> XCUIElement {
        app.staticTexts.matching(identifier: "blockEarning").matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func openBlock(_ title: String) {
        let block = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
        XCTAssertTrue(block.waitForExistence(timeout: 20), "테스트 일정이 안 보임")
        // 날짜를 연 직후 자동 스크롤 중에는 탭을 무시한다 — 잠시 뒤 누르고, 안 열리면 한 번 더
        sleep(2)
        block.tap()
        if !app.buttons["수정"].firstMatch.waitForExistence(timeout: 4) { block.tap() }
        XCTAssertTrue(app.buttons["수정"].firstMatch.waitForExistence(timeout: 10), "상세가 안 열림")
        let more = app.buttons["addRecords"]
        if more.exists { more.tap() }
    }

    private func replace(_ field: XCUIElement, with text: String) {
        // 커서를 끝에 두려고 오른쪽 끝을 누른다(가운데를 누르면 지우기가 중간부터 됨)
        field.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.5)).tap()
        let current = (field.value as? String) ?? ""
        // 사람이 누르듯 한 번씩 — 쉼표를 다시 붙이는 동안 연달아 보내면 일부가 빠진다
        for _ in 0..<(current.count + 1) {
            field.typeText(XCUIKeyboardKey.delete.rawValue)
            usleep(100_000)
        }
        XCTAssertEqual((field.value as? String).map { $0 == "없음" ? "" : $0 } ?? "", "", "다 지워지지 않음: \(field.value ?? "")")
        if !text.isEmpty { field.typeText(text) }
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = env["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(
                to: URL(fileURLWithPath: dir).appendingPathComponent("\(shotPrefix)-\(name).png"))
        }
    }
}
