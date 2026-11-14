import XCTest

/// 1.10.0 글·사진 (시험) — 쓰기·목록·상세(내 글) / 남의 글 상세·❤️·신고·차단 창 / 다크 모드.
/// 로컬 서버(POSTS_PREVIEW_USER_IDS 에 두 데모 계정) + 토큰. DEBUG 의 DEMO_POST_PHOTOS 로 사진 n장을 넣는다(사진 앱 없이).
///   TEST_RUNNER_POSTS_BASE=http://localhost:3008 TEST_RUNNER_POSTS_A=<글쓴이 토큰> TEST_RUNNER_POSTS_B=<보는 사람 토큰> \
///   TEST_RUNNER_POSTS_A_NAME=demodoyun TEST_RUNNER_SHOT_DIR=<폴더> xcodebuild test -only-testing:Orbit42UITests/PostsUITests
final class PostsUITests: XCTestCase {
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

    func test1_WriteListDetail() throws {
        XCUIDevice.shared.appearance = .light
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]), extra: ["DEMO_POST_PHOTOS": "3", "DEMO_POST_TITLE": "이번 주 브랜드 작업"])
        openOwnPosts(app)
        sleep(1)
        shot(app, "posts-0-empty")
        app.buttons["newPost"].tap()
        let body = app.textFields["postBody"].firstMatch.exists ? app.textFields["postBody"] : app.textViews["postBody"]
        XCTAssertTrue(body.waitForExistence(timeout: 10))
        body.tap(); body.typeText("로고 시안 세 가지를 정리했어요. 상담 예약은 아래 버튼으로 받아요.")
        // 첫 사진을 뒤로 한 칸 (순서 바꾸기)
        app.buttons["뒤로"].firstMatch.tap()
        app.swipeDown() // 키보드 내리기
        sleep(1)
        shot(app, "posts-1-compose")
        app.buttons["savePost"].tap()
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 60), "올린 글이 목록에 없음")
        sleep(3)
        shot(app, "posts-2-list")
        // 저장 직후 목록을 두 번 새로 받는 동안 칸이 바뀔 수 있어 눌릴 때까지 기다린다
        for _ in 0..<10 where !tile.isHittable { sleep(1) }
        // 시트가 닫힌 직후 XCUITest 가 isHittable=false 로 보지만 실제 누르기는 된다(좌표로 눌러 확인)
        tile.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(app.otherElements["photoPager"].firstMatch.waitForExistence(timeout: 15) || app.scrollViews.firstMatch.waitForExistence(timeout: 5))
        sleep(3)
        shot(app, "posts-3-detail-mine")
    }

    func test2_OtherDetailReportBlock() throws {
        XCUIDevice.shared.appearance = .light
        let app = launch(token: try XCTUnwrap(env["POSTS_B"]))
        let target = try XCTUnwrap(env["POSTS_A_NAME"])
        XCTAssertTrue(tab(app, "오르빗").waitForExistence(timeout: 30))
        tab(app, "오르빗").tap()
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText(target)
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", target)).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15), "검색 결과 없음")
        row.tap()
        let entry = app.buttons["postsEntry"]
        for _ in 0..<4 where !entry.waitForExistence(timeout: 4) { app.swipeUp() }
        XCTAssertTrue(entry.waitForExistence(timeout: 10), "남의 프로필에 글·사진 없음")
        shot(app, "posts-4-person-profile")
        entry.tap()
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        tile.tap()
        let like = app.buttons["postLike"]
        XCTAssertTrue(like.waitForExistence(timeout: 15))
        like.tap()
        sleep(3)
        shot(app, "posts-5-detail-other")
        app.buttons["postMenu"].tap()
        sleep(1)
        shot(app, "posts-6-menu")
        app.buttons["신고하기"].tap()
        XCTAssertTrue(app.buttons["스팸·광고"].waitForExistence(timeout: 5))
        sleep(1)
        shot(app, "posts-7-report-reasons")
        app.buttons["스팸·광고"].tap()
        let ok = app.alerts.buttons["확인"]
        XCTAssertTrue(ok.waitForExistence(timeout: 10), "신고 접수 안내 없음")
        shot(app, "posts-8-report-done")
        ok.tap()
        app.buttons["postMenu"].tap()
        let blockItem = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "차단하기")).firstMatch
        XCTAssertTrue(blockItem.waitForExistence(timeout: 5))
        blockItem.tap()
        sleep(1)
        shot(app, "posts-9-block-confirm")
        // 시험에서는 실제로 차단하지 않는다(데모 계정 관계 유지)
        // iOS 26 은 확인 창이 말풍선이라 '취소' 버튼 없이 바깥을 눌러 닫는다
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.9)).tap()
        sleep(1)
        XCTAssertTrue(app.buttons["postLike"].exists, "차단하지 않고 상세가 남아 있어야 함")
    }

    func test3_DarkDetail() throws {
        XCUIDevice.shared.appearance = .dark
        defer { XCUIDevice.shared.appearance = .light }
        let app = launch(token: try XCTUnwrap(env["POSTS_A"]))
        openOwnPosts(app)
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        sleep(2)
        shot(app, "posts-10-dark-list")
        tile.tap()
        sleep(4)
        shot(app, "posts-11-dark-detail")
    }
}
