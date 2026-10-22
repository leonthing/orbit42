import XCTest

/// 가입 직후 빈 캘린더의 "다음에 할 일" 카드 (개선-22).
/// 실행: 로컬 서버 + 일정·링크 0·구글 미연결 새 계정의 TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR(캡처 저장 폴더)
/// 앱을 지웠다 다시 깐 상태에서 돌린다(카드 판단은 계정별로 기기에 한 번 기록된다).
final class GettingStartedUITests: XCTestCase {
    private var shotDir: String?

    func testGettingStartedButtons() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()

        XCTAssertTrue(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 30), "카드가 안 뜸")
        sleep(1)
        shot(app, "1-calendar-card")

        // ② 첫 일정 만들기 → 새 일정 화면
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "첫 일정 만들기")).firstMatch.tap()
        XCTAssertTrue(app.navigationBars["새 일정"].waitForExistence(timeout: 10), "새 일정 화면이 안 열림")
        sleep(1)
        shot(app, "2-add-event")
        app.navigationBars["새 일정"].buttons["취소"].tap()

        // ③ 예약 링크 만들기 → 예약 탭 · 새 예약 링크 화면
        let linkButton = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "예약 링크 만들기")).firstMatch
        XCTAssertTrue(linkButton.waitForExistence(timeout: 10))
        linkButton.tap()
        XCTAssertTrue(app.navigationBars["새 예약 링크"].waitForExistence(timeout: 10), "새 예약 링크 화면이 안 열림")
        sleep(1)
        shot(app, "3-new-link-from-card")
        app.navigationBars["새 예약 링크"].buttons["취소"].tap()

        // 받은 예약 빈 화면의 버튼
        app.segmentedControls.buttons["받은 예약"].tap()
        let emptyButton = app.buttons["예약 링크 만들기"]
        XCTAssertTrue(emptyButton.waitForExistence(timeout: 15), "받은 예약 빈 화면 버튼 없음")
        sleep(1)
        shot(app, "4-received-empty")
        emptyButton.tap()
        XCTAssertTrue(app.navigationBars["새 예약 링크"].waitForExistence(timeout: 10), "빈 화면 버튼으로 새 예약 링크가 안 열림")
        sleep(1)
        shot(app, "5-new-link-from-empty")
        app.navigationBars["새 예약 링크"].buttons["취소"].tap()

        // ① 구글 캘린더 연결 → 시스템 로그인 확인 창까지 (실제 로그인은 하지 않는다)
        app.tabBars.buttons["캘린더"].tap()
        let google = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "구글 캘린더 연결하기")).firstMatch
        XCTAssertTrue(google.waitForExistence(timeout: 10))
        google.tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let prompt = springboard.alerts.firstMatch
        XCTAssertTrue(prompt.waitForExistence(timeout: 15), "구글 로그인 확인 창이 안 뜸")
        shot(springboard, "6-google-prompt")
        prompt.buttons.element(boundBy: 0).tap() // 취소
        XCTAssertTrue(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 10), "취소 뒤 카드가 사라짐")
    }

    /// 첫 테스트 뒤(앱을 지우지 않고) 이어서 — 일정과 링크를 실제로 만들면 그 항목이 빠진다.
    func testDoneItemsDrop() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 30), "카드가 안 뜸")

        // 첫 일정 저장
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "첫 일정 만들기")).firstMatch.tap()
        let titleField = app.textFields["제목"]
        XCTAssertTrue(titleField.waitForExistence(timeout: 10))
        titleField.tap()
        titleField.typeText("GS22 테스트 일정")
        app.navigationBars["새 일정"].buttons["저장"].tap()
        let left = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "1/3 완료")).firstMatch
        XCTAssertTrue(left.waitForExistence(timeout: 20), "일정을 만든 뒤 1/3 이 안 됨")
        XCTAssertFalse(app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "첫 일정 만들기")).firstMatch.exists)
        sleep(1)
        shot(app, "7-after-event")

        // 예약 링크 — 새 예약 링크 화면은 닫고 빈 화면의 템플릿(커피챗)으로 만든다
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "예약 링크 만들기")).firstMatch.tap()
        XCTAssertTrue(app.navigationBars["새 예약 링크"].waitForExistence(timeout: 10))
        app.navigationBars["새 예약 링크"].buttons["취소"].tap()
        let coffee = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "커피챗")).firstMatch
        XCTAssertTrue(coffee.waitForExistence(timeout: 10))
        coffee.tap()
        sleep(3)
        if app.buttons["나중에"].exists { app.buttons["나중에"].tap() }
        app.tabBars.buttons["캘린더"].tap()
        let two = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "2/3 완료")).firstMatch
        XCTAssertTrue(two.waitForExistence(timeout: 20), "링크를 만든 뒤 2/3 이 안 됨")
        XCTAssertFalse(app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "예약 링크 만들기")).firstMatch.exists)
        sleep(1)
        shot(app, "8-after-link")

        // 닫으면 사라지고 다시 열어도 안 뜬다
        app.buttons["다음에 할 일 닫기"].tap()
        XCTAssertFalse(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 3))
        app.terminate()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 8), "닫은 뒤 다시 뜸")
        shot(app, "9-dismissed")
    }

    /// 일정이 있는 기존 계정 — 카드가 뜨지 않는다.
    func testExistingAccountUnchanged() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 10), "기존 계정에 카드가 뜸")
        XCTAssertFalse(app.staticTexts["시작하기 전에"].exists, "기존 계정에 온보딩이 뜸 (개선-23)")
        shot(app, "10-existing-account")
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let s = app.screenshot()
        let a = XCTAttachment(screenshot: s)
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = shotDir {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
