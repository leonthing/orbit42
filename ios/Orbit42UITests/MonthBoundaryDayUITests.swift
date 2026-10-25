import XCTest

/// 하루 보기에서 달이 바뀌는 날로 넘어갈 때 시간표가 비거나 멈추지 않아야 한다 (1.6.0 빌드 40 Leo 신고 → 빌드 41).
/// 원인: 옆 달 미리 받기 중에 그 달로 들어가면 표시 달 불러오기가 건너뛰어지고, 미리 받기는 화면 교체로 취소돼 빈칸으로 멈췄다.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN(테스트 계정, 종료 없는 반복 4종: 매주 일요일·격주·매일·매월),
/// TEST_RUNNER_MONTH_DELAY(초, 느린 응답 흉내 — 구글 일정이 많은 계정), TEST_RUNNER_SHOT_DIR.
final class MonthBoundaryDayUITests: XCTestCase {
    func testOctToNovByArrow() throws { try run(startDate: "2026-10-28", steps: 7, swipe: false, landing: "11월 1일", tag: "nov-arrow") }
    func testOctToNovMondayWeek() throws { try run(startDate: "2026-10-28", steps: 7, swipe: true, landing: "11월 1일", tag: "nov-monday", weekStart: 2) }
    func testDecToJanMondayWeek() throws { try run(startDate: "2026-12-29", steps: 6, swipe: false, landing: "1월 1일", tag: "jan-monday", weekStart: 2) }
    /// 새 달 첫날에 바로 여는 경우와 같은 흐름 — 앱을 열자마자 11/1 하루 보기
    func testLaunchStraightIntoNov1() throws {
        guard let token = ProcessInfo.processInfo.environment["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchArguments += ["-calendarScheduleMode", "day"]
        if let d = ProcessInfo.processInfo.environment["MONTH_DELAY"] { app.launchEnvironment["DEMO_MONTH_DELAY"] = d }
        app.launch()
        app.open(URL(string: "orbit42://calendar?date=2026-11-01")!)
        XCTAssertTrue(app.staticTexts["T③ 매일"].firstMatch.waitForExistence(timeout: 20), "11/1 일정이 안 보임")
        XCTAssertTrue(app.staticTexts["10:00"].exists)
        shot(app, "launch-nov1")
    }
    func testOctToNovBySwipe() throws { try run(startDate: "2026-10-28", steps: 7, swipe: true, landing: "11월 1일", tag: "nov-swipe") }
    func testDecToJanByArrow() throws { try run(startDate: "2026-12-29", steps: 6, swipe: false, landing: "1월 1일", tag: "jan-arrow") }
    func testDecToJanBySwipe() throws { try run(startDate: "2026-12-29", steps: 6, swipe: true, landing: "1월 1일", tag: "jan-swipe") }

    private func run(startDate: String, steps: Int, swipe: Bool, landing: String, tag: String, weekStart: Int = 1) throws {
        guard let token = ProcessInfo.processInfo.environment["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchArguments += ["-calendarScheduleMode", "day", "-weekStart", "<integer>\(weekStart)</integer>"]
        if let d = ProcessInfo.processInfo.environment["MONTH_DELAY"] { app.launchEnvironment["DEMO_MONTH_DELAY"] = d }
        app.launch()
        let next = app.buttons["다음날"]
        XCTAssertTrue(next.waitForExistence(timeout: 20))
        app.open(URL(string: "orbit42://calendar?date=\(startDate)")!)
        XCTAssertTrue(app.staticTexts["T③ 매일"].firstMatch.waitForExistence(timeout: 20), "시작 날짜 일정이 안 보임")
        sleep(1)
        var log: [String] = []
        var landedAt: Int?
        for i in 0..<steps {
            if swipe { app.swipeLeft() } else { next.tap() }
            usleep(600_000)
            let day = header(app)
            let grid = app.staticTexts["10:00"].exists || app.staticTexts["12:00"].exists
            log.append("\(i):\(day):grid=\(grid)")
            if day.hasPrefix(landing), landedAt == nil {
                landedAt = i
                shot(app, "\(tag)-1-landing")
            }
        }
        print("BOUNDARY \(tag) " + log.joined(separator: " "))
        XCTAssertNotNil(landedAt, "\(landing)에 도착하지 못함(앞뒤 이동 막힘): \(log)")
        XCTAssertFalse(log.contains { $0.contains("grid=false") }, "시간표가 빈 날이 있음: \(log)")
        // 마지막 날에서 받는 중 표시가 사라지고 일정이 보여야 한다
        let status = app.descendants(matching: .any)["monthLoadStatus"]
        let gone = NSPredicate(format: "exists == false")
        let wait = expectation(for: gone, evaluatedWith: status)
        XCTAssertEqual(XCTWaiter().wait(for: [wait], timeout: 15), .completed, "받는 중 표시가 사라지지 않음")
        XCTAssertTrue(app.staticTexts["T③ 매일"].firstMatch.waitForExistence(timeout: 5), "새 달 일정(매일 반복)이 안 보임")
        shot(app, "\(tag)-2-loaded")
        // 뒤로 한 칸 — 이전 달로 돌아가도 된다
        let before = header(app)
        for _ in 0..<(steps - (landedAt ?? 0)) { app.buttons["전날"].tap(); usleep(400_000) }
        sleep(1)
        let back = header(app)
        print("BOUNDARY \(tag) back \(before) -> \(back)")
        XCTAssertNotEqual(back, before, "뒤로 이동이 막힘")
        XCTAssertTrue(app.staticTexts["10:00"].exists || app.staticTexts["12:00"].exists, "뒤로 간 날 시간표가 비어 있음")
    }

    private func header(_ app: XCUIApplication) -> String {
        let q = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+월 [0-9]+일 \\(.\\)$"))
        return q.firstMatch.exists ? q.firstMatch.label : "?"
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
