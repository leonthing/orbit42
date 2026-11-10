import XCTest

/// 앱 푸시 (1.8.0) — 권한 묻는 시점과 푸시 탭 이동 확인. 로컬 서버 + 데모 토큰 필요, 앱을 새로 설치한 상태에서.
/// 1) 앱을 켤 때는 권한 창이 없다 2) 대화 화면을 처음 열 때 묻는다 3) 홈으로 나간 뒤 MARK_DIR/ready 파일을 만들면
///    호스트 쪽 스크립트가 `simctl push`를 보낸다 → 알림을 누르면 그 예약의 대화가 열린다.
final class PushPermissionUITests: XCTestCase {
    func testAskOnChatAndOpenFromPush() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let slot = env["SLOT"], let markDir = env["MARK_DIR"] else { throw XCTSkip("DEMO_TOKEN·SLOT·MARK_DIR 필요") }
        let app = XCUIApplication()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        app.launchEnvironment["DEMO_TOKEN"] = token
        if let base = env["API_BASE"] { app.launchEnvironment["API_BASE"] = base }
        app.launch()
        let dir = env["SHOT_DIR"] ?? NSTemporaryDirectory()
        func shot(_ n: String) { try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("push-\(n).png")) }

        // 1) 앱을 켠 뒤 — 권한 창 없음
        XCTAssertTrue(app.tabBars.buttons["예약"].firstMatch.waitForExistence(timeout: 30))
        sleep(3)
        XCTAssertFalse(springboard.alerts.firstMatch.exists, "앱을 켤 때 권한 창이 뜸")
        shot("1-launch-no-ask")

        // 2) 받은 예약 → 상세 → 대화 — 이때 묻는다
        app.tabBars.buttons["예약"].firstMatch.tap()
        let segment = app.segmentedControls.buttons["받은 예약"]
        if segment.waitForExistence(timeout: 5) { segment.tap() }
        let row = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", slot)).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15), "예약 행 없음")
        sleep(1)
        XCTAssertFalse(springboard.alerts.firstMatch.exists, "대화 전에 권한 창이 뜸")
        row.tap()
        let card = app.buttons["bookingChatCard"]
        for _ in 0..<4 where !card.isHittable { app.swipeUp() }
        XCTAssertTrue(card.waitForExistence(timeout: 10), "대화 칸 없음")
        card.tap()
        let alert = springboard.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "대화를 열 때 권한 창이 안 뜸")
        sleep(1)
        shot("2-chat-ask")
        let allow = alert.buttons.element(boundBy: alert.buttons.count - 1) // 허용
        allow.tap()
        sleep(1)

        // 3) 처음 화면(캘린더 탭)으로 돌려 놓고 홈으로 나간 뒤 푸시 → 알림 탭
        app.navigationBars.buttons.firstMatch.tap()
        sleep(1)
        app.tabBars.buttons.element(boundBy: 0).tap()
        sleep(1)
        XCUIDevice.shared.press(.home)
        sleep(1)
        FileManager.default.createFile(atPath: markDir + "/ready", contents: Data())
        let banner = springboard.otherElements.containing(NSPredicate(format: "label CONTAINS %@", "새 메시지가 있어요")).firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 60), "푸시 배너 없음")
        shot("3-banner")
        banner.tap()
        let input = app.textFields["chatInput"]
        XCTAssertTrue(input.waitForExistence(timeout: 20), "푸시를 눌렀는데 대화가 안 열림")
        sleep(2)
        shot("4-opened-chat")
    }
}
