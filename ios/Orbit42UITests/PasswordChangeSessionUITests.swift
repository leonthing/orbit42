import XCTest

/// 개선-56 — 비밀번호를 바꾼 기기는 로그인 유지, 다른 기기의 옛 토큰은 오류창 없이 로그인 화면으로.
/// 로컬 서버 + 임시 계정 필요. 실행 예:
///   TEST_RUNNER_PW56_BASE=http://localhost:3008 TEST_RUNNER_PW56_TOKEN=… TEST_RUNNER_PW56_OTHER=… \
///   TEST_RUNNER_PW56_OLD=… TEST_RUNNER_PW56_NEW=… xcodebuild test -only-testing:Orbit42UITests/PasswordChangeSessionUITests/…
final class PasswordChangeSessionUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var base: String { env["PW56_BASE"] ?? "http://localhost:3008" }

    private func launch(token: String?) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = base
        if let token { app.launchEnvironment["DEMO_TOKEN"] = token }
        app.launch()
        return app
    }

    private func tab(_ app: XCUIApplication, _ name: String) -> XCUIElement {
        app.tabBars.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    /// 이 기기에서 바꾸기 → 새 토큰 저장 → 다시 켜도 로그인 유지
    func testThisDeviceStaysLoggedIn() throws {
        let token = try XCTUnwrap(env["PW56_TOKEN"])
        let app = launch(token: token)
        XCTAssertTrue(tab(app, "프로필").waitForExistence(timeout: 20))
        tab(app, "프로필").tap()
        app.buttons["설정"].firstMatch.tap()
        let account = app.buttons["settings.account"].firstMatch
        XCTAssertTrue(account.waitForExistence(timeout: 10))
        account.tap()
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "비밀번호 변경")).firstMatch.tap()
        let fields = app.secureTextFields
        XCTAssertTrue(fields.element(boundBy: 0).waitForExistence(timeout: 10))
        fields.element(boundBy: 0).tap(); fields.element(boundBy: 0).typeText(try XCTUnwrap(env["PW56_OLD"]))
        let newPw = try XCTUnwrap(env["PW56_NEW"])
        fields.element(boundBy: 1).tap(); fields.element(boundBy: 1).typeText(newPw)
        fields.element(boundBy: 2).tap(); fields.element(boundBy: 2).typeText(newPw)
        app.buttons["변경"].firstMatch.tap()
        let alert = app.alerts["변경했어요"]
        XCTAssertTrue(alert.waitForExistence(timeout: 15), "변경 성공 알림 없음")
        shot(app, "56-changed")
        alert.buttons["확인"].tap()
        // 바로 다른 화면 요청도 401 없이 되는지 — 예약 탭
        tab(app, "예약").tap()
        sleep(3)
        XCTAssertTrue(tab(app, "예약").exists, "바꾼 직후 로그아웃됨")
        XCTAssertEqual(app.alerts.count, 0, "오류창이 뜸")
        // 다시 켜기(주입 토큰 없이 Keychain 의 새 토큰으로)
        app.terminate()
        let again = launch(token: nil)
        XCTAssertTrue(tab(again, "캘린더").waitForExistence(timeout: 20), "다시 켰더니 로그인이 풀림")
        shot(again, "56-relaunched")
    }

    /// 다른 기기에서 바꾸기 → 이 기기의 옛 토큰은 다음 요청에서 로그인 화면으로, 오류창 없음, 안내 한 번
    func testOtherDeviceGoesToLoginQuietly() throws {
        let token = try XCTUnwrap(env["PW56_TOKEN"])
        let app = launch(token: token)
        XCTAssertTrue(tab(app, "프로필").waitForExistence(timeout: 20))
        sleep(2)
        // '다른 기기'(테스트 프로세스)에서 비밀번호 변경
        var req = URLRequest(url: URL(string: base + "/api/v1/me/password")!)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer " + (try XCTUnwrap(env["PW56_OTHER"])), forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["currentPassword": try XCTUnwrap(env["PW56_OLD"]), "newPassword": try XCTUnwrap(env["PW56_NEW"])])
        let done = expectation(description: "pw")
        var status = 0
        URLSession.shared.dataTask(with: req) { _, res, _ in status = (res as? HTTPURLResponse)?.statusCode ?? 0; done.fulfill() }.resume()
        wait(for: [done], timeout: 20)
        XCTAssertEqual(status, 200)
        sleep(6) // 서버 지문 기억(5초)이 지나도록
        // 화면을 옮겨 요청을 일으킨다
        tab(app, "예약").tap()
        if tab(app, "프로필").waitForExistence(timeout: 2) && tab(app, "프로필").isHittable { tab(app, "프로필").tap() }
        let notice = app.staticTexts["auth.sessionNotice"]
        XCTAssertTrue(notice.waitForExistence(timeout: 20), "로그인 화면·안내가 안 나옴")
        shot(app, "56-other-device")
        for _ in 0..<3 { sleep(1); XCTAssertEqual(app.alerts.count, 0, "오류창이 뜸") }
        XCTAssertFalse(tab(app, "프로필").exists)
    }
}
