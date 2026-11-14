import XCTest

/// 1.10.0 글·사진 기본기 — 서식 렌더(웹과 같은 샘플), 사진 설명·대표, 공유, 고정, 닫을 때 임시 저장.
/// PostsUITests 와 같은 준비(로컬 서버 + 데모 토큰). 샘플 본문은 TEST_RUNNER_POSTS_SAMPLE(줄바꿈은 \n 글자).
final class PostsBasicsUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch(token: String, extra: [String: String] = [:]) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["POSTS_BASE"] ?? "http://localhost:3008"
        app.launchEnvironment["DEMO_TOKEN"] = token
        for (k, v) in extra { app.launchEnvironment[k] = v }
        app.launch()
        return app
    }

    private func tab(_ app: XCUIApplication, _ name: String) -> XCUIElement {
        app.tabBars.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch
    }

    private func shot(_ app: XCUIApplication, _ name: String) {
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = env["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func openOwnPosts(_ app: XCUIApplication) {
        XCTAssertTrue(tab(app, "프로필").waitForExistence(timeout: 30))
        tab(app, "프로필").tap()
        let entry = app.buttons["postsEntry"]
        for _ in 0..<4 where !entry.waitForExistence(timeout: 4) { app.swipeUp() }
        XCTAssertTrue(entry.waitForExistence(timeout: 10), "글·사진 진입점 없음")
        entry.tap()
    }

    private func openFirstTile(_ app: XCUIApplication) {
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 60), "목록에 글 없음")
        sleep(3)
        tile.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func test3_FormatCaptionSharePin() throws {
        XCUIDevice.shared.appearance = .light
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]), extra: [
            "DEMO_POST_PHOTOS": "2",
            "DEMO_POST_TITLE": "가죽 지갑 마감",
            "DEMO_POST_BODY": try XCTUnwrap(env["POSTS_SAMPLE"]),
            "DEMO_POST_CAPTION": "완성한 지갑 두 개",
        ])
        openOwnPosts(app)
        app.buttons["newPost"].tap()
        XCTAssertTrue(app.buttons["savePost"].waitForExistence(timeout: 10))
        sleep(2)
        shot(app, "b-1-compose-light")
        app.swipeUp()
        sleep(1)
        shot(app, "b-1b-compose-light-bottom")
        app.buttons["savePost"].tap()
        openFirstTile(app)
        XCTAssertTrue(app.staticTexts["완성한 지갑 두 개"].waitForExistence(timeout: 20), "사진 설명 없음")
        XCTAssertTrue(app.staticTexts["작업 노트"].exists, "소제목 렌더 안 됨")
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "## ")).firstMatch.exists, "## 가 글자로 남음")
        XCTAssertTrue(app.buttons["postShare"].exists || app.otherElements["postShare"].exists, "공유 버튼 없음")
        sleep(2)
        shot(app, "b-2-detail-light")
        app.swipeUp()
        sleep(1)
        shot(app, "b-3-detail-light-body")
        // ⋯ → 링크 페이지 맨 위에 고정
        app.swipeDown()
        app.buttons["postMenu"].tap()
        let pin = app.buttons["링크 페이지 맨 위에 고정"]
        XCTAssertTrue(pin.waitForExistence(timeout: 5))
        pin.tap()
        XCTAssertTrue(app.staticTexts["링크 페이지 맨 위에 고정한 글"].waitForExistence(timeout: 15), "고정 표시 없음")
        // 다크
        XCUIDevice.shared.appearance = .dark
        sleep(2)
        shot(app, "b-4-detail-dark")
        app.swipeUp()
        sleep(1)
        shot(app, "b-5-detail-dark-body")
        // 공유 시트
        app.swipeDown()
        let share = app.buttons["postShare"].firstMatch
        if share.exists {
            share.tap()
            sleep(3)
            shot(app, "b-6-share-sheet")
        }
        XCUIDevice.shared.appearance = .light
    }

    func test4_CloseAsksDraft() throws {
        XCUIDevice.shared.appearance = .light
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]), extra: ["DEMO_POST_PHOTOS": "1", "DEMO_POST_TITLE": "쓰다 만 글"])
        openOwnPosts(app)
        app.buttons["newPost"].tap()
        XCTAssertTrue(app.buttons["closeCompose"].waitForExistence(timeout: 10))
        sleep(2)
        app.buttons["closeCompose"].tap()
        let draft = app.buttons["나만 보기로 임시 저장"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 5), "임시 저장 묻기 없음")
        shot(app, "b-7-close-ask")
        draft.tap()
        XCTAssertTrue(app.buttons["postTile"].firstMatch.waitForExistence(timeout: 60))
        sleep(3)
        let draftTile = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "임시 저장")).firstMatch
        XCTAssertTrue(draftTile.waitForExistence(timeout: 10), "임시 저장 표시 없음")
        shot(app, "b-8-list-draft")
    }

    /// 임시 저장 글을 다시 열어 고친 뒤 또 임시 저장 — 행이 늘지 않아야 한다(행 수는 시험 뒤 DB 로 확인)
    func test5_ReopenDraftNoNewRow() throws {
        XCUIDevice.shared.appearance = .light
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]), extra: ["DEMO_POST_PHOTOS": "1", "DEMO_POST_TITLE": "다시 여는 글"])
        openOwnPosts(app)
        app.buttons["newPost"].tap()
        XCTAssertTrue(app.buttons["closeCompose"].waitForExistence(timeout: 10))
        sleep(2)
        app.buttons["closeCompose"].tap()
        app.buttons["나만 보기로 임시 저장"].firstMatch.tap()
        let draftTile = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "다시 여는 글")).firstMatch
        XCTAssertTrue(draftTile.waitForExistence(timeout: 60))
        for round in 1...2 {
            sleep(3)
            draftTile.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            XCTAssertTrue(app.buttons["postMenu"].waitForExistence(timeout: 20))
            app.buttons["postMenu"].tap()
            app.buttons["고치기"].firstMatch.tap()
            let title = app.textFields["postTitle"]
            XCTAssertTrue(title.waitForExistence(timeout: 10))
            title.tap(); title.typeText(" \(round)")
            app.buttons["closeCompose"].tap()
            let again = app.buttons["나만 보기로 임시 저장"].firstMatch
            XCTAssertTrue(again.waitForExistence(timeout: 5), "다시 연 임시 저장 글에서 묻기 없음")
            again.tap()
            sleep(3)
            app.navigationBars.buttons.firstMatch.tap() // 상세 → 목록
            XCTAssertTrue(draftTile.waitForExistence(timeout: 30))
        }
        shot(app, "b-9-reopen-draft")
        // 길게 눌러 삭제(확인 한 번)
        sleep(2)
        draftTile.press(forDuration: 1.2)
        let del = app.buttons["삭제"].firstMatch
        XCTAssertTrue(del.waitForExistence(timeout: 5), "길게 누르기 메뉴에 삭제 없음")
        shot(app, "b-10-longpress-menu")
        del.tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == %@", "삭제")).firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 5), "삭제 확인 없음")
        shot(app, "b-11-delete-confirm")
        confirm.tap()
        XCTAssertTrue(draftTile.waitForNonExistence(timeout: 20), "지운 글이 목록에 남음")
    }
}
