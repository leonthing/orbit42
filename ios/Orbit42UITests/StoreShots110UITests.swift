import XCTest

/// 1.10.0 스토어 스크린샷 1장(PO 11/15): 방문자 시선의 글 상세. 둘러보기 예시 데이터에는 글·사진이 없어(둘러보기에선 닫힘)
/// 1.9.0 처럼 가상 이름 임시 계정(하린 harin.design — 예약어)의 글을 데모 상대(서연)로 보고 찍은 뒤 바로 지운다.
///   TEST_RUNNER_POSTS_BASE=http://localhost:3008 TEST_RUNNER_POSTS_B=<보는 사람 토큰> TEST_RUNNER_SHOT_DIR=<폴더> TEST_RUNNER_SHOT_NAME=<파일 이름>
final class StoreShots110UITests: XCTestCase {
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    func testPostDetail() throws {
        continueAfterFailure = false
        XCUIDevice.shared.appearance = .light
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = env["POSTS_BASE"] ?? "http://localhost:3008"
        app.launchEnvironment["DEMO_TOKEN"] = try XCTUnwrap(env["POSTS_B"])
        app.launch()
        // iPad 는 탭이 위쪽 막대라 tabBars 로 안 잡힐 수 있다 — 같은 이름의 버튼으로
        var orbit = app.tabBars.buttons.matching(NSPredicate(format: "label == %@", "오르빗")).firstMatch
        if !orbit.waitForExistence(timeout: 20) { orbit = app.buttons.matching(NSPredicate(format: "label == %@", "오르빗")).firstMatch }
        XCTAssertTrue(orbit.waitForExistence(timeout: 10))
        orbit.tap()
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap(); field.typeText("하린")
        let row = app.buttons.containing(NSPredicate(format: "label CONTAINS %@", "하린")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 15))
        row.tap()
        let entry = app.buttons["postsEntry"]
        for _ in 0..<4 where !entry.waitForExistence(timeout: 4) { app.swipeUp() }
        entry.tap()
        let tile = app.buttons["postTile"].firstMatch
        XCTAssertTrue(tile.waitForExistence(timeout: 15))
        sleep(2)
        tile.tap()
        XCTAssertTrue(app.buttons["postLike"].waitForExistence(timeout: 15))
        sleep(6) // 사진 불러오기
        let shot = app.screenshot()
        let a = XCTAttachment(screenshot: shot); a.name = "posts"; a.lifetime = .keepAlways; add(a)
        if let dir = env["SHOT_DIR"] {
            try shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(env["SHOT_NAME"] ?? "posts").png"))
        }
    }
}
