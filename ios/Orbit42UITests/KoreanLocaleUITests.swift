import XCTest

/// 앱 전체 한국어 — 시스템 날짜·시각 고르기가 'AM/PM' 대신 '오전/오후'로 나오는지(둘러보기, 서버 불필요).
final class KoreanLocaleUITests: XCTestCase {
    private var app: XCUIApplication!

    func testNewEventPickerIsKorean() throws {
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()

        let add = app.buttons["일정 추가"]
        XCTAssertTrue(add.waitForExistence(timeout: 10))
        add.tap()
        XCTAssertTrue(app.datePickers.firstMatch.waitForExistence(timeout: 5))
        sleep(1)
        shot("locale-newevent")

        // 시각 칸을 눌러 휠을 연 화면도 남긴다
        // 12시간제 기기면 '오전 6:00', 24시간제면 '06:00' — 어느 쪽이든 영어(AM/PM·월 이름)는 없어야 한다
        let english = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS ' AM' OR label CONTAINS ' PM' OR label MATCHES '.*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) .*'")).firstMatch
        XCTAssertFalse(english.exists, "날짜·시각이 영어로 나옴: \(english.exists ? english.label : "")")
        let korDate = app.buttons.matching(NSPredicate(format: "label MATCHES '.*[0-9]{4}[.] .*'")).firstMatch
        XCTAssertTrue(korDate.exists, "날짜가 한국어 형식(2026. 10. 26.)이 아님")
        let time = app.buttons.matching(NSPredicate(format: "label MATCHES '.*[0-9]:[0-9]{2}.*' AND NOT (label MATCHES '.*[0-9]{4}[.] .*')")).firstMatch
        time.tap()
        sleep(1)
        shot("locale-timewheel")
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
