import XCTest

/// 개선-52 — 주 보기(범위 제목 + 목록) 날짜 줄을 밀면 지난주·다음 주. 요일은 유지.
/// 둘러보기 예시 데이터 + DEMO_MONTH_DELAY 로 한 달 응답이 느린 계정을 흉내 내 달 넘김 주에서 빈 화면·멈춤이 없는지 본다.
/// 캡처: SHOT_DIR(TEST_RUNNER_SHOT_DIR).
final class WeekStripSwipeUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        app.launchEnvironment["DEMO_MONTH_DELAY"] = "2"
        app.launchArguments += ["-calendarScheduleMode", "month"]
        // 월요일 시작이면 이번 주가 두 달에 걸친다(예: 10월 26일 ~ 11월 1일)
        if name.contains("Monday") { app.launchArguments += ["-weekStart", "2"] }
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(app.buttons["일정 추가"].waitForExistence(timeout: 10))
        sleep(3)
    }

    private var rangeTitle: XCUIElement {
        app.staticTexts.matching(NSPredicate(format: "label MATCHES '[0-9]+월 [0-9]+일 ~ [0-9]+월 [0-9]+일'")).firstMatch
    }

    /// 날짜 줄 한가운데에서 가로로 민다 (dx < 0 이면 왼쪽 = 다음 주)
    private func swipeStrip(_ dx: CGFloat) {
        let title = rangeTitle.frame
        let y = title.maxY + 48
        let window = app.windows.firstMatch
        let start = window.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: window.frame.midX - dx / 2, dy: y))
        start.press(forDuration: 0.02, thenDragTo: start.withOffset(CGVector(dx: dx, dy: 0)), withVelocity: .fast, thenHoldForDuration: 0)
    }

    /// 목록이 '불러오는 중'에 멈춰 있지 않다
    private func assertListSettles(_ context: String) {
        let loading = app.staticTexts["일정을 불러오는 중이에요"]
        let gone = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: loading)
        wait(for: [gone], timeout: 10)
        XCTAssertTrue(app.buttons["일정 추가"].isHittable, "\(context): 화면이 멈춤")
    }

    private func enterWeek() {
        let today = Calendar.current.component(.day, from: Date())
        let cell = app.buttons.matching(NSPredicate(format: "label == %@", "\(today)")).firstMatch
        XCTAssertTrue(cell.waitForExistence(timeout: 5))
        cell.tap() // 이미 선택된 오늘을 다시 누르면 주 보기
        XCTAssertTrue(rangeTitle.waitForExistence(timeout: 5), "주 보기로 못 들어감")
        sleep(1)
    }

    func testSwipeWeeks() throws {
        enterWeek()
        let start = rangeTitle.label
        shot("week-now")

        // ① 왼쪽으로 밀면 다음 주
        swipeStrip(-220)
        sleep(1)
        let next = rangeTitle.label
        XCTAssertNotEqual(next, start, "다음 주로 안 넘어감")
        // ② 달 넘김 주 — 느린 응답이어도 목록이 풀린다
        assertListSettles("다음 주")
        shot("week-next")

        // 오른쪽으로 두 번 → 지난주
        swipeStrip(220)
        sleep(1)
        XCTAssertEqual(rangeTitle.label, start, "이번 주로 안 돌아옴")
        swipeStrip(220)
        sleep(1)
        let prev = rangeTitle.label
        XCTAssertNotEqual(prev, start, "지난주로 안 넘어감")
        assertListSettles("지난주")

        // 달 경계를 빠르게 오가도(받는 중 취소) 멈추지 않는다
        for _ in 0..<2 {
            swipeStrip(-220); swipeStrip(-220)
            swipeStrip(220); swipeStrip(220)
        }
        swipeStrip(-220); swipeStrip(-220)
        sleep(1)
        XCTAssertEqual(rangeTitle.label, next, "빠르게 오간 뒤 다음 주가 아님")
        assertListSettles("빠르게 오간 뒤")
        shot("week-next-after-rapid")

        // ③ 날짜 칸 탭은 그대로 — 주는 안 바뀌고 주 보기에 머문다
        let cells = app.buttons.matching(identifier: "weekDay")
        XCTAssertGreaterThanOrEqual(cells.count, 7, "날짜 칸을 못 찾음")
        cells.element(boundBy: 3).tap()
        sleep(1)
        XCTAssertEqual(rangeTitle.label, next, "날짜 탭으로 주가 바뀜")
        // 세로로 미는 것은 주를 넘기지 않는다
        let window = app.windows.firstMatch
        let s = window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
        s.press(forDuration: 0.02, thenDragTo: s.withOffset(CGVector(dx: 0, dy: -200)), withVelocity: .fast, thenHoldForDuration: 0)
        sleep(1)
        XCTAssertEqual(rangeTitle.label, next, "세로 스크롤로 주가 바뀜")
    }

    /// 두 달에 걸친 주 — 넘겼다 돌아와도, 그 주 안에서 다음 달 날짜를 눌러도 멈추지 않는다
    func testMondayStartSpanningWeek() throws {
        enterWeek()
        let start = rangeTitle.label
        swipeStrip(-220)
        sleep(1)
        XCTAssertNotEqual(rangeTitle.label, start)
        assertListSettles("다음 주")
        swipeStrip(220)
        sleep(1)
        XCTAssertEqual(rangeTitle.label, start)
        assertListSettles("돌아온 주")
        // 그 주의 마지막 날(다음 달일 수 있음)을 누른다
        let cells = app.buttons.matching(identifier: "weekDay")
        XCTAssertGreaterThanOrEqual(cells.count, 7, "날짜 칸을 못 찾음")
        cells.element(boundBy: 6).tap()
        sleep(1)
        XCTAssertEqual(rangeTitle.label, start, "날짜 탭으로 주가 바뀜")
        assertListSettles("주 마지막 날")
        shot("week-spanning-lastday")
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
