import XCTest

/// 유료 예약 링크의 결제 안내 (개선-38). MODE=create(결제 안내 없는 계정, 만들지 않고 확인 창까지) | edit(결제 안내 있는 계정, 저장 안 함)
final class PaymentInlineUITests: XCTestCase {
    func testPaymentInline() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let mode = env["MODE"] else { throw XCTSkip("DEMO_TOKEN·MODE 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(mode)-\(n).png")) }
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 30))
        app.tabBars.buttons["예약"].tap()
        if mode == "create" {
            let received = app.segmentedControls.buttons["받은 예약"]
            if received.waitForExistence(timeout: 5) { received.tap() }
            let make = app.buttons["예약 링크 만들기"]
            XCTAssertTrue(make.waitForExistence(timeout: 10))
            make.tap()
            let title = app.textFields.firstMatch
            XCTAssertTrue(title.waitForExistence(timeout: 5))
            title.typeText("포트폴리오 리뷰")
            let price = app.textFields["0"]
            price.tap()
            price.typeText("30000")
            XCTAssertTrue(app.textFields["paymentInline"].waitForExistence(timeout: 3) || app.textViews["paymentInline"].exists, "결제 안내 칸 없음")
            shot("1-field")
            app.buttons["만들기"].tap()
            let alert = app.alerts["입금 확인 없이 바로 확정돼요"]
            XCTAssertTrue(alert.waitForExistence(timeout: 5), "확인 창 없음")
            shot("2-confirm")
            alert.buttons["결제 안내 적기"].tap()   // 만들지 않는다
            XCTAssertTrue(app.buttons["만들기"].waitForExistence(timeout: 3), "시트가 닫힘")
        } else {
            let links = app.segmentedControls.buttons["예약 링크"]
            XCTAssertTrue(links.waitForExistence(timeout: 5)); links.tap()
            let paid = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "₩")).firstMatch
            XCTAssertTrue(paid.waitForExistence(timeout: 10))
            paid.tap()
            let edit = app.buttons["편집"]
            XCTAssertTrue(edit.waitForExistence(timeout: 10)); edit.tap()
            let field = app.textFields["paymentInline"]
            for _ in 0..<4 where !field.exists { app.swipeUp() }
            XCTAssertTrue(field.waitForExistence(timeout: 5), "편집 화면에 결제 안내 칸 없음")
            shot("1-prefilled")
        }
    }
}
