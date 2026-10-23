import XCTest

/// 예약 탭 배지에 '내가 답할 시간 변경 제안'도 세는지 (개선-30).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR, TEST_RUNNER_SHOT_PREFIX(캡처·결과 파일 이름),
/// TEST_RUNNER_EXPECTED_BADGE(기대하는 숫자 — 캡처 옆 txt 에 남김).
final class BookingsBadgeUITests: XCTestCase {
    func testBadgeCount() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let prefix = env["SHOT_PREFIX"] ?? "badge"
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let tab = app.tabBars.buttons["예약"]
        XCTAssertTrue(tab.waitForExistence(timeout: 30))
        sleep(6) // 앱이 처음 뜰 때 배지를 새로 받는다
        // iOS 26 탭 바 배지는 XCUITest 의 value 로 읽히지 않아 캡처로 확인한다(EXPECTED_BADGE 는 파일 이름 확인용).
        let value = env["EXPECTED_BADGE"] ?? "?"
        let shot = app.screenshot()
        if let dir = env["SHOT_DIR"] {
            try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(prefix).png"))
            try? "expected=\(value)".write(toFile: "\(dir)/\(prefix).txt", atomically: true, encoding: .utf8)
        }
    }
}
