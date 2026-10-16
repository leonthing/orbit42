import XCTest

/// 하루 보기 '다른 날로 끌기' 합성 제스처 (1.5.1 버그-4).
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_DRAG_DATE(yyyy-MM-dd), TEST_RUNNER_DRAG_TITLE, TEST_RUNNER_DRAG_HOLD(초), TEST_RUNNER_DRAG_TARGET(edge|strip:N)
/// 결과(옮겨진 날짜)는 바깥 스크립트가 서버에서 확인한다 — 여기서는 제스처만 하고 화면을 남긴다.
final class DragToOtherDayUITests: XCTestCase {
    func testDragToEdgeAndRelease() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"], let date = env["DRAG_DATE"], let title = env["DRAG_TITLE"] else {
            throw XCTSkip("DEMO_TOKEN·DRAG_DATE·DRAG_TITLE 필요")
        }
        let hold = Double(env["DRAG_HOLD"] ?? "1.0") ?? 1.0
        let target = env["DRAG_TARGET"] ?? "edge"

        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        app.open(URL(string: "orbit42://calendar?date=\(date)")!)

        let block = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
        XCTAssertTrue(block.waitForExistence(timeout: 20), "일정 블록이 안 보임")
        sleep(1)
        attach(app, "1-before")

        let start = block.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let frame = app.windows.firstMatch.frame
        let end: XCUICoordinate
        if target.hasPrefix("strip:") {
            // 위쪽 주간 날짜 칸: 그 날짜 숫자 텍스트 위
            let day = String(target.dropFirst("strip:".count))
            let cell = app.staticTexts.matching(NSPredicate(format: "label == %@", day)).firstMatch
            XCTAssertTrue(cell.exists, "주간 칸 \(day) 없음")
            end = cell.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        } else {
            let origin = app.windows.firstMatch.coordinate(withNormalizedOffset: .zero)
            end = origin.withOffset(CGVector(dx: frame.width - 8, dy: block.frame.midY))
        }
        let startDay = headerDay(app)
        start.press(forDuration: 0.7, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: hold)
        sleep(1)
        attach(app, "2-after-release")
        let afterRelease = headerDay(app)
        // 손을 뗀 뒤 3초 — 날짜가 튕겨 돌아가거나 계속 넘어가지 않아야 한다
        sleep(3)
        attach(app, "3-after-3s")
        let later = headerDay(app)
        print("DRAG_RESULT start=\(startDay) release=\(afterRelease) later=\(later)")
        XCTAssertEqual(later, afterRelease, "손을 뗀 뒤 날짜가 멈춰 있어야 함")
        guard !target.hasPrefix("strip:") else { return }   // 주간 칸에 놓기는 보던 날에 남고 '보기' 알림 — 옮겨진 날짜는 바깥에서 확인
        XCTAssertNotEqual(afterRelease, startDay, "놓은 뒤 넘어간 날에 있어야 함(튕김 없음)")
        let moved = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
        XCTAssertTrue(moved.waitForExistence(timeout: 5), "넘어간 날에 옮긴 일정이 보여야 함")
    }

    /// 하루 보기 머리의 "10월 27일 (화)"
    private func headerDay(_ app: XCUIApplication) -> String {
        let q = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+월 [0-9]+일 \\(.\\)$"))
        return q.firstMatch.exists ? q.firstMatch.label : "?"
    }

    private func attach(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot())
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }
}
