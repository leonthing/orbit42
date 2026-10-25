import XCTest
import ObjectiveC

/// 개선-50 — 하루 보기 스크롤과 일정 터치.
/// 둘러보기 예시 데이터(서버 요청 없음) + BROWSE_DENSE_DAY=1 로 오늘을 긴 일정으로 채운다.
/// ① 일정 위에서 시작한 손가락도 바로 스크롤된다 ② 관성 중 일정 터치는 상세를 열지 않는다
/// ③ 멈춘 상태의 짧은 탭은 상세를 연다 ④ 꾹 눌러 끌기는 그대로 된다.
final class DayScrollTouchUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_DENSE_DAY"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "0"
        app.launchArguments += ["-calendarScheduleMode", name.contains("MonthList") ? "month" : "day"]
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        if name.contains("MonthList") { sleep(2); return }
        if !block("긴 일정 C").waitForExistence(timeout: 5) {
            app.buttons["하루 보기"].firstMatch.tap()
        }
        XCTAssertTrue(block("긴 일정 C").waitForExistence(timeout: 10), "하루 보기 긴 일정 없음")
        sleep(1)
    }

    private func block(_ title: String) -> XCUIElement {
        app.staticTexts[title].firstMatch
    }

    private var detailShown: Bool {
        app.descendants(matching: .any)["detail.importance"].exists
    }

    /// 화면에 보이는 긴 일정 하나 (스크롤 위치에 따라 달라서)
    private func visibleBlock() -> XCUIElement? {
        let window = app.windows.firstMatch.frame
        for t in ["긴 일정 A", "긴 일정 B", "긴 일정 C", "긴 일정 D", "긴 일정 E"] {
            let e = block(t)
            if e.exists, e.frame.minY > window.height * 0.3, e.frame.minY < window.height * 0.75 { return e }
        }
        return nil
    }

    /// 손가락을 일정 위에 대고 바로 밀면 스크롤된다(끌기·손잡이·체크가 가로채지 않음)
    func testScrollStartingOnEventBlock() throws {
        for direction in [-1.0, 1.0] {
            guard let target = visibleBlock() else { XCTFail("보이는 일정 없음"); return }
            let name = target.label
            let before = target.frame.minY
            let start = target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: 220 * direction)), withVelocity: .default, thenHoldForDuration: 0.3)
            sleep(1)
            let after = block(name).exists ? block(name).frame.minY : .nan
            print("SCROLL_ON_BLOCK dir=\(direction) \(name) before=\(before) after=\(after)")
            XCTAssertFalse(detailShown, "스크롤인데 상세가 열림")
            XCTAssertTrue(after.isNaN || abs(after - before) > 100, "일정 위에서 시작한 스크롤이 안 됨 (\(before)→\(after))")
            shot("1-scroll-\(direction < 0 ? "up" : "down")")
            if detailShown { dismissDetail() }
        }
        // 일정 체크 동그라미 근처(왼쪽 끝)에서 시작해도
        guard let target = visibleBlock() else { return }
        let before = target.frame.minY
        let name = target.label
        let start = target.coordinate(withNormalizedOffset: CGVector(dx: 0.03, dy: 0.1))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -200)), withVelocity: .default, thenHoldForDuration: 0.3)
        sleep(1)
        let after = block(name).exists ? block(name).frame.minY : .nan
        print("SCROLL_ON_CHECK before=\(before) after=\(after)")
        XCTAssertTrue(after.isNaN || abs(after - before) > 100, "체크 동그라미에서 시작한 스크롤이 안 됨")
    }

    /// 빠르게 밀고 관성 중에 일정을 누르면 스크롤만 멈추고 상세는 열리지 않는다
    func testTouchDuringMomentumDoesNotOpenDetail() throws {
        let window = app.windows.firstMatch
        let from = window.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.85))
        let to = window.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.35))
        let ref = block("긴 일정 E")
        // XCUITest 는 동작마다 앱 애니메이션이 멈추길 기다려 관성 중 터치를 못 만든다 — 이 테스트에서만 기다림을 끈다
        Self.disableQuiescenceWait()
        defer { Self.restoreQuiescenceWait() }
        from.press(forDuration: 0.01, thenDragTo: to, withVelocity: .fast, thenHoldForDuration: 0)
        // 관성이 남아 있는 동안 화면 가운데(일정이 거의 다 채운 곳)를 짧게 누른다
        let y1 = ref.frame.minY
        let y2 = ref.frame.minY
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.6)).tap()
        let y3 = ref.frame.minY
        sleep(1)
        let y4 = ref.frame.minY
        shot("2-momentum-tap")
        // y1≠y2 면 누르기 직전까지 움직이고 있었다, y3=y4 면 누른 뒤 멈췄다
        print("MOMENTUM_TAP movedAfterRelease=\(y2 != y3) stoppedAfterTap=\(y3 == y4) y=\(y1),\(y2),\(y3),\(y4) detail=\(detailShown)")
        XCTAssertFalse(detailShown, "관성 중 터치로 상세가 열림")
        if detailShown { dismissDetail() }
    }

    /// 멈춘 상태에서 짧게 탭하면 상세가 열린다
    func testTapWhenStillOpensDetail() throws {
        sleep(1)
        guard let target = visibleBlock() else { XCTFail("보이는 일정 없음"); return }
        target.tap()
        XCTAssertTrue(app.descendants(matching: .any)["detail.importance"].waitForExistence(timeout: 5), "멈춘 상태 탭인데 상세가 안 열림")
        shot("3-still-tap")
    }

    /// 꾹 눌러 끌기 — 둘러보기에선 놓으면 저장 대신 가입 안내가 뜬다(끌기가 시작됐다는 뜻)
    func testLongPressDragStillWorks() throws {
        guard let target = visibleBlock() else { XCTFail("보이는 일정 없음"); return }
        let start = target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
        start.press(forDuration: 0.8, thenDragTo: start.withOffset(CGVector(dx: 0, dy: 90)), withVelocity: .slow, thenHoldForDuration: 0.3)
        let prompt = app.buttons["browseSignup"]
        XCTAssertTrue(prompt.waitForExistence(timeout: 5), "꾹 눌러 끌기가 안 됨(놓은 뒤 저장 시도 없음)")
        XCTAssertFalse(detailShown, "끌기 뒤 상세가 열림")
        shot("4-drag")
    }

    /// 꾹 눌러 오른쪽 가장자리에 머물면 다음 날로 넘어간다(1.5.1 다른 날로 끌기) — 놓으면 저장 시도
    func testDragToOtherDayStillWorks() throws {
        guard let target = visibleBlock() else { XCTFail("보이는 일정 없음"); return }
        let header = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+월 [0-9]+일 \\(.\\)$")).firstMatch
        let startDay = header.label
        let start = target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
        let frame = app.windows.firstMatch.frame
        let edge = app.windows.firstMatch.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.width - 8, dy: start.screenPoint.y))
        start.press(forDuration: 0.8, thenDragTo: edge, withVelocity: .slow, thenHoldForDuration: 1.3)
        XCTAssertTrue(app.buttons["browseSignup"].waitForExistence(timeout: 5), "다른 날로 끌기가 안 됨")
        print("CROSS_DAY start=\(startDay)")
        shot("10-cross-day")
    }

    /// 아래 끝 손잡이를 꾹 눌러 끌면 길이 바꾸기 — 놓으면 저장 시도(둘러보기 가입 안내)
    func testResizeHandleStillWorks() throws {
        guard let target = visibleBlock() else { XCTFail("보이는 일정 없음"); return }
        let window = app.windows.firstMatch.frame
        guard target.frame.maxY < window.height - 140 else {
            // 아래 끝이 화면 밖이면 위로 조금 올린다
            app.swipeUp(velocity: .slow); sleep(1); return try testResizeHandleStillWorks()
        }
        let handle = app.windows.firstMatch.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: target.frame.midX, dy: target.frame.maxY - 5))
        handle.press(forDuration: 0.8, thenDragTo: handle.withOffset(CGVector(dx: 0, dy: 60)), withVelocity: .slow, thenHoldForDuration: 0.3)
        XCTAssertTrue(app.buttons["browseSignup"].waitForExistence(timeout: 5), "손잡이 끌기가 안 됨")
        XCTAssertFalse(detailShown)
        shot("5-resize")
    }

    /// 끌 수 없는 예약 일정은 꾹 누르면 이유 안내 (개선-34)
    func testLockedBookingShowsNotice() throws {
        let booking = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "커피챗 30분")).firstMatch
        XCTAssertTrue(booking.waitForExistence(timeout: 5), "예약 블록 없음")
        let window = app.windows.firstMatch.frame
        for _ in 0..<4 where booking.frame.minY > window.height * 0.7 { app.swipeUp(velocity: .slow); sleep(1) }
        booking.press(forDuration: 0.9)
        let notice = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "예약 화면에서 시간을 바꿀 수 있어요")).firstMatch
        XCTAssertTrue(notice.waitForExistence(timeout: 3), "예약 일정 꾹 누름 안내 없음")
        sleep(1)
        XCTAssertFalse(detailShown, "꾹 누름 뒤 상세가 열림")
        shot("6-locked")
    }

    /// 멈춘 상태에서 체크 동그라미 탭 — 완료 저장 시도(둘러보기 가입 안내)
    func testCheckboxTapStillWorks() throws {
        sleep(1)
        let window = app.windows.firstMatch.frame
        let checks = app.buttons.matching(NSPredicate(format: "label == %@", "완료로 표시"))
        XCTAssertTrue(checks.firstMatch.waitForExistence(timeout: 5))
        guard let check = checks.allElementsBoundByIndex.first(where: { $0.frame.minY > window.height * 0.35 && $0.frame.maxY < window.height * 0.8 }) else {
            XCTFail("화면 가운데 체크 동그라미 없음"); return
        }
        check.tap()
        XCTAssertTrue(app.buttons["browseSignup"].waitForExistence(timeout: 5), "체크 탭이 안 됨")
        shot("7-check")
    }

    /// 월 보기 아래 일정 목록 — 일정 줄 위에서 밀면 스크롤, 관성 중 터치는 상세 안 열림, 멈춘 탭은 열림
    func testMonthListScrollAndTap() throws {
        let row = app.staticTexts["긴 일정 D"].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 10), "월 보기 목록 없음")
        let window = app.windows.firstMatch
        let rowA = app.staticTexts["긴 일정 A"].firstMatch
        let before = rowA.frame.minY
        let start = rowA.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -150)), withVelocity: .default, thenHoldForDuration: 0.3)
        sleep(1)
        let after = rowA.frame.minY
        print("MONTH_SCROLL before=\(before) after=\(after) detail=\(detailShown)")
        XCTAssertFalse(detailShown, "목록 스크롤인데 상세가 열림")
        XCTAssertGreaterThan(abs(after - before), 40, "월 보기 목록이 일정 줄 위에서 스크롤 안 됨")
        shot("8-month-scroll")
        // 관성 중 터치
        app.swipeDown(velocity: .slow); sleep(1)
        Self.disableQuiescenceWait()
        let from = window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.9))
        from.press(forDuration: 0.01, thenDragTo: from.withOffset(CGVector(dx: 0, dy: -200)), withVelocity: .fast, thenHoldForDuration: 0)
        let y2 = rowA.frame.minY
        window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.82)).tap()
        let y3 = rowA.frame.minY
        Self.restoreQuiescenceWait()
        sleep(1)
        print("MONTH_MOMENTUM movedAfterRelease=\(y2 != y3) detail=\(detailShown)")
        XCTAssertFalse(detailShown, "월 보기 관성 중 터치로 상세가 열림")
        shot("9-month-momentum")
        // 멈춘 상태 탭
        sleep(1)
        let visible = ["긴 일정 A", "긴 일정 B", "긴 일정 C", "긴 일정 D", "긴 일정 E"].map { app.staticTexts[$0].firstMatch }
            .first { $0.exists && $0.isHittable && $0.frame.minY > window.frame.height * 0.5 && $0.frame.maxY < window.frame.height * 0.85 }
        guard let visible else { XCTFail("보이는 줄 없음"); return }
        visible.tap()
        XCTAssertTrue(app.descendants(matching: .any)["detail.importance"].waitForExistence(timeout: 5), "월 보기 멈춘 탭인데 상세가 안 열림")
    }

    private static var savedQuiescence: [(Method, IMP)] = []

    static func disableQuiescenceWait() {
        guard savedQuiescence.isEmpty, let cls = NSClassFromString("XCUIApplicationProcess") else { return }
        let noop1: @convention(block) (AnyObject, Bool) -> Void = { _, _ in }
        let noop2: @convention(block) (AnyObject, Bool, Bool) -> Void = { _, _, _ in }
        for (name, block) in [("waitForQuiescenceIncludingAnimationsIdle:", noop1 as Any),
                              ("waitForQuiescenceIncludingAnimationsIdle:isPreEvent:", noop2 as Any)] {
            guard let m = class_getInstanceMethod(cls, NSSelectorFromString(name)) else { continue }
            savedQuiescence.append((m, method_getImplementation(m)))
            method_setImplementation(m, imp_implementationWithBlock(block))
        }
        print("QUIESCENCE_DISABLED \(savedQuiescence.count)")
    }

    static func restoreQuiescenceWait() {
        for (m, imp) in savedQuiescence { method_setImplementation(m, imp) }
        savedQuiescence = []
    }

    private func dismissDetail() {
        app.swipeDown(velocity: .fast)
        sleep(1)
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
