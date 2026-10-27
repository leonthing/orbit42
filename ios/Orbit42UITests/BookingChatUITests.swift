import XCTest

/// 예약 대화 (1.8.0) 촬영·동작 확인. 로컬 서버 + 토큰 필요.
/// MODE=host(받은 예약 → 상세 → 대화 → 답장) | guest(내가 한 예약 → 상세 → 대화). SLOT=예약 이름 일부.
final class BookingChatUITests: XCTestCase {
    func testBookingChat() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let mode = env["MODE"], let slot = env["SLOT"] else { throw XCTSkip("DEMO_TOKEN·MODE·SLOT 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        if let base = env["API_BASE"] { app.launchEnvironment["API_BASE"] = base }
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(mode)-\(n).png")) }
        XCTAssertTrue(app.tabBars.buttons["예약"].firstMatch.waitForExistence(timeout: 30))
        app.tabBars.buttons["예약"].firstMatch.tap()
        let segment = app.segmentedControls.buttons[mode == "host" ? "받은 예약" : "내가 한 예약"]
        if segment.waitForExistence(timeout: 5) { segment.tap() }
        let row = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", slot)).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15), "예약 행 없음")
        sleep(2)
        shot("1-list")
        row.tap()
        let card = app.buttons["bookingChatCard"]
        for _ in 0..<4 where !card.isHittable { app.swipeUp() }
        XCTAssertTrue(card.waitForExistence(timeout: 10), "대화 칸 없음")
        card.tap()
        let input = app.textFields["chatInput"]
        XCTAssertTrue(input.waitForExistence(timeout: 10), "입력칸 없음")
        sleep(2)
        if mode == "host" {
            input.tap()
            input.typeText("네, PDF로 보내 주시면 미리 보고 갈게요.")
            app.buttons["chatSend"].tap()
            sleep(3)
        }
        shot("2-chat")
    }
}
