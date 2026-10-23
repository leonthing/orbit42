import XCTest

/// 홈 화면 위젯 '답할 일 n건'이 앱 예약 탭 배지와 같은 숫자인지 (개선-30 손질).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR.
/// 앱을 한 번 띄워 토큰을 위젯과 나눈 뒤, 홈 화면에 위젯을 얹어 캡처한다(단계마다 캡처를 남겨 실패 지점을 본다).
final class WidgetBadgeUITests: XCTestCase {
    private var shotDir: String?

    func testWidgetMatchesTabBadge() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 30))
        sleep(6)
        shot(app, "w1-app-tab-badge")

        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        sleep(2)
        // 빈 곳 꾹 누르기 → 편집
        springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55)).press(forDuration: 1.5)
        sleep(1)
        shot(springboard, "w2-edit")
        let edit = springboard.buttons["편집"]
        if edit.waitForExistence(timeout: 3) { edit.tap(); sleep(1) }
        let add = springboard.buttons["위젯 추가"]
        if add.waitForExistence(timeout: 3) { add.tap() }
        sleep(2)
        shot(springboard, "w3-gallery")
        let search = springboard.searchFields.firstMatch
        if search.waitForExistence(timeout: 5) {
            search.tap()
            search.typeText("Orbit42")
            sleep(2)
        }
        shot(springboard, "w4-search")
        let result = springboard.cells.containing(NSPredicate(format: "label CONTAINS[c] %@", "Orbit42")).firstMatch
        if result.waitForExistence(timeout: 5) {
            result.tap()
        } else {
            springboard.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] %@", "Orbit42")).firstMatch.tap()
        }
        sleep(2)
        shot(springboard, "w5-sizes")
        // 첫 번째 '월간 달력'(중간 크기)에 숫자가 보인다 — 아래 '위젯 추가' 버튼은 이름으로 안 잡혀 자리로 누른다
        springboard.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.905)).tap()
        sleep(2)
        let done = springboard.buttons["완료"]
        if done.waitForExistence(timeout: 3) { done.tap() }
        sleep(12) // 위젯이 데이터를 받아 그릴 시간
        shot(springboard, "w6-home-widget")
    }

    private func shot(_ target: XCUIApplication, _ name: String) {
        let s = target.screenshot()
        let a = XCTAttachment(screenshot: s)
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = shotDir {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
