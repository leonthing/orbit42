import XCTest

/// 개선-51 스토어 스크린샷 원본 — 둘러보기 예시 데이터(실명·실계정 없음), '둘러보는 중' 띠는 DEBUG BROWSE_HIDE_BANNER 로 숨김.
/// 실행: TEST_RUNNER_SHOT_DIR. 끄는 중 화면은 바깥 스크립트가 DRAG_HOLD 표시를 보고 simctl 로 찍는다.
final class StoreShotsUITests: XCTestCase {
    private var app: XCUIApplication!

    private func startBrowse(mode: String = "day") {
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        app.launchEnvironment["BROWSE_STORE_DAY"] = "1"
        app.launchEnvironment["DEMO_GREETING_HOUR"] = "9"
        app.launchEnvironment["DEMO_SHEET"] = "newslot"
        app.launchEnvironment["STORE_NAMES"] = "1"
        app.launchArguments += ["-calendarScheduleMode", mode]
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(tabButton("캘린더").waitForExistence(timeout: 10))
        sleep(2)
    }

    func testShots() throws {
        startBrowse()
        // 3. 하루 보기 — 체크·별·완료
        XCTAssertTrue(app.staticTexts["브랜드 시안 작업"].firstMatch.waitForExistence(timeout: 10))
        sleep(1)
        shot("day")

        // 4. 끄는 중 — 꾹 눌러 아래로 끌고 붙잡은 채 바깥에서 찍는다
        let block = app.staticTexts["브랜드 시안 작업"].firstMatch
        let start = block.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        mark("DRAG_HOLD")
        start.press(forDuration: 0.8, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -170)), withVelocity: .slow, thenHoldForDuration: 5)
        sleep(1)
        // 둘러보기라 놓으면 가입 안내 — 닫는다
        if app.buttons["계속 둘러보기"].waitForExistence(timeout: 3) { app.buttons["계속 둘러보기"].tap(); sleep(1) }

        // 5. 받은 예약
        tabButton("예약").tap()
        sleep(2)
        shot("bookings")

        // 내 일정 피해 빈 시간 자동 — 예약 링크 구역을 열면 새 예약 링크 시트가 뜬다(DEMO_SHEET=newslot)
        app.segmentedControls.buttons["예약 링크"].tap()
        if app.staticTexts["매주 열어둘 시간"].waitForExistence(timeout: 5) {
            sleep(1)
            // iPad 는 키보드가 자동으로 뜬다 — 내리고 찍는다
            if app.keyboards.firstMatch.exists {
                let hide = app.keyboards.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS %@", "keyboard", "키보드")).firstMatch
                if hide.exists { hide.tap() }
                sleep(1)
            }
            shot("newslot")
            app.swipeDown(velocity: .fast)
            sleep(1)
            if app.buttons["취소"].exists { app.buttons["취소"].tap(); sleep(1) }
        }
        // 1. 손님 예약 화면 — 예약 링크 > 커피챗 30분, 날짜 하나 고른 상태
        app.staticTexts["커피챗 30분"].firstMatch.tap()
        sleep(2)
        shot("guest")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        sleep(1)

        // 8. 리포트
        tabButton("리포트").tap()
        sleep(2)
        shot("report")

        // 9. 오르빗
        tabButton("오르빗").tap()
        sleep(2)
        shot("orbit")
    }

    /// iPhone 은 아래 탭 바, iPad 는 위쪽 탭 버튼
    private func tabButton(_ name: String) -> XCUIElement {
        let bar = app.tabBars.buttons[name]
        return bar.exists ? bar : app.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func mark(_ name: String) {
        guard let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] else { return }
        try? "\(Date().timeIntervalSince1970)".write(toFile: "\(dir)/\(name)", atomically: true, encoding: .utf8)
    }
}
