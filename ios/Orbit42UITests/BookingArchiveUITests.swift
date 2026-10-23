import XCTest

/// 지난 예약 보관·삭제 (개선-25).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR.
/// 테스트 데이터: 호스트에게 지난 예약 4건(10/10 완료, 10/12 취소, 10/15 확정, 10/18 완료) + 예정 2건(11/20 확정, 11/25 취소).
/// - testHostArchiveAndDelete: 호스트 토큰. 꾹 누름 보관 → 편집 2개 보관 → 보관함 되돌리기·삭제 → 편집 1개 삭제
/// - testGuestSide: 게스트 토큰. 호스트가 보관·삭제해도 내가 한 예약에 그대로
final class BookingArchiveUITests: XCTestCase {
    private var shotDir: String?

    func testHostArchiveAndDelete() throws {
        let app = try launch()
        openSegment(app, "받은 예약")

        // 진행 중 예약(11/20 확정)은 꾹 눌러도 보관·삭제가 없다
        let active = row(app, "11월 20일")
        XCTAssertTrue(active.waitForExistence(timeout: 20))
        active.press(forDuration: 1.2)
        XCTAssertFalse(app.buttons["보관"].waitForExistence(timeout: 2), "진행 중 예약에 보관 메뉴가 뜸")
        if app.buttons["보관"].exists { app.tap() }

        // 지난 예약 꾹 누름 → 메뉴 → 보관
        let oct15 = row(app, "10월 15일")
        scrollTo(app, oct15)
        oct15.press(forDuration: 1.2)
        XCTAssertTrue(app.buttons["보관"].waitForExistence(timeout: 5), "꾹 누름 메뉴에 보관 없음")
        XCTAssertTrue(app.buttons["삭제"].exists)
        XCTAssertTrue(app.buttons["완료 처리"].exists, "지난 확정 예약의 완료 처리가 사라짐")
        shot(app, "2-longpress-menu")
        app.buttons["보관"].tap()
        confirm(app, "이 예약을 보관할까요?", button: "보관", shotName: "2b-archive-confirm")
        XCTAssertTrue(row(app, "10월 15일").waitForNonExistence(timeout: 15), "보관한 예약이 목록에 남음")
        XCTAssertTrue(appear(app, app.buttons["보관함 (1)"]), "보관 뒤 보관함 줄 없음")

        // 편집 → 두 개 골라 보관
        let edit = app.buttons["pastEditButton"]
        scrollTo(app, edit)
        edit.tap()
        let selects = app.buttons.matching(identifier: "pastSelect")
        XCTAssertTrue(selects.firstMatch.waitForExistence(timeout: 5))
        selects.element(boundBy: 0).tap()
        scrollTo(app, selects.element(boundBy: 1))
        selects.element(boundBy: 1).tap()
        XCTAssertTrue(app.buttons["보관 (2)"].waitForExistence(timeout: 3))
        sleep(1)
        shot(app, "1-edit-mode")
        app.buttons["보관 (2)"].tap()
        confirm(app, "선택한 예약 2건을 보관할까요?", button: "보관", shotName: nil)
        XCTAssertTrue(appear(app, app.buttons["보관함 (3)"]), "여러 개 보관 뒤 보관함 수가 안 맞음")

        // 보관함 → 되돌리기 / 삭제
        app.buttons["보관함 (3)"].tap()
        XCTAssertTrue(app.navigationBars["보관함"].waitForExistence(timeout: 10))
        XCTAssertTrue(row(app, "10월 15일").waitForExistence(timeout: 10))
        sleep(1)
        shot(app, "3-archive")
        row(app, "10월 15일").press(forDuration: 1.2)
        XCTAssertTrue(app.buttons["되돌리기"].waitForExistence(timeout: 5))
        app.buttons["되돌리기"].tap()
        XCTAssertTrue(row(app, "10월 15일").waitForNonExistence(timeout: 15), "되돌린 예약이 보관함에 남음")

        let oct12 = row(app, "10월 12일")
        oct12.press(forDuration: 1.2)
        XCTAssertTrue(app.buttons["삭제"].waitForExistence(timeout: 5))
        app.buttons["삭제"].tap()
        confirm(app, "이 예약을 목록에서 삭제할까요?", button: "삭제", shotName: nil)
        XCTAssertTrue(row(app, "10월 12일").waitForNonExistence(timeout: 15), "보관함에서 삭제가 안 됨")
        shot(app, "3b-archive-after")
        app.navigationBars["보관함"].buttons.element(boundBy: 0).tap()

        // 되돌린 10/15 는 목록에 다시, 보관함은 1
        XCTAssertTrue(appear(app, row(app, "10월 15일")), "되돌린 예약이 목록에 없음")
        XCTAssertTrue(appear(app, app.buttons["보관함 (1)"]))

        // 밀기 → 삭제 / 보관 둘 다
        let oct10 = row(app, "10월 10일")
        scrollTo(app, oct10)
        oct10.swipeLeft()
        XCTAssertTrue(app.buttons["보관"].waitForExistence(timeout: 5), "밀기에 보관 없음")
        XCTAssertTrue(app.buttons["삭제"].exists, "밀기에 삭제 없음")
        shot(app, "5-swipe")
        oct10.swipeRight()

        // 편집 → 한 개 골라 삭제 (10/15)
        let edit2 = app.buttons["pastEditButton"]
        scrollTo(app, edit2)
        edit2.tap()
        XCTAssertTrue(selects.firstMatch.waitForExistence(timeout: 5))
        selects.element(boundBy: 0).tap()
        app.buttons["삭제 (1)"].tap()
        confirm(app, "이 예약을 목록에서 삭제할까요?", button: "삭제", shotName: nil)
        XCTAssertTrue(row(app, "10월 15일").waitForNonExistence(timeout: 15), "편집 삭제가 안 됨")
        sleep(1)
        shot(app, "6-host-after")
    }

    func testGuestSide() throws {
        let app = try launch()
        openSegment(app, "내가 한 예약")
        for day in ["10월 10일", "10월 12일", "10월 15일", "10월 18일"] {
            let r = row(app, day)
            scrollTo(app, r)
            XCTAssertTrue(r.waitForExistence(timeout: 15), "게스트 쪽에서 \(day) 예약이 사라짐")
        }
        XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "보관함")).firstMatch.exists, "게스트에게 호스트 보관함이 보임")
        sleep(1)
        shot(app, "4-guest-side")
    }

    // MARK: - 도우미

    private func launch() throws -> XCUIApplication {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["예약"].waitForExistence(timeout: 30))
        return app
    }

    private func openSegment(_ app: XCUIApplication, _ name: String) {
        app.tabBars.buttons["예약"].tap()
        let seg = app.segmentedControls.buttons[name]
        XCTAssertTrue(seg.waitForExistence(timeout: 10))
        seg.tap()
    }

    private func row(_ app: XCUIApplication, _ day: String) -> XCUIElement {
        app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", day)).firstMatch
    }

    /// 화면 아래에 있을 수 있는 것 — 잠깐 기다렸다가 없으면 내려 가며 찾는다
    private func appear(_ app: XCUIApplication, _ element: XCUIElement) -> Bool {
        if element.waitForExistence(timeout: 5), element.isHittable { return true }
        scrollTo(app, element)
        return element.waitForExistence(timeout: 5)
    }

    private func scrollTo(_ app: XCUIApplication, _ element: XCUIElement) {
        var tries = 0
        while (!element.exists || !element.isHittable) && tries < 6 {
            app.swipeUp()
            tries += 1
        }
    }

    private func confirm(_ app: XCUIApplication, _ title: String, button: String, shotName: String?) {
        XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 5), "확인창 '\(title)' 없음")
        if let shotName { shot(app, shotName) }
        // 확인창의 버튼은 메뉴 버튼과 이름이 같을 수 있어 마지막 것을 누른다
        let buttons = app.buttons.matching(NSPredicate(format: "label == %@", button))
        buttons.element(boundBy: buttons.count - 1).tap()
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let s = app.screenshot()
        let a = XCTAttachment(screenshot: s)
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = shotDir {
            try? s.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
