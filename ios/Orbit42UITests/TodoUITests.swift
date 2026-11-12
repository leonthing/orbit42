import XCTest

/// 1.9.0 할 일·후속 — 로컬 서버(NEXT_PUBLIC_V190_FORCE_OPEN=1) + 임시 계정, 오늘 23시 "UI 시험 일정"(메모에 "-" 줄 2개).
///   TEST_RUNNER_TODO_BASE=http://localhost:3001 TEST_RUNNER_TODO_TOKEN=<토큰> xcodebuild test -only-testing:Orbit42UITests/TodoUITests
final class TodoUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch() throws -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["TODO_BASE"] ?? "http://localhost:3001"
        app.launchEnvironment["DEMO_TOKEN"] = try XCTUnwrap(env["TODO_TOKEN"])
        app.launch()
        return app
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    private func input(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.textFields[id].exists ? app.textFields[id] : app.textViews[id]
    }

    func test1_DetailMemoAndCompletion() throws {
        let app = try launch()
        let ev = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "UI 시험 일정")).firstMatch
        if !ev.waitForExistence(timeout: 25) { shot(app, "todo-fail-cal"); XCTFail("오늘 일정 없음") }
        ev.tap()
        let addTodo = app.buttons["followUp.addTodo"]
        XCTAssertTrue(addTodo.waitForExistence(timeout: 15), "후속 칸 없음")
        // 메모 → 할 일 (아래에 있으니 찾을 때까지 올린다)
        let memo = app.buttons["memo.toTodo"]
        var tries = 0
        while !memo.isHittable && tries < 6 { app.swipeUp(); tries += 1 }
        XCTAssertTrue(memo.exists, "할 일로 바꾸기 없음")
        shot(app, "todo-1-detail")
        memo.tap()
        let save = app.buttons["memoTodo.save"]
        XCTAssertTrue(save.waitForExistence(timeout: 10))
        shot(app, "todo-2-memo-sheet")
        save.tap()
        // 후속 칸에 두 할 일
        tries = 0
        while !app.buttons["followUp.addTodo"].isHittable && tries < 6 { app.swipeDown(); tries += 1 }
        XCTAssertTrue(app.staticTexts["견적서 보내기"].waitForExistence(timeout: 10), "후속에 할 일 없음")
        shot(app, "todo-3-followups")
        // 완료로 표시 → 후속 묻기
        app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "완료로 표시")).firstMatch.tap()
        if !app.buttons["todo.save"].waitForExistence(timeout: 10) { shot(app, "todo-fail-after"); XCTFail("완료 뒤 묻기 시트 없음") }
        let field = input(app, "todoInput")
        field.tap()
        field.typeText("자료 정리\n메일 회신")
        app.buttons["due.tomorrow"].tap()
        shot(app, "todo-4-after-completion")
        app.buttons["todo.save"].tap()
        XCTAssertTrue(app.staticTexts["메일 회신"].waitForExistence(timeout: 10), "완료 뒤 만든 할 일이 후속에 없음")
    }

    func test2_ListAndDayStrip() throws {
        let app = try launch()
        let todos = app.buttons["calendar.todos"]
        XCTAssertTrue(todos.waitForExistence(timeout: 25), "할 일 아이콘 없음")
        todos.tap()
        let field = app.textFields["todoList.input"]
        if !field.waitForExistence(timeout: 10) { shot(app, "todo-fail-list"); XCTFail("목록 입력 없음") }
        XCTAssertTrue(app.staticTexts["견적서 보내기"].waitForExistence(timeout: 10))
        field.tap(); field.typeText("목록에서 추가\n")
        XCTAssertTrue(app.staticTexts["목록에서 추가"].waitForExistence(timeout: 10))
        shot(app, "todo-5-list")
        app.buttons["닫기"].tap()
        // 하루 보기로 → 맨 위 할 일 줄 (이미 하루 보기면 그대로)
        if app.buttons["하루 보기"].exists { app.buttons["하루 보기"].tap() }
        let strip = app.buttons["dayTodos"].firstMatch
        XCTAssertTrue(strip.waitForExistence(timeout: 15), "하루 보기 할 일 줄 없음")
        strip.tap()
        shot(app, "todo-6-day")
    }
}
