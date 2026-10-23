import XCTest

/// 숨은 동작 꺼내기 (개선-26) + 문구 정리 (개선-27) 캡처.
/// 실행: 로컬 서버 + 테스트 호스트 계정의 TEST_RUNNER_DEMO_TOKEN, TEST_RUNNER_SHOT_DIR.
/// 테스트 데이터: 받은 예약 10/15 확정(지난)·10/10 완료·11/25 취소, 보관함 10/5 완료,
/// 캘린더 '업무'(함께 쓰는 사람 1명), 이동시간 '강남 사무실'(별칭 2), 서비스 '1:1 컨설팅', 예약 링크 '커피챗'(직접 고른 시간 2, 위치 2).
/// 데이터를 바꾸는 버튼은 누르지 않고 화면만 확인한다.
final class HiddenActionsUITests: XCTestCase {
    private var shotDir: String?

    func testBookingActionsVisible() throws {
        let app = try launch()
        app.tabBars.buttons["예약"].tap()
        let seg = app.segmentedControls.buttons["받은 예약"]
        XCTAssertTrue(seg.waitForExistence(timeout: 10))
        seg.tap()

        // 지난 확정 예약 행에 '완료 처리'가 바로 보인다
        let complete = app.buttons["완료 처리"]
        scrollTo(app, complete)
        XCTAssertTrue(complete.waitForExistence(timeout: 15), "행에 완료 처리 버튼 없음")
        sleep(1)
        shot(app, "1-row-complete")

        // 상세 → ⋯ → 보관·삭제
        row(app, "10월 15일").tap()
        let more = app.buttons["bookingDetailMore"]
        XCTAssertTrue(more.waitForExistence(timeout: 10), "상세에 ⋯ 없음")
        more.tap()
        XCTAssertTrue(app.buttons["보관"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["삭제"].exists)
        sleep(1)
        shot(app, "2-detail-menu")
        app.buttons["보관"].tap()
        XCTAssertTrue(app.staticTexts["이 예약을 보관할까요?"].waitForExistence(timeout: 5))
        shot(app, "2b-detail-archive-confirm")
        dismissPopover(app)
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // 앞으로 있을 취소된 예약도 상세에서
        let canceled = row(app, "11월 25일")
        scrollTo(app, canceled)
        canceled.tap()
        XCTAssertTrue(more.waitForExistence(timeout: 10), "취소된 예약 상세에 ⋯ 없음")
        more.tap()
        XCTAssertTrue(app.buttons["보관"].waitForExistence(timeout: 5))
        shot(app, "3-canceled-detail-menu")
        app.buttons["보관"].tap()
        dismissPopover(app)
        app.navigationBars.buttons.element(boundBy: 0).tap()

        // 보관함 → 상세 → ⋯ → 되돌리기·삭제
        let archive = app.buttons["보관함 (1)"]
        scrollTo(app, archive)
        archive.tap()
        XCTAssertTrue(app.navigationBars["보관함"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["예약을 눌러 오른쪽 위 ⋯ 에서 되돌리거나 삭제할 수 있어요"].exists, "보관함 안내 문구")
        shot(app, "4-archive-list")
        row(app, "10월 5일").tap()
        XCTAssertTrue(more.waitForExistence(timeout: 10))
        more.tap()
        XCTAssertTrue(app.buttons["보관함에서 되돌리기"].waitForExistence(timeout: 5))
        sleep(1)
        shot(app, "4b-archived-detail-menu")
    }

    func testSettingsActionsVisible() throws {
        let app = try launch()
        app.tabBars.buttons["프로필"].tap()
        app.buttons["설정"].tap()

        // 내 캘린더 → 업무 → 삭제 버튼, 함께 쓰기 → 내보내기 메뉴
        app.staticTexts["내 캘린더"].tap()
        let work = app.staticTexts["업무"]
        XCTAssertTrue(work.waitForExistence(timeout: 15))
        sleep(1)
        shot(app, "5-calendar-list")
        work.tap()
        let calDelete = app.buttons["이 캘린더 삭제"]
        scrollTo(app, calDelete)
        XCTAssertTrue(calDelete.waitForExistence(timeout: 10), "캘린더 편집에 삭제 없음")
        shot(app, "5b-calendar-editor-delete")
        calDelete.tap()
        XCTAssertTrue(app.staticTexts["'업무' 캘린더를 삭제할까요?"].waitForExistence(timeout: 5))
        shot(app, "5c-calendar-delete-confirm")
        // 확인창 바깥 누르기는 말풍선 위치에 따라 '삭제'에 닿을 수 있어, 앱을 다시 띄워 닫는다
        app.terminate()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["프로필"].waitForExistence(timeout: 30))
        app.tabBars.buttons["프로필"].tap()
        app.buttons["설정"].tap()
        app.staticTexts["내 캘린더"].tap()
        XCTAssertTrue(app.staticTexts["업무"].waitForExistence(timeout: 15))
        app.staticTexts["업무"].tap()
        let share = app.staticTexts["함께 쓰기"]
        scrollTo(app, share)
        share.tap()
        sleep(2)
        let memberMore = app.buttons["이게스트 더 보기"]
        XCTAssertTrue(memberMore.waitForExistence(timeout: 15), "함께 쓰는 사람 메뉴 없음")
        memberMore.tap()
        XCTAssertTrue(app.buttons["이 캘린더에서 내보내기"].waitForExistence(timeout: 5))
        sleep(1)
        shot(app, "6-calendar-share-member-menu")
        app.swipeDown(velocity: .fast)
    }

    func testPlaceAndServiceVisible() throws {
        let app = try launch()
        app.tabBars.buttons["프로필"].tap()
        app.buttons["설정"].tap()

        let buffers = app.staticTexts["이동시간 버퍼"]
        scrollTo(app, buffers)
        buffers.tap()
        let place = app.staticTexts["강남 사무실"]
        XCTAssertTrue(place.waitForExistence(timeout: 15))
        shot(app, "7-place-list")
        place.tap()
        XCTAssertTrue(app.buttons["강남역 별칭 빼기"].waitForExistence(timeout: 10), "별칭 빼기 버튼 없음")
        let placeDelete = app.buttons["이 장소 삭제"]
        scrollTo(app, placeDelete)
        XCTAssertTrue(placeDelete.exists, "장소 삭제 버튼 없음")
        sleep(1)
        shot(app, "7b-place-editor")
        app.buttons["취소"].tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()

        let services = app.staticTexts["서비스"]
        scrollTo(app, services)
        services.tap()
        let menu = app.staticTexts["1:1 컨설팅"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        menu.tap()
        let hide = app.buttons["예약 화면에서 숨기기"]
        scrollTo(app, hide)
        XCTAssertTrue(hide.waitForExistence(timeout: 10), "서비스 숨기기 없음")
        XCTAssertTrue(app.buttons["이 서비스 삭제"].exists)
        sleep(1)
        shot(app, "8-service-editor")
    }

    func testBookingLinkVisible() throws {
        let app = try launch()
        app.tabBars.buttons["예약"].tap()
        let seg = app.segmentedControls.buttons["예약 링크"]
        XCTAssertTrue(seg.waitForExistence(timeout: 10))
        seg.tap()
        let link = app.staticTexts["커피챗"]
        XCTAssertTrue(link.waitForExistence(timeout: 15))
        link.tap()
        let edit = app.buttons["편집"]
        XCTAssertTrue(edit.waitForExistence(timeout: 15))
        edit.tap()
        XCTAssertTrue(app.staticTexts["예약을 받고 있어요"].waitForExistence(timeout: 15), "예약 받기 상태 줄 없음")
        XCTAssertTrue(app.buttons["멈추기"].exists)
        sleep(1)
        shot(app, "9-link-active")
        XCTAssertTrue(app.buttons["강남역 위치 빼기"].exists || { scrollTo(app, app.buttons["강남역 위치 빼기"]); return app.buttons["강남역 위치 빼기"].exists }(), "위치 빼기 없음")
        shot(app, "9b-link-locations")
        let window = app.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "시간 삭제")).firstMatch
        scrollTo(app, window)
        XCTAssertTrue(window.exists, "직접 고른 시간 삭제 버튼 없음")
        sleep(1)
        shot(app, "9c-link-windows")
    }

    /// 온보딩 알림 단계 문구 (개선-27) — DEMO_ONBOARDING=1
    func testOnboardingNotificationCopy() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        shotDir = env["SHOT_DIR"]
        let app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launchEnvironment["DEMO_ONBOARDING"] = "1"
        app.launch()
        XCTAssertTrue(app.staticTexts["시작하기 전에"].waitForExistence(timeout: 30))
        app.buttons["이용약관과 개인정보처리방침에 모두 동의합니다"].tap()
        app.buttons["동의하고 계속"].tap()
        XCTAssertTrue(app.buttons["이대로 시작"].waitForExistence(timeout: 10))
        app.buttons["이대로 시작"].tap()
        XCTAssertTrue(app.buttons["기본 캘린더로 시작하기"].waitForExistence(timeout: 15))
        app.buttons["기본 캘린더로 시작하기"].tap()
        XCTAssertTrue(app.staticTexts["알림을 켜 주세요"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "타임슬롯")).firstMatch.exists)
        sleep(1)
        shot(app, "10-onboarding-notifications")
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

    /// iOS 26 확인창은 말풍선이라 '돌아가기'가 없을 수 있다 — 있으면 누르고, 없으면 바깥을 눌러 닫는다
    private func dismissPopover(_ app: XCUIApplication) {
        let back = app.buttons["돌아가기"]
        if back.exists && back.isHittable { back.tap(); return }
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)).tap()
        sleep(1)
    }

    private func row(_ app: XCUIApplication, _ day: String) -> XCUIElement {
        app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", day)).firstMatch
    }

    private func scrollTo(_ app: XCUIApplication, _ element: XCUIElement) {
        var tries = 0
        while (!element.exists || !element.isHittable) && tries < 6 {
            app.swipeUp()
            tries += 1
        }
    }

    private func scrollUpTo(_ app: XCUIApplication, _ element: XCUIElement) {
        var tries = 0
        while (!element.exists || !element.isHittable) && tries < 6 {
            app.swipeDown()
            tries += 1
        }
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
