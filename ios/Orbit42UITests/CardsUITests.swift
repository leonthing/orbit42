import XCTest

/// 명함 1차 — 허용 계정에만 진입점, 합성 명함(가짜 이름) 인식 → 확인 화면.
/// 로컬 서버(CARDS_PREVIEW_USER_IDS=leokim) + 토큰: TEST_RUNNER_CARDS_A(허용), TEST_RUNNER_CARDS_B(비허용), TEST_RUNNER_CARD_FILES, TEST_RUNNER_SHOT_DIR
final class CardsUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch(_ token: String, extra: [String: String] = [:]) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["CARDS_BASE"] ?? "http://localhost:3000"
        app.launchEnvironment["DEMO_TOKEN"] = token
        for (k, v) in extra { app.launchEnvironment[k] = v }
        app.launch()
        return app
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        if let dir = env["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func openSettings(_ app: XCUIApplication) {
        let tab = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "프로필")).firstMatch
        XCTAssertTrue(tab.waitForExistence(timeout: 30))
        tab.tap()
        let gear = app.navigationBars.buttons["설정"].firstMatch
        XCTAssertTrue(gear.waitForExistence(timeout: 10))
        gear.tap()
    }

    func test1_EntryOnlyForAllowed() throws {
        let other = launch(try XCTUnwrap(env["CARDS_B"]))
        openSettings(other)
        XCTAssertTrue(other.buttons["settings.google"].waitForExistence(timeout: 15))
        sleep(3)
        XCTAssertFalse(other.buttons["settings.cards"].exists, "허용 아닌 계정에 진입점이 보임")
        other.terminate()

        let app = launch(try XCTUnwrap(env["CARDS_A"]))
        openSettings(app)
        XCTAssertTrue(app.buttons["settings.cards"].waitForExistence(timeout: 15), "허용 계정에 진입점 없음")
        app.buttons["settings.cards"].tap()
        XCTAssertTrue(app.buttons["cardsConnect"].waitForExistence(timeout: 15), "연결 버튼 없음")
        sleep(1)
        shot(app, "c-1-home-not-connected")
    }

    func test2_RecognizeToConfirm() throws {
        let app = launch(try XCTUnwrap(env["CARDS_A"]), extra: ["DEMO_CARD_FILES": try XCTUnwrap(env["CARD_FILES"])])
        openSettings(app)
        XCTAssertTrue(app.buttons["settings.cards"].waitForExistence(timeout: 15))
        app.buttons["settings.cards"].tap()
        let scan = app.buttons["cardsScan"]
        XCTAssertTrue(scan.waitForExistence(timeout: 15))
        scan.tap()
        let name = app.textFields["cardName"]
        XCTAssertTrue(name.waitForExistence(timeout: 30), "확인 화면 없음")
        XCTAssertFalse((name.value as? String ?? "").isEmpty, "이름 인식 안 됨")
        sleep(3)
        shot(app, "c-2-confirm-top")
        // 저장은 같은 사람 찾기가 끝나고 방법을 골라야만 — 연결 전이면 막혀 있어야 한다
        XCTAssertFalse(app.buttons["cardSave"].isEnabled, "찾기 전인데 저장이 열림")
        app.swipeUp()
        sleep(1)
        shot(app, "c-3-confirm-bottom")
    }
}
