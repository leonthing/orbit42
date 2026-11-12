import XCTest

/// 1.9.0 1:1 대화 — 프로필에서 대화 요청 → 상대가 '대화' 구역에서 받은 요청 수락 → 답장.
/// 로컬 서버(NEXT_PUBLIC_V190_FORCE_OPEN=1) + 임시 계정 두 개. 실행:
///   TEST_RUNNER_DM_BASE=http://localhost:3001 TEST_RUNNER_DM_A=<토큰> TEST_RUNNER_DM_B=<토큰> TEST_RUNNER_DM_B_NAME=zdm2b \
///   xcodebuild test -only-testing:Orbit42UITests/DmUITests
final class DmUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch(token: String) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["DM_BASE"] ?? "http://localhost:3001"
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        return app
    }

    private func tab(_ app: XCUIApplication, _ name: String) -> XCUIElement {
        app.tabBars.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    func test1_RequestFromProfile() throws {
        let app = launch(token: try XCTUnwrap(env["DM_A"]))
        let target = try XCTUnwrap(env["DM_B_NAME"])
        XCTAssertTrue(tab(app, "오르빗").waitForExistence(timeout: 20))
        tab(app, "오르빗").tap()
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText(target)
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", target)).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15), "검색 결과 없음")
        row.tap()
        let button = app.buttons["dmProfileButton"]
        XCTAssertTrue(button.waitForExistence(timeout: 15), "대화 버튼 없음")
        XCTAssertTrue(button.label.contains("대화 요청"), "버튼: \(button.label)")
        shot(app, "dm-1-profile")
        button.tap()
        let input = app.textFields["dmRequestInput"].firstMatch.exists ? app.textFields["dmRequestInput"] : app.textViews["dmRequestInput"]
        XCTAssertTrue(input.waitForExistence(timeout: 10))
        input.tap(); input.typeText("안녕하세요, 커피챗 문의드려요")
        shot(app, "dm-2-request-sheet")
        app.buttons["dmRequestSend"].tap()
        let sent = app.buttons.matching(NSPredicate(format: "identifier == 'dmProfileButton' AND label CONTAINS '요청 보냄'")).firstMatch
        XCTAssertTrue(sent.waitForExistence(timeout: 15), "요청 보냄으로 안 바뀜")
        shot(app, "dm-3-sent")
    }

    func test2_AcceptAndReply() throws {
        let app = launch(token: try XCTUnwrap(env["DM_B"]))
        XCTAssertTrue(tab(app, "예약").waitForExistence(timeout: 20))
        tab(app, "예약").tap()
        let seg = app.segmentedControls.buttons["대화"]
        XCTAssertTrue(seg.waitForExistence(timeout: 15), "대화 구역 없음")
        seg.tap()
        let req = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "대화 요청")).firstMatch
        XCTAssertTrue(req.waitForExistence(timeout: 15), "받은 요청 없음")
        shot(app, "dm-4-list")
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "커피챗")).firstMatch.tap()
        let accept = app.buttons["dmAccept"]
        XCTAssertTrue(accept.waitForExistence(timeout: 15))
        shot(app, "dm-5-incoming")
        accept.tap()
        let input = app.textFields["dmInput"].firstMatch.exists ? app.textFields["dmInput"] : app.textViews["dmInput"]
        XCTAssertTrue(input.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["dmAccept"].exists, "수락 뒤에도 요청 카드")
        input.tap(); input.typeText("네, 반가워요")
        app.buttons["dmSend"].tap()
        XCTAssertTrue(app.staticTexts["네, 반가워요"].waitForExistence(timeout: 15), "보낸 글 없음")
        shot(app, "dm-6-chat")
    }
}
