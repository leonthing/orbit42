import XCTest

/// 메일 미인증 안내 (개선-24).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR(캡처 저장 폴더)
/// - testUnverifiedBanner: 이메일 미인증 계정 — 프로필·받은 예약 위에 안내, 다시 보내기 → 보냄 상태(버튼 막힘)
/// - testVerifiedNoBanner: 인증된 계정 — 안내 없음 (TEST_RUNNER_SHOT_PREFIX 로 캡처 이름 구분)
final class EmailVerifyUITests: XCTestCase {
    private var shotDir: String?
    private let message = "메일 인증을 마치시면 예약·초대 소식을 메일로 받아 보실 수 있어요"

    func testUnverifiedBanner() throws {
        let app = try launch()

        app.tabBars.buttons["프로필"].tap()
        XCTAssertTrue(app.staticTexts[message].waitForExistence(timeout: 20), "프로필에 안내가 안 뜸")
        sleep(1)
        shot(app, "1-profile-unverified")

        let resend = app.buttons["인증 메일 다시 보내기"]
        XCTAssertTrue(resend.isEnabled)
        resend.tap()
        XCTAssertTrue(app.staticTexts["보냈어요. 메일함을 확인해 주세요"].waitForExistence(timeout: 20), "보낸 뒤 안내 없음")
        XCTAssertFalse(app.buttons["인증 메일 다시 보내기"].isEnabled, "보낸 직후 버튼이 막히지 않음")
        sleep(1)
        shot(app, "2-profile-sent")

        app.tabBars.buttons["예약"].tap()
        let received = app.segmentedControls.buttons["받은 예약"]
        if received.waitForExistence(timeout: 10) { received.tap() }
        XCTAssertTrue(app.staticTexts[message].waitForExistence(timeout: 15), "받은 예약 위에 안내가 안 뜸")
        sleep(1)
        shot(app, "3-received-unverified")
    }

    func testVerifiedNoBanner() throws {
        let app = try launch()
        let prefix = ProcessInfo.processInfo.environment["SHOT_PREFIX"] ?? "verified"

        app.tabBars.buttons["프로필"].tap()
        XCTAssertTrue(app.navigationBars["프로필"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts[message].waitForExistence(timeout: 8), "인증 계정 프로필에 안내가 뜸")
        sleep(1)
        shot(app, "\(prefix)-profile")

        app.tabBars.buttons["예약"].tap()
        let received = app.segmentedControls.buttons["받은 예약"]
        if received.waitForExistence(timeout: 10) { received.tap() }
        XCTAssertFalse(app.staticTexts[message].waitForExistence(timeout: 5), "인증 계정 받은 예약에 안내가 뜸")
        shot(app, "\(prefix)-received")
    }

    // MARK: - 도우미

    private func launch() throws -> XCUIApplication {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["프로필"].waitForExistence(timeout: 30))
        return app
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
