import XCTest

/// 링크를 만든 직후 공유 시트의 '바이오용 내 링크 페이지 주소 복사' (개선-39). 테스트 계정에서 무료 링크 'T39 테스트'를 만든다(바깥에서 지움).
final class BioCopyUITests: XCTestCase {
    func testBioCopy() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 30))
        app.tabBars.buttons["예약"].tap()
        let received = app.segmentedControls.buttons["받은 예약"]
        if received.waitForExistence(timeout: 5) { received.tap() }
        let make = app.buttons["예약 링크 만들기"]
        XCTAssertTrue(make.waitForExistence(timeout: 10)); make.tap()
        let title = app.textFields.firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        title.typeText("T39 테스트")
        app.buttons["만들기"].tap()
        let bio = app.buttons["copyBioURL"]
        XCTAssertTrue(bio.waitForExistence(timeout: 15), "바이오 주소 복사 없음")
        bio.tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "복사했어요")).firstMatch.waitForExistence(timeout: 3))
        sleep(1)
        try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("bio-copy.png"))
    }
}
