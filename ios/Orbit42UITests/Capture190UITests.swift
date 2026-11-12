import XCTest

/// 1.9.0 PO 검수용 캡처 — 로컬 서버(NEXT_PUBLIC_V190_FORCE_OPEN=1) + 임시 계정(가상 이름). 검사보다 캡처가 목적.
///   TEST_RUNNER_CAP_BASE=http://localhost:3001 TEST_RUNNER_CAP_TOKEN=<토큰> xcodebuild test -only-testing:Orbit42UITests/Capture190UITests
final class Capture190UITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch() throws -> XCUIApplication {
        continueAfterFailure = true
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["CAP_BASE"] ?? "http://localhost:3001"
        app.launchEnvironment["DEMO_TOKEN"] = try XCTUnwrap(env["CAP_TOKEN"])
        app.launch()
        return app
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        sleep(1)
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    private func label(_ app: XCUIApplication, _ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    func testCapture() throws {
        let app = try launch()
        // 1. 대화 목록
        let tab = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "예약")).firstMatch
        XCTAssertTrue(tab.waitForExistence(timeout: 25))
        tab.tap()
        let seg = app.segmentedControls.buttons["대화"]
        XCTAssertTrue(seg.waitForExistence(timeout: 15))
        seg.tap()
        _ = label(app, "도윤").waitForExistence(timeout: 10)
        shot(app, "c01-dm-list")
        // 2. 받은 요청
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "서연")).firstMatch.tap()
        _ = app.buttons["dmAccept"].waitForExistence(timeout: 10)
        shot(app, "c02-incoming-request")
        app.navigationBars.buttons.firstMatch.tap()
        // 3. 대화방
        _ = label(app, "도윤").waitForExistence(timeout: 10)
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "도윤")).firstMatch.tap()
        _ = app.buttons["dmPeerLinks"].waitForExistence(timeout: 10)
        shot(app, "c03-dm-room")
        // 4. 프로필 '대화' 버튼 (대화방의 예약 링크 보기 → 상대 프로필)
        app.buttons["dmPeerLinks"].tap()
        _ = app.buttons["dmProfileButton"].waitForExistence(timeout: 10)
        shot(app, "c04-profile-dm-button")
        // 5. 캘린더 — 할 일 목록
        app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "캘린더")).firstMatch.tap()
        let todos = app.buttons["calendar.todos"]
        XCTAssertTrue(todos.waitForExistence(timeout: 15))
        todos.tap()
        _ = label(app, "세금계산서").waitForExistence(timeout: 10)
        shot(app, "c05-todo-list")
        app.buttons["닫기"].tap()
        // 6. 하루 보기 맨 위 할 일
        if app.buttons["하루 보기"].exists { app.buttons["하루 보기"].tap() }
        _ = app.buttons["dayTodos"].firstMatch.waitForExistence(timeout: 10)
        // 옆 날짜 페이지도 미리 그려져 있어 화면에 보이는 것만 누른다
        if let strip = app.buttons.matching(identifier: "dayTodos").firstMatch as XCUIElement? { strip.tap() }
        shot(app, "c06-day-todos")
        // 7. 일정 상세 후속 칸 — 월 보기 목록에서 연다(하루 보기 2시 칸은 화면 아래)
        if app.buttons["월 보기"].exists { app.buttons["월 보기"].tap() }
        let ev = app.staticTexts.matching(NSPredicate(format: "label == %@", "디자인 리뷰")).firstMatch
        XCTAssertTrue(ev.waitForExistence(timeout: 10))
        ev.tap()
        _ = app.buttons["followUp.addTodo"].waitForExistence(timeout: 10)
        shot(app, "c07-detail-followups")
        // 8. 완료 직후 묻기
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "완료로 표시")).firstMatch.tap()
        _ = app.buttons["todo.save"].waitForExistence(timeout: 10)
        let field = app.textViews["todoInput"].exists ? app.textViews["todoInput"] : app.textFields["todoInput"]
        if field.exists { field.typeText("시안 피드백 정리\n견적서 보내기") }
        shot(app, "c08-after-completion")
    }
}
