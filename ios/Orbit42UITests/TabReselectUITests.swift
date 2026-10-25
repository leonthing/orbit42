import XCTest

/// 개선-49 — 보고 있는 탭을 다시 누르면: 캘린더는 오늘로(보기 종류 그대로), 나머지는 목록 맨 위로.
/// 둘러보기 예시 데이터로 돈다(서버 요청 없음). 실행: TEST_RUNNER_SHOT_DIR.
final class TabReselectUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchArguments += ["-calendarScheduleMode", "day"]
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
        XCTAssertTrue(app.tabBars.buttons["캘린더"].waitForExistence(timeout: 10))
        sleep(1)
    }

    /// 하루 보기 머리의 "10월 27일 (화)"
    private func headerDay() -> String {
        let q = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+월 [0-9]+일 \\(.\\)$"))
        return q.firstMatch.exists ? q.firstMatch.label : "?"
    }

    func testCalendarReselectGoesToToday() throws {
        let today = headerDay()
        // 다른 날짜로 — 머리의 다음 날 화살표 세 번
        let next = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "다음", "Forward")).firstMatch
        for _ in 0..<3 {
            if next.exists { next.tap() } else { app.swipeLeft() }
            sleep(1)
        }
        let other = headerDay()
        shot("1-other-day")
        XCTAssertNotEqual(other, today, "다른 날로 못 감")
        app.tabBars.buttons["캘린더"].tap()
        sleep(2)
        let back = headerDay()
        shot("2-reselect-today")
        print("RESELECT today=\(today) other=\(other) back=\(back)")
        XCTAssertEqual(back, today, "캘린더 탭 다시 누름으로 오늘로 안 옴")
        // 보기 종류(하루 보기)는 그대로 — 머리 형식이 하루 보기
        XCTAssertNotEqual(back, "?", "하루 보기가 아님")

        // 상세가 열려 있으면 아무것도 안 한다 (시트가 탭 바를 가려 누를 수 없거나, 눌러도 그대로)
    }

    func testOtherTabReselectScrollsToTop() throws {
        app.tabBars.buttons["리포트"].tap()
        sleep(2)
        let window = app.windows.firstMatch
        let topText = app.staticTexts.element(boundBy: 0)
        _ = topText.waitForExistence(timeout: 5)
        app.swipeUp(velocity: .fast); app.swipeUp(velocity: .fast)
        sleep(2)
        shot("3-report-scrolled")
        let scrolledFirst = firstVisibleLabel(in: window)
        app.tabBars.buttons["리포트"].tap()
        sleep(2)
        shot("4-report-top")
        let topFirst = firstVisibleLabel(in: window)
        print("REPORT_TOP scrolled=\(scrolledFirst) afterReselect=\(topFirst)")
        XCTAssertNotEqual(scrolledFirst, topFirst, "리포트 탭 다시 누름으로 맨 위로 안 감")
    }

    /// 화면 위쪽(내비 막대 아래)에 보이는 첫 글자
    private func firstVisibleLabel(in window: XCUIElement) -> String {
        let h = window.frame.height
        let texts = app.staticTexts.allElementsBoundByIndex.filter { $0.frame.minY > h * 0.15 && $0.frame.minY < h * 0.5 && !$0.label.isEmpty }
        return texts.min(by: { $0.frame.minY < $1.frame.minY })?.label ?? "?"
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
