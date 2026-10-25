import XCTest

/// 서버가 앱에 내려주는 예약 링크 안내 문구가 앱 용어인지(1.7.0 용어 맞추기).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN(테스트 계정) + 그 계정에 '용어 확인 링크'(매주 열어둘 시간 비움).
final class SlotTermsUITests: XCTestCase {
    func testPreviewMessageUsesAppTerms() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let tab = app.tabBars.buttons["예약"].exists ? app.tabBars.buttons["예약"] : app.buttons.matching(NSPredicate(format: "label == %@", "예약")).firstMatch
        XCTAssertTrue(tab.waitForExistence(timeout: 20))
        tab.tap()
        sleep(1)
        app.segmentedControls.buttons["예약 링크"].tap()
        let row = app.staticTexts["용어 확인 링크"].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        let edit = app.buttons["편집"]
        XCTAssertTrue(edit.waitForExistence(timeout: 10))
        edit.tap()
        let msg = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "매주 열어둘 시간이 비어 있어요")).firstMatch
        for _ in 0..<12 where !(msg.exists && msg.isHittable) { app.swipeUp(velocity: .slow) }
        XCTAssertTrue(msg.exists, "새 문구가 안 보임")
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "판매")).firstMatch.exists)
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = "terms-preview"; a.lifetime = .keepAlways; add(a)
        if let dir = env["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("terms-preview.png"))
        }
    }
}
