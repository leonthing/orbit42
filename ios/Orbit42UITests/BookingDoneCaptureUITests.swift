import XCTest

/// 예약 완료 화면의 '나도 이런 예약 링크 만들기' 한 줄 캡처 (1.6.0 ②) — 둘러보기 예시 + DEBUG DEMO_BOOKED_STATUS.
final class BookingDoneCaptureUITests: XCTestCase {
    func testCaptureBookingDoneLine() throws {
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["DEMO_BOOKED_STATUS"] = "confirmed"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 10))
        app.tabBars.buttons["예약"].tap()
        sleep(1)
        app.segmentedControls.buttons["예약 링크"].tap()
        sleep(1)
        app.staticTexts["커피챗 30분"].firstMatch.tap()
        let line = app.buttons["ownLinkFromBooking"]
        XCTAssertTrue(line.waitForExistence(timeout: 8), "완료 화면 한 줄 없음")
        sleep(1)
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = "booking-done"; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("booking-done.png"))
        }
    }
}
