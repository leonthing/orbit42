import XCTest

/// 1.10.0 사용 점검(PO 11/15): 처음 쓰는 사람처럼 따라가며 화면마다 캡처.
/// 프로필 → 글·사진 → 사진 3장 + 서식 글 → 임시 저장 → 다시 열기 → 올리기 → 고정 → (다른 계정) 방문자 시선 → 하트 → 신고 → (글쓴이) 삭제
/// PostsUITests 와 같은 준비: TEST_RUNNER_POSTS_BASE · POSTS_A(글쓴이) · POSTS_B(보는 사람) · POSTS_A_NAME · POSTS_SAMPLE · SHOT_DIR
/// 순서가 있어 test1 → test2 → test3 차례로 돈다.
final class PostsWalkthroughUITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func launch(token: String, extra: [String: String] = [:]) -> XCUIApplication {
        continueAfterFailure = false
        XCUIDevice.shared.appearance = .light
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
        sleep(1)
        let a = XCTAttachment(screenshot: app.screenshot()); a.name = name; a.lifetime = .keepAlways; add(a)
        if let dir = env["SHOT_DIR"] {
            try? app.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
    }

    private func tapTile(_ el: XCUIElement) {
        sleep(3)
        el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    func test1_OwnerWriteDraftPublishPin() throws {
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]), extra: [
            "DEMO_POST_PHOTOS": "3",
            "DEMO_POST_TITLE": "가죽 카드지갑 만들기",
            "DEMO_POST_BODY": try XCTUnwrap(env["POSTS_SAMPLE"]),
            "DEMO_POST_CAPTION": "완성한 카드지갑",
        ])
        XCTAssertTrue(tab(app, "프로필").waitForExistence(timeout: 30))
        tab(app, "프로필").tap()
        shot(app, "i01-프로필")
        let entry = app.buttons["postsEntry"]
        for _ in 0..<4 where !entry.waitForExistence(timeout: 4) { app.swipeUp() }
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        shot(app, "i02-프로필-글사진-진입점")
        entry.tap()
        sleep(2)
        shot(app, "i03-글사진-빈목록")
        app.buttons["newPost"].tap()
        XCTAssertTrue(app.buttons["closeCompose"].waitForExistence(timeout: 10))
        sleep(2)
        shot(app, "i04-새글-위")
        app.swipeUp()
        shot(app, "i05-새글-아래")
        app.buttons["closeCompose"].tap()
        let draft = app.buttons["나만 보기로 임시 저장"].firstMatch
        XCTAssertTrue(draft.waitForExistence(timeout: 5))
        shot(app, "i06-닫기-임시저장-묻기")
        draft.tap()
        let tile = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "가죽 카드지갑")).firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 60))
        sleep(3)
        shot(app, "i07-목록-임시저장")
        tapTile(tile)
        XCTAssertTrue(app.buttons["postMenu"].waitForExistence(timeout: 20))
        sleep(2)
        shot(app, "i08-임시저장글-상세")
        // PO 11/15: 임시 저장 글 화면에서 바로 '올리기'
        let publish = app.buttons["publishDraft"]
        XCTAssertTrue(publish.waitForExistence(timeout: 10), "임시 저장 글에 올리기 버튼 없음")
        publish.tap()
        XCTAssertTrue(publish.waitForNonExistence(timeout: 20), "올린 뒤에도 올리기 버튼이 남음")
        XCTAssertTrue(app.buttons["postMenu"].waitForExistence(timeout: 30))
        sleep(3)
        shot(app, "i12-올린글-상세")
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["11월 27일부터 다른 분들께 보여요."].waitForExistence(timeout: 5), "공개 전 안내 날짜 없음")
        let like = app.buttons["postLike"]
        XCTAssertTrue(like.exists)
        XCTAssertLessThan(like.frame.maxY, app.frame.height - 90, "맨 아래로 내려도 하트가 탭 막대에 가림")
        shot(app, "i13-올린글-맨아래")
        app.swipeDown()
        app.buttons["postMenu"].tap()
        let pin = app.buttons["링크 페이지 맨 위에 고정"]
        XCTAssertTrue(pin.waitForExistence(timeout: 5), "공개 글인데 고정 메뉴 없음")
        shot(app, "i14-올린글-메뉴")
        pin.tap()
        XCTAssertTrue(app.staticTexts["링크 페이지 맨 위에 고정한 글"].waitForExistence(timeout: 15))
        shot(app, "i15-고정됨")
        app.navigationBars.buttons.firstMatch.tap()
        sleep(2)
        shot(app, "i16-목록-고정")
    }

    func test2_VisitorLikeReport() throws {
        let app = launch(token: try XCTUnwrap(env["POSTS_B"]))
        let target = try XCTUnwrap(env["POSTS_A_NAME"])
        XCTAssertTrue(tab(app, "오르빗").waitForExistence(timeout: 30))
        tab(app, "오르빗").tap()
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText(target)
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", target)).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15))
        row.tap()
        sleep(2)
        shot(app, "i17-방문자-프로필")
        let entry = app.buttons["postsEntry"]
        for _ in 0..<4 where !entry.waitForExistence(timeout: 4) { app.swipeUp() }
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        shot(app, "i18-방문자-프로필-글사진")
        entry.tap()
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        sleep(2)
        shot(app, "i19-방문자-목록")
        tile.tap()
        let like = app.buttons["postLike"]
        XCTAssertTrue(like.waitForExistence(timeout: 15))
        sleep(2)
        XCTAssertTrue(app.staticTexts["고정한 글"].exists, "방문자에게 '고정한 글' 아님")
        XCTAssertFalse(app.staticTexts["링크 페이지 맨 위에 고정한 글"].exists)
        XCTAssertFalse(app.staticTexts["11월 27일부터 다른 분들께 보여요."].exists, "방문자에게 글쓴이용 공개 전 안내")
        shot(app, "i20-방문자-상세")
        like.tap()
        sleep(2)
        shot(app, "i21-하트")
        app.buttons["postMenu"].tap()
        shot(app, "i22-방문자-메뉴")
        app.buttons["신고하기"].tap()
        XCTAssertTrue(app.buttons["스팸·광고"].waitForExistence(timeout: 5))
        shot(app, "i23-신고-사유")
        app.buttons["기타"].tap()
        let ok = app.alerts.buttons["확인"]
        XCTAssertTrue(ok.waitForExistence(timeout: 10))
        shot(app, "i24-신고-접수")
        ok.tap()
        sleep(1)
        shot(app, "i25-신고-뒤-상세")
    }

    func test3_OwnerDelete() throws {
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]))
        XCTAssertTrue(tab(app, "프로필").waitForExistence(timeout: 30))
        tab(app, "프로필").tap()
        let entry = app.buttons["postsEntry"]
        for _ in 0..<4 where !entry.waitForExistence(timeout: 4) { app.swipeUp() }
        entry.tap()
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 30))
        tapTile(tile)
        XCTAssertTrue(app.buttons["postMenu"].waitForExistence(timeout: 20))
        sleep(2)
        shot(app, "i26-하트받은-내글")
        app.buttons["postMenu"].tap()
        app.buttons["삭제"].firstMatch.tap()
        let confirm = app.buttons.matching(NSPredicate(format: "label == %@", "삭제")).firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 5))
        shot(app, "i27-삭제-확인")
        confirm.tap()
        sleep(3)
        shot(app, "i28-삭제-뒤")
        XCTAssertFalse(app.buttons["postTile"].firstMatch.exists, "지운 글이 남음")
    }
}
