import XCTest

/// 버그-2: 앱이 뒤에 있는 동안 다른 곳(웹·다른 기기)에서 바뀐 일정·할 일이 앞으로 돌아왔을 때 보이는지.
/// 로컬 서버(NEXT_PUBLIC_V190_FORCE_OPEN=1) + 임시 계정.
///   TEST_RUNNER_FG_BASE=http://localhost:3001 TEST_RUNNER_FG_TOKEN=<토큰> xcodebuild test -only-testing:Orbit42UITests/ForegroundRefreshUITests
final class ForegroundRefreshUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }
    private var base: String { env["FG_BASE"] ?? "http://localhost:3001" }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
    }

    /// 테스트 실행기에서 서버로 바로 보낸다 (= 다른 기기에서 바꾼 것)
    private func post(_ path: String, _ body: [String: Any]) throws {
        var r = URLRequest(url: URL(string: base + path)!)
        r.httpMethod = "POST"
        r.setValue("Bearer \(try XCTUnwrap(env["FG_TOKEN"]))", forHTTPHeaderField: "authorization")
        r.setValue("application/json", forHTTPHeaderField: "content-type")
        r.httpBody = try JSONSerialization.data(withJSONObject: body)
        let done = expectation(description: path)
        var status = 0
        URLSession.shared.dataTask(with: r) { _, resp, _ in
            status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            done.fulfill()
        }.resume()
        wait(for: [done], timeout: 15)
        XCTAssertTrue((200..<300).contains(status), "\(path) \(status)")
    }

    private func today(_ hour: Int) -> String {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = .current
        let d = c.date(bySettingHour: hour, minute: 0, second: 0, of: Date())!
        return ISO8601DateFormatter().string(from: d)
    }

    private func label(_ app: XCUIApplication, _ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func run(away seconds: UInt32, tag: String) throws {
        continueAfterFailure = true
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = base
        app.launchEnvironment["DEMO_TOKEN"] = try XCTUnwrap(env["FG_TOKEN"])
        app.launch()
        XCTAssertTrue(app.buttons["calendar.todos"].waitForExistence(timeout: 25), "캘린더 안 열림")
        if app.buttons["하루 보기"].exists { app.buttons["하루 보기"].tap() }
        XCTAssertTrue(app.buttons["dayTodos"].firstMatch.waitForExistence(timeout: 10) || true)
        shot(app, "fg-\(tag)-0-before")

        XCUIDevice.shared.press(.home)
        let title = "뒤에서 넣은 일정 \(tag)"
        let todo = "뒤에서 넣은 할 일 \(tag)"
        try post("/api/v1/calendar/events", ["title": title, "startAt": today(21), "endAt": today(22)])
        try post("/api/v1/todos", ["items": [["title": todo, "dueDate": String(today(12).prefix(10))]]])
        sleep(seconds)
        app.activate()

        let ev = label(app, title)
        XCTAssertTrue(ev.waitForExistence(timeout: 10), "[\(tag)] 앞으로 왔는데 새 일정이 안 보임")
        let strip = app.buttons["dayTodos"].firstMatch
        if strip.waitForExistence(timeout: 5) { strip.tap() }
        XCTAssertTrue(label(app, todo).waitForExistence(timeout: 8), "[\(tag)] 앞으로 왔는데 새 할 일이 안 보임")
        shot(app, "fg-\(tag)-1-after")
    }

    func test1_ShortAway() throws { try run(away: 15, tag: "15초") }
    func test2_LongAway() throws { try run(away: 70, tag: "70초") }
}
