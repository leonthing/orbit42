import XCTest
@testable import Orbit42

/// 하루 보기 '다른 날로 끌기'의 가장자리 넘기기 (1.5.1 버그-4) — 끌기가 끝나면 절대 더 넘기지 않는다.
final class EdgeDayStepperTests: XCTestCase {
    private let width: CGFloat = 390

    func testStaysAtEdgeStepsEachTick() {
        var s = EdgeDayStepper()
        s.begin()
        XCTAssertTrue(s.fingerMoved(x: 380, width: width))       // 오른쪽 끝
        XCTAssertEqual(s.tick(direction: 1), 1)
        XCTAssertEqual(s.tick(direction: 1), 2)
        XCTAssertFalse(s.fingerMoved(x: 385, width: width), "같은 가장자리 안에서 움직이면 타이머 그대로")
        XCTAssertEqual(s.tick(direction: 1), 3)
    }

    func testLeavingEdgeStops() {
        var s = EdgeDayStepper()
        s.begin()
        _ = s.fingerMoved(x: 380, width: width)
        XCTAssertEqual(s.tick(direction: 1), 1)
        XCTAssertTrue(s.fingerMoved(x: 200, width: width))       // 가운데로
        XCTAssertNil(s.tick(direction: 1), "가장자리를 벗어난 뒤 남은 타이머는 넘기지 않음")
        XCTAssertEqual(s.offset, 1)
    }

    func testEndOrCancelStopsForever() {
        var s = EdgeDayStepper()
        s.begin()
        _ = s.fingerMoved(x: 380, width: width)
        XCTAssertEqual(s.tick(direction: 1), 1)
        s.end()                                                   // 손을 뗌·제스처 취소·페이지 사라짐
        for _ in 0..<50 { XCTAssertNil(s.tick(direction: 1)) }    // 남은 타이머가 몇 번 돌아도
        XCTAssertFalse(s.fingerMoved(x: 380, width: width), "끝난 뒤 들어온 움직임도 무시")
        XCTAssertEqual(s.offset, 0)
    }

    func testMaxDaysCap() {
        var s = EdgeDayStepper()
        s.begin()
        _ = s.fingerMoved(x: 380, width: width)
        var last = 0
        for _ in 0..<100 { if let n = s.tick(direction: 1) { last = n } }
        XCTAssertEqual(last, EdgeDayStepper.maxDays)
        XCTAssertEqual(s.offset, 14)
    }

    func testLeftEdgeAndSwitchingSides() {
        var s = EdgeDayStepper()
        s.begin()
        XCTAssertTrue(s.fingerMoved(x: 10, width: width))
        XCTAssertEqual(s.tick(direction: -1), -1)
        XCTAssertTrue(s.fingerMoved(x: 380, width: width))
        XCTAssertNil(s.tick(direction: -1), "왼쪽 타이머는 오른쪽으로 옮기면 무효")
        XCTAssertEqual(s.tick(direction: 1), 0)
    }

    func testNotActiveBeforeBegin() {
        var s = EdgeDayStepper()
        XCTAssertFalse(s.fingerMoved(x: 380, width: width))
        XCTAssertNil(s.tick(direction: 1))
    }
}
