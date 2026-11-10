import XCTest

/// 개선-44 — 오르빗 탭(빈 궤도는 한 줄로 접고 열린 시간을 맨 위로, 검색창 고정)과 설정 묶음.
/// 둘러보기 예시(서버 불필요). 빈 궤도는 DEBUG BROWSE_EMPTY_ORBIT=1.
final class OrbitSettingsTidyUITests: XCTestCase {
    private var app: XCUIApplication!

    private func launch(_ extra: [String: String] = [:]) {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["DEMO_LOGGED_OUT"] = "1"
        app.launchEnvironment["BROWSE_HIDE_BANNER"] = "1"
        for (k, v) in extra { app.launchEnvironment[k] = v }
        app.launch()
        let loginLink = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "로그인")).firstMatch
        XCTAssertTrue(loginLink.waitForExistence(timeout: 15))
        loginLink.tap()
        let browse = app.buttons["browseStart"]
        XCTAssertTrue(browse.waitForExistence(timeout: 10))
        for _ in 0..<3 where !browse.isHittable { app.swipeUp() }
        browse.tap()
    }

    private func tab(_ name: String) -> XCUIElement {
        let bar = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
        return bar.exists ? bar : app.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    private var searchField: XCUIElement { app.searchFields.firstMatch }

    func testOrbitFilledKeepsOrbitOnTopAndSearchPinned() throws {
        launch()
        XCTAssertTrue(tab("오르빗").waitForExistence(timeout: 10))
        tab("오르빗").tap()
        XCTAssertTrue(app.staticTexts["나를 중심으로, 요즘 만나는 사람들"].waitForExistence(timeout: 10), "궤도 칸 없음")
        XCTAssertFalse(app.buttons["orbitEmptyRow"].exists)
        XCTAssertTrue(searchField.waitForExistence(timeout: 5) && searchField.isHittable, "검색창이 처음부터 안 보임")
        sleep(1)
        shot("44-orbit-filled")
        for _ in 0..<3 { app.swipeUp() }
        XCTAssertTrue(searchField.exists && searchField.isHittable, "스크롤하면 검색창이 사라짐")
        // 추천은 아직 팔로우하지 않은 다른 사람(예시 작가) — 열린 시간 칸과 섞이지 않는다
        XCTAssertTrue(app.staticTexts["예시 작가"].firstMatch.exists || { app.swipeUp(); return app.staticTexts["예시 작가"].firstMatch.exists }(), "추천이 안 보임")
        shot("44-orbit-filled-scrolled")
    }

    func testOrbitEmptyCollapsesAndOpenTimesFirst() throws {
        launch(["BROWSE_EMPTY_ORBIT": "1"])
        tab("오르빗").tap()
        let row = app.buttons["orbitEmptyRow"]
        XCTAssertTrue(row.waitForExistence(timeout: 10), "빈 궤도 한 줄 없음")
        let header = app.staticTexts["팔로우한 사람들의 열린 시간"]
        XCTAssertTrue(header.exists)
        XCTAssertLessThan(header.frame.minY, row.frame.minY, "열린 시간이 맨 위가 아님")
        XCTAssertFalse(app.staticTexts["나를 중심으로, 요즘 만나는 사람들"].exists, "빈 궤도인데 큰 궤도 칸이 보임")
        XCTAssertTrue(searchField.isHittable)
        // 열린 시간 칸: 이미 팔로우한 사람이라 팔로우 버튼이 없고, 가장 가까운 열린 시간 한 줄이 있다
        let next = app.buttons["orbitNextOpen.coach.example"]
        XCTAssertTrue(next.waitForExistence(timeout: 10), "가장 가까운 열린 시간 줄 없음")
        XCTAssertTrue(next.label.contains("커리어 상담 40분") && next.label.contains("부터"), "줄 내용: \(next.label)")
        let followButtons = app.buttons.matching(NSPredicate(format: "label == %@", "팔로우")).allElementsBoundByIndex
            .filter { $0.frame.maxY < row.frame.minY }
        XCTAssertTrue(followButtons.isEmpty, "열린 시간 칸에 팔로우 버튼이 보임")
        sleep(1)
        shot("44-orbit-empty")
        row.tap()
        XCTAssertTrue(app.staticTexts["나를 중심으로, 요즘 만나는 사람들"].waitForExistence(timeout: 5), "펼치면 궤도 칸이 나와야 함")
        shot("44-orbit-empty-expanded")
        // 열린 시간 줄을 누르면 그 예약 링크(손님 화면)로
        for _ in 0..<3 where !next.isHittable { app.swipeDown() }
        next.tap()
        XCTAssertTrue(app.staticTexts["커리어 상담 40분"].firstMatch.waitForExistence(timeout: 10), "예약 링크로 안 감")
        shot("44-orbit-next-open-tapped")
    }

    /// 설정의 모든 항목이 새 묶음 어딘가에 있고, 들어가는 항목은 들어가진다
    func testSettingsGroupsKeepEveryItem() throws {
        launch()
        tab("프로필").tap()
        let gear = app.buttons["설정"]
        XCTAssertTrue(gear.waitForExistence(timeout: 10))
        gear.tap()
        XCTAssertTrue(app.navigationBars["설정"].waitForExistence(timeout: 5))
        for header in ["계정", "캘린더·연결", "예약 링크", "알림·화면", "정보·지원"] {
            let h = app.staticTexts[header].firstMatch
            for _ in 0..<6 where !h.exists { app.swipeUp() }
            XCTAssertTrue(h.exists, "묶음 없음: \(header)")
            for _ in 0..<6 where !app.navigationBars["설정"].exists { break }
        }
        shot("44-settings-bottom")
        for _ in 0..<6 { app.swipeDown() }
        shot("44-settings-top")

        let pushes = ["settings.account", "settings.blocked", "settings.calendars", "settings.google", "settings.peopleImport",
                      "settings.buffers", "settings.payment", "settings.services", "settings.linkTheme", "settings.notifications"]
        for id in pushes {
            let row = app.descendants(matching: .any)[id].firstMatch
            for _ in 0..<6 where !(row.exists && row.isHittable) { app.swipeUp() }
            for _ in 0..<6 where !(row.exists && row.isHittable) { app.swipeDown() }
            XCTAssertTrue(row.exists, "항목 없음: \(id)")
            row.tap()
            XCTAssertTrue(app.navigationBars.buttons.firstMatch.waitForExistence(timeout: 5))
            sleep(1)
            XCTAssertFalse(app.navigationBars["설정"].exists, "들어가지지 않음: \(id)")
            app.navigationBars.buttons.firstMatch.tap()
            XCTAssertTrue(app.navigationBars["설정"].waitForExistence(timeout: 5), "설정으로 못 돌아옴: \(id)")
        }
        // 들어가지 않는 항목은 자리만 확인 (토글·고르기·공유·피드백·바깥 링크)
        for id in ["settings.private", "settings.appearance", "settings.invite", "settings.feedback", "settings.web", "settings.terms", "settings.privacyPolicy"] {
            let row = app.descendants(matching: .any)[id].firstMatch
            for _ in 0..<6 where !(row.exists && row.isHittable) { app.swipeUp() }
            for _ in 0..<6 where !(row.exists && row.isHittable) { app.swipeDown() }
            XCTAssertTrue(row.exists, "항목 없음: \(id)")
        }
        let feedback = app.descendants(matching: .any)["settings.feedback"].firstMatch
        for _ in 0..<6 where !feedback.isHittable { app.swipeUp() }
        feedback.tap()
        XCTAssertTrue(app.navigationBars["피드백 보내기"].waitForExistence(timeout: 5), "피드백 시트가 안 열림")
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
