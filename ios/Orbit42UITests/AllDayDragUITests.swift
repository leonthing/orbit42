import XCTest

/// 하루 보기 종일↔시간 끌기 (개선-34).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_DRAG_DATE(yyyy-MM-dd), TEST_RUNNER_DRAG_HOLD(초, 끄는 중 캡처용)
/// 그 날에 일정 준비: "T34 시간"(10:00–11:00) · "T34 종일" · "T34 여러날"(이틀 종일) · "T34 반복"(14:00, 매일)
/// 서버 값(종일 여부·시각)은 바깥 스크립트가 단계마다 확인한다.
final class AllDayDragUITests: XCTestCase {
    private var app: XCUIApplication!
    private var hold: Double = 1

    private func launch() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let date = env["DRAG_DATE"] else { throw XCTSkip("DEMO_TOKEN·DRAG_DATE 필요") }
        hold = Double(env["DRAG_HOLD"] ?? "1") ?? 1
        app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        app.open(URL(string: "orbit42://calendar?date=\(date)")!)
        XCTAssertTrue(text("T34 시간").waitForExistence(timeout: 20), "준비한 일정이 안 보임")
        sleep(1)
    }

    /// 종일 줄 일정은 버튼 하나로 묶여 보여서 종류를 가리지 않고 찾는다
    private func text(_ title: String) -> XCUIElement {
        let p = NSPredicate(format: "label CONTAINS %@", title)
        let st = app.staticTexts.matching(p).firstMatch
        return st.exists ? st : app.descendants(matching: .any).matching(p).firstMatch
    }

    private func center(_ e: XCUIElement) -> XCUICoordinate {
        e.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    }

    /// 시간축의 "HH:00" 칸 오른쪽
    private func hourSlot(_ hour: Int) -> XCUICoordinate {
        let label = app.staticTexts[String(format: "%02d:00", hour)].firstMatch
        XCTAssertTrue(label.exists, "\(hour)시 줄이 안 보임")
        return label.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).withOffset(CGVector(dx: 150, dy: 4))
    }

    /// 종일 줄 ("종일" 글자 오른쪽)
    private func allDayRow() -> XCUICoordinate {
        let label = app.staticTexts["종일"].firstMatch
        XCTAssertTrue(label.exists, "종일 줄이 안 보임")
        return center(label).withOffset(CGVector(dx: 160, dy: 0))
    }

    private func toast(_ contains: String) -> XCUIElement { text(contains) }

    /// ① 종일 → 시간 → (되돌리기 없이) ② 시간 → 종일 → 되돌리기 → 시간으로 남음
    func testOrbitAllDayRoundTrip() throws {
        try launch()
        // ① 종일 줄의 일정을 15시 칸으로 끌어내림
        center(text("T34 종일")).press(forDuration: 0.7, thenDragTo: hourSlot(15), withVelocity: .slow, thenHoldForDuration: hold)
        XCTAssertTrue(toast("시간 일정으로 바꿨어요").waitForExistence(timeout: 10), "시간으로 바꾼 안내 없음")
        attach("1-down-done")
        print("STEP down-done")
        sleep(6) // 안내가 사라지고 서버 반영
        // ② 같은 일정을 종일 줄로 끌어올림
        let timed = text("T34 종일")
        XCTAssertTrue(timed.waitForExistence(timeout: 10))
        center(timed).press(forDuration: 0.7, thenDragTo: allDayRow(), withVelocity: .slow, thenHoldForDuration: hold)
        XCTAssertTrue(toast("종일 일정으로 바꿨어요").waitForExistence(timeout: 10), "종일로 바꾼 안내 없음")
        attach("2-up-done")
        let undo = app.buttons["convertUndo"]
        XCTAssertTrue(undo.exists, "되돌리기 버튼 없음")
        undo.tap()
        XCTAssertTrue(toast("되돌렸어요").waitForExistence(timeout: 10), "되돌린 안내 없음")
        sleep(2)
        attach("3-undo-done")
    }

    /// 시간 일정 → 종일 → 되돌리기 (원래 10:00–11:00)
    func testTimedToAllDayUndo() throws {
        try launch()
        center(text("T34 시간")).press(forDuration: 0.7, thenDragTo: allDayRow(), withVelocity: .slow, thenHoldForDuration: hold)
        XCTAssertTrue(toast("종일 일정으로 바꿨어요").waitForExistence(timeout: 10), "종일로 바꾼 안내 없음")
        attach("4-timed-up")
        app.buttons["convertUndo"].tap()
        XCTAssertTrue(toast("되돌렸어요").waitForExistence(timeout: 10))
        sleep(2)
        attach("5-timed-undo")
    }

    /// 막는 일정: 여러 날 종일(꾹 누름), 반복(종일 칸으로 끌기)
    func testLockedNotices() throws {
        try launch()
        center(text("T34 여러날")).press(forDuration: 1.0)
        XCTAssertTrue(toast("여러 날에 걸친 종일 일정").waitForExistence(timeout: 5), "여러 날 안내 없음")
        attach("6-multiday-notice")
        sleep(4)
        let rep = text("T34 반복")
        if !rep.isHittable { app.swipeUp() }
        center(rep).press(forDuration: 0.7, thenDragTo: allDayRow(), withVelocity: .slow, thenHoldForDuration: 0.5)
        XCTAssertTrue(toast("반복 일정은").waitForExistence(timeout: 5), "반복 안내 없음")
        attach("7-recurring-notice")
    }

    /// 참석자가 있는 구글 일정("T34 참석자", 17:00) → 종일 칸 → 확인 창 → 취소 (아무것도 안 바뀜)
    func testAttendeeConfirmCancel() throws {
        try launch()
        let block = text("T34 참석자")
        XCTAssertTrue(block.waitForExistence(timeout: 10))
        if !block.isHittable { app.swipeUp() }
        center(block).press(forDuration: 0.7, thenDragTo: allDayRow(), withVelocity: .slow, thenHoldForDuration: hold)
        let alert = app.alerts["일정을 바꿀까요?"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5), "참석자 확인 창 없음")
        attach("9-attendee-confirm")
        alert.buttons["취소"].tap()
        sleep(2)
        XCTAssertFalse(toast("종일 일정으로 바꿨어요").exists, "취소했는데 바뀜")
    }

    /// 저장 실패 → 원래 자리로 되돌림. "T34 실패"(시간 일정)를 화면에 띄운 뒤 SHOT_DIR/ready 를 남기고,
    /// 바깥 스크립트가 서버에서 그 일정을 지운 다음 SHOT_DIR/go 를 만들면 종일 칸으로 끈다.
    func testFailureReverts() throws {
        try launch()
        let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] ?? NSTemporaryDirectory()
        let block = text("T34 실패")
        XCTAssertTrue(block.waitForExistence(timeout: 10))
        FileManager.default.createFile(atPath: "\(dir)/ready", contents: Data())
        let deadline = Date().addingTimeInterval(60)
        while !FileManager.default.fileExists(atPath: "\(dir)/go") && Date() < deadline { usleep(300_000) }
        center(block).press(forDuration: 0.7, thenDragTo: allDayRow(), withVelocity: .slow, thenHoldForDuration: 0.5)
        let alert = app.alerts["시간을 바꾸지 못했어요"]
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "실패 알림 없음")
        attach("10-failure-alert")
        alert.buttons["확인"].tap()
        sleep(1)
        // 시간축 블록에만 있는 '시각' 줄이 다시 보이면 원래 자리(시간 일정)로 돌아온 것
        XCTAssertTrue(text("12:00–13:00").waitForExistence(timeout: 5), "실패 뒤 원래 자리로 안 돌아옴")
        XCTAssertFalse(toast("종일 일정으로 바꿨어요").exists)
        attach("11-failure-reverted")
    }

    /// 예약 일정 꾹 누름 → 안내 (DRAG_DATE 를 예약 일정이 있는 날로, TEST_RUNNER_BOOKING_TITLE)
    func testBookingNotice() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let date = env["DRAG_DATE"], let title = env["BOOKING_TITLE"] else { throw XCTSkip("BOOKING_TITLE 필요") }
        app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        app.open(URL(string: "orbit42://calendar?date=\(date)")!)
        let block = text(title)
        XCTAssertTrue(block.waitForExistence(timeout: 20))
        if !block.isHittable { app.swipeUp() }
        center(block).press(forDuration: 1.0)
        XCTAssertTrue(toast("예약 일정은").waitForExistence(timeout: 5), "예약 안내 없음")
        attach("8-booking-notice")
    }

    private func attach(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
