import XCTest

/// 개선-45 — 예약 링크 편집 정리: 기본 칸만 보이고 '고급 설정' 아래로 접힘, 예약 0건이면 삭제·있으면 보관.
/// 둘러보기 예시(서버 불필요): 커피챗 30분 = 예약 기록 3건, 포트폴리오 멘토링 60분 = 0건. 확인 창까지만 보고 취소한다.
final class SlotEditTidyUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        // BROWSE_HIDE_BANNER 는 켜지 않는다 — 켜면 촬영용으로 '편집' 버튼이 숨는다
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(tabButton("예약").waitForExistence(timeout: 10))
        tabButton("예약").tap()
        sleep(1)
        app.segmentedControls.buttons["예약 링크"].tap()
        sleep(1)
    }

    private func tabButton(_ name: String) -> XCUIElement {
        let bar = app.tabBars.buttons[name]
        return bar.exists ? bar : app.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    private func openEditor(_ title: String) {
        app.staticTexts[title].firstMatch.tap()
        sleep(1)
        let edit = app.buttons["편집"]
        XCTAssertTrue(edit.waitForExistence(timeout: 5))
        edit.tap()
        XCTAssertTrue(app.staticTexts["길이"].waitForExistence(timeout: 10), "편집 화면 안 열림")
        sleep(1)
    }

    /// 목록은 화면 밖 칸을 만들지 않는다 — 보일 때까지 조금씩 올린다
    private func scrollTo(_ element: XCUIElement) {
        for _ in 0..<12 {
            if element.exists && element.isHittable { return }
            app.swipeUp(velocity: .slow)
        }
    }

    func testBasicAdvancedAndDelete() throws {
        openEditor("포트폴리오 멘토링 60분")
        // 기본: 고급 칸은 안 보인다
        XCTAssertFalse(app.switches["예약을 바로 확정"].exists, "고급 칸이 접혀 있지 않음")
        XCTAssertFalse(app.staticTexts["예약 받는 기간"].exists)
        XCTAssertTrue(app.staticTexts["장소"].exists || app.staticTexts["장소".uppercased()].exists)
        shot("45-basic")

        // 고급 펼침 — 접힌 요약에 기본값과 다른 설정(내가 수락해야 확정)이 보였다
        let toggle = app.buttons["slotAdvancedToggle"]
        scrollTo(toggle)
        XCTAssertTrue(toggle.label.contains("내가 수락해야 확정"), "요약: \(toggle.label)")
        shot("45-basic-bottom")
        toggle.tap()
        sleep(1)
        let approve = app.switches["예약을 바로 확정"]
        scrollTo(approve)
        XCTAssertTrue(approve.exists, "고급을 펼쳐도 바로 확정이 없음")
        shot("45-advanced")

        // 예약 0건 — 삭제 확인
        let remove = app.buttons["slotRemove"]
        scrollTo(remove)
        XCTAssertTrue(remove.label.contains("삭제"))
        remove.tap()
        XCTAssertTrue(app.alerts["예약 링크를 삭제할까요?"].waitForExistence(timeout: 3))
        shot("45-delete-confirm")
        app.alerts.buttons["취소"].tap()
    }

    func testArchiveWhenBooked() throws {
        openEditor("커피챗 30분")
        let remove = app.buttons["slotRemove"]
        scrollTo(remove)
        XCTAssertTrue(remove.label.contains("보관"), "예약 있는 링크인데 보관이 아님: \(remove.label)")
        remove.tap()
        let alert = app.alerts["예약 링크를 보관할까요?"]
        XCTAssertTrue(alert.waitForExistence(timeout: 3))
        XCTAssertTrue(alert.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "예약 기록 3건")).firstMatch.exists)
        shot("45-archive-confirm")
        app.alerts.buttons["취소"].tap()
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
