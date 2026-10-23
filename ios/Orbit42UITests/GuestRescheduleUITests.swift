import XCTest

/// 게스트 시간 변경 제안 (개선-29) 캡처.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR.
/// 테스트 데이터: 11/21 15:00 확정(게스트가 11/25 15:00 제안 중), 11/26 확정, 11/29 확정(제안 없음), 열린 시간 11/23·11/24.
/// - testGuestProposeSheet: 게스트 토큰. 11/29 예약 → 시간 변경 → 열린 시간 / 다른 시간 제안 → 제안 보내기
/// - testHostSeesProposal: 호스트 토큰. 받은 예약 목록·상세에 제안 배너와 수락/거절
final class GuestRescheduleUITests: XCTestCase {
    private var shotDir: String?

    func testGuestProposeSheet() throws {
        let app = try launch()
        openSegment(app, "내가 한 예약")
        XCTAssertTrue(app.otherElements["rescheduleRowNotice"].firstMatch.waitForExistence(timeout: 15), "내가 보낸 제안이 목록에 안 보임")
        sleep(1)
        shot(app, "1-guest-list-sent")

        row(app, "11월 29일").tap()
        let change = app.buttons["시간 변경"]
        XCTAssertTrue(change.waitForExistence(timeout: 10))
        change.tap()
        let segment = app.segmentedControls.buttons["다른 시간 제안"]
        XCTAssertTrue(segment.waitForExistence(timeout: 15), "다른 시간 제안 선택지가 없음")
        sleep(1)
        shot(app, "2-guest-sheet-open-times")
        segment.tap()
        XCTAssertTrue(app.staticTexts["열린 시간 밖이라도 괜찮아요. 호스트가 수락하시면 예약과 캘린더가 함께 옮겨져요."].waitForExistence(timeout: 5))
        let note = app.textFields["변경 사유 (선택)"]
        note.tap()
        note.typeText("평일 저녁이 더 편해요")
        sleep(1)
        shot(app, "3-guest-sheet-propose")
        app.navigationBars["시간 변경"].buttons["제안"].tap()
        XCTAssertTrue(app.staticTexts["변경 제안을 보냈어요"].waitForExistence(timeout: 15), "보낸 뒤 상세에 배너 없음")
        sleep(1)
        shot(app, "4-guest-detail-sent")
    }

    func testHostSeesProposal() throws {
        let app = try launch()
        openSegment(app, "받은 예약")
        let notice = app.staticTexts["게스트가 시간 변경을 제안했어요"].firstMatch
        XCTAssertTrue(notice.waitForExistence(timeout: 15), "받은 예약 목록에 제안 배너 없음")
        XCTAssertTrue(app.buttons["수락"].firstMatch.exists)
        XCTAssertTrue(app.buttons["거절"].firstMatch.exists)
        sleep(1)
        shot(app, "5-host-list-proposal")
        row(app, "11월 21일").tap()
        XCTAssertTrue(app.staticTexts["게스트가 시간 변경을 제안했어요"].waitForExistence(timeout: 10), "상세에 배너 없음")
        sleep(1)
        shot(app, "6-host-detail-proposal")
    }

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
