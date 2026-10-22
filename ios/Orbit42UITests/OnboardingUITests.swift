import XCTest

/// 줄인 온보딩 + 중간에 꺼도 이어지기 (개선-23).
/// 실행: 로컬 서버. 앱을 지웠다 다시 깐 상태에서 돌린다.
/// - testEmailSignup: TEST_RUNNER_DEMO_TOKEN (이메일 미인증 새 계정)·EXPECTED_NAME(아이디)
/// - testAppleLikeSignup: TEST_RUNNER_DEMO_TOKEN (이메일 인증된 새 계정)·EXPECTED_NAME(가입 이름)
/// 둘 다 DEMO_ONBOARDING=1 로 '방금 가입'처럼 연다.
/// 공통: TEST_RUNNER_SHOT_DIR(캡처 저장 폴더)
final class OnboardingUITests: XCTestCase {
    private var shotDir: String?
    private var prefix = ""

    /// 이메일 가입(표시 이름 없이 — 앱 가입 폼과 같음) 계정. 가입 폼 자동 입력은 시뮬레이터의 '강력한 암호' 제안이 막아서
    /// 가입은 API 로 하고, DEMO_ONBOARDING=1 로 '방금 가입'처럼 연다.
    func testEmailSignup() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let username = env["EXPECTED_NAME"] else { throw XCTSkip("DEMO_TOKEN·EXPECTED_NAME 필요") }
        shotDir = env["SHOT_DIR"]; prefix = "email"
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchEnvironment["DEMO_ONBOARDING"] = "1"
        app.launch()

        consent(app)
        profile(app, expectedName: username)
        calendarStepThenRelaunch(app)
        notifications(app)

        // 이메일 가입자만 마지막에 메일 인증
        XCTAssertTrue(app.staticTexts["이메일을 인증해 주세요"].waitForExistence(timeout: 10), "메일 인증 단계 없음")
        shot(app, "5-verify-email")
        app.buttons["나중에 하기"].tap()

        cardAfterOnboarding(app)
    }

    func testAppleLikeSignup() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]; prefix = "apple"
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchEnvironment["DEMO_ONBOARDING"] = "1"
        app.launch()

        consent(app)
        profile(app, expectedName: env["EXPECTED_NAME"])
        calendarStepThenRelaunch(app)
        notifications(app)
        // 이메일 인증된 가입(Apple·구글)은 메일 단계 없이 바로 끝
        XCTAssertFalse(app.staticTexts["이메일을 인증해 주세요"].exists)
        cardAfterOnboarding(app)
    }

    // MARK: - 단계

    private func consent(_ app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts["시작하기 전에"].waitForExistence(timeout: 30), "동의 단계가 안 뜸")
        sleep(1)
        shot(app, "1-consent")
        app.buttons["이용약관과 개인정보처리방침에 모두 동의합니다"].tap()
        app.buttons["동의하고 계속"].tap()
    }

    private func profile(_ app: XCUIApplication, expectedName: String?) {
        XCTAssertTrue(app.staticTexts["이 이름으로 시작할까요?"].waitForExistence(timeout: 10), "이름 확인 단계가 안 뜸")
        if let expectedName {
            let field = app.textFields["표시 이름"]
            XCTAssertEqual(field.value as? String, expectedName, "이름이 가입 정보로 안 채워짐")
        }
        sleep(1)
        shot(app, "2-name")
        app.buttons["이대로 시작"].tap()
    }

    /// 캘린더 단계에서 앱을 끄고 다시 켜면 캘린더 단계부터
    private func calendarStepThenRelaunch(_ app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts["캘린더를 연결해 주세요"].waitForExistence(timeout: 15), "캘린더 단계가 안 뜸")
        sleep(1)
        shot(app, "3-calendar")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts["캘린더를 연결해 주세요"].waitForExistence(timeout: 30), "재실행 뒤 캘린더 단계로 안 이어짐")
        XCTAssertFalse(app.staticTexts["시작하기 전에"].exists)
        sleep(1)
        shot(app, "3b-calendar-after-relaunch")
        app.buttons["기본 캘린더로 시작하기"].tap()
    }

    private func notifications(_ app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts["알림을 켜 주세요"].waitForExistence(timeout: 10), "알림 단계가 안 뜸")
        sleep(1)
        shot(app, "4-notifications")
        app.buttons["나중에 할게요"].tap()
    }

    private func cardAfterOnboarding(_ app: XCUIApplication) {
        XCTAssertTrue(app.staticTexts["다음에 할 일"].waitForExistence(timeout: 30), "온보딩 뒤 다음에 할 일 카드가 안 뜸")
        sleep(1)
        shot(app, "6-main-card")
        // 끝낸 뒤 다시 켜도 온보딩이 다시 뜨지 않는다
        app.terminate()
        app.launchEnvironment["DEMO_ONBOARDING"] = nil
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 30))
        XCTAssertFalse(app.staticTexts["시작하기 전에"].exists)
        XCTAssertFalse(app.staticTexts["캘린더를 연결해 주세요"].exists)
    }

    // MARK: - 도우미

    private func shot(_ app: XCUIApplication, _ name: String) {
        let s = app.screenshot()
        let a = XCTAttachment(screenshot: s)
        a.name = "\(prefix)-\(name)"
        a.lifetime = .keepAlways
        add(a)
        if let dir = shotDir {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(prefix)-\(name).png"))
        }
    }
}
