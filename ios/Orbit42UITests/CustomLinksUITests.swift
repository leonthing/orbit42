import XCTest

/// 개선-46 공개 링크 페이지 직접 링크 — 설정 > 예약 링크 > 링크 페이지 버튼.
/// 실행: 로컬 서버 + TEST_RUNNER_DEMO_TOKEN(테스트 계정, 시작 때 링크 0개). 끝나면 바깥 스크립트가 원래대로 되돌린다.
final class CustomLinksUITests: XCTestCase {
    private var app: XCUIApplication!

    func testAddValidateDelete() throws {
        let env = ProcessInfo.processInfo.environment
        guard let token = env["DEMO_TOKEN"] else { throw XCTSkip("DEMO_TOKEN 필요") }
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["DEMO_TOKEN"] = token
        app.launch()
        let profile = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "프로필")).firstMatch
        XCTAssertTrue(profile.waitForExistence(timeout: 20))
        profile.tap()
        let gear = app.buttons["설정"]
        XCTAssertTrue(gear.waitForExistence(timeout: 10))
        gear.tap()
        let row = app.descendants(matching: .any)["settings.customLinks"].firstMatch
        for _ in 0..<6 where !(row.exists && row.isHittable) { app.swipeUp() }
        row.tap()
        XCTAssertTrue(app.navigationBars["링크 페이지 버튼"].waitForExistence(timeout: 10))

        add("웹사이트", "nthing.net")                       // 앞부분 없이 → https:// 자동
        add("카카오 오픈채팅", "https://open.kakao.com/o/example")
        // 잘못된 주소는 저장되지 않고 안내
        app.buttons["customLinkAdd"].tap()
        type("customLinkTitle", "나쁜 링크")
        type("customLinkURL", "javascript:alert(1)")
        app.buttons["customLinkSave"].tap()
        XCTAssertTrue(app.staticTexts["http:// 또는 https:// 로 시작하는 주소를 적어 주세요."].waitForExistence(timeout: 3))
        shot("46-editor-error")
        app.buttons["취소"].tap()
        add("블로그", "https://blog.example.com")
        sleep(2)
        XCTAssertTrue(app.staticTexts["링크 페이지 버튼 (3/5)".uppercased()].exists || app.staticTexts["링크 페이지 버튼 (3/5)"].exists)
        shot("46-list")
        // 밀어서 지우기 — 블로그
        app.buttons["customLink.2"].swipeLeft()
        app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Delete", "삭제")).firstMatch.tap()
        sleep(2)
        XCTAssertFalse(app.staticTexts["블로그"].exists)
        shot("46-after-delete")
    }

    private func add(_ title: String, _ url: String) {
        app.buttons["customLinkAdd"].tap()
        type("customLinkTitle", title)
        type("customLinkURL", url)
        app.buttons["customLinkSave"].tap()
        XCTAssertTrue(app.staticTexts[title].waitForExistence(timeout: 8), "추가 안 됨: \(title)")
        sleep(1)
    }

    private func type(_ id: String, _ text: String) {
        let f = app.textFields[id]
        XCTAssertTrue(f.waitForExistence(timeout: 5))
        f.tap()
        f.typeText(text)
    }

    private func shot(_ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = ProcessInfo.processInfo.environment["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }
}
