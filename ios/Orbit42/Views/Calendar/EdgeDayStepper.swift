import CoreGraphics

/// 하루 보기에서 일정을 끌어 화면 왼쪽·오른쪽 끝에 머물면 하루씩 넘기는 상태 (1.5.1 버그-4).
/// 타이머(0.7초)는 뷰가 돌리고, 넘길지 말지는 여기서만 정한다 — 끌기가 끝나거나 취소되면 `end()` 뒤로는 절대 넘기지 않는다.
/// 한 번 끌기에서 최대 `maxDays`일까지만 넘어간다(안전장치).
struct EdgeDayStepper: Equatable {
    static let edgeWidth: CGFloat = 28
    static let maxDays = 14

    /// 지금 손가락이 붙어 있는 가장자리 (-1 왼쪽, 0 없음, +1 오른쪽)
    private(set) var direction = 0
    /// 끌기 시작한 날에서 넘어간 날 수
    private(set) var offset = 0
    /// 끌기 중인지 — false 면 무엇이 와도 넘기지 않는다
    private(set) var active = false

    mutating func begin() {
        active = true
        direction = 0
        offset = 0
    }

    /// 손가락이 움직였을 때 — 가장자리 방향이 바뀌었으면 true(타이머를 다시 걸거나 멈춰야 함)
    mutating func fingerMoved(x: CGFloat, width: CGFloat) -> Bool {
        guard active else { return false }
        let d = x < Self.edgeWidth ? -1 : (x > width - Self.edgeWidth ? 1 : 0)
        guard d != direction else { return false }
        direction = d
        return true
    }

    /// 타이머가 0.7초 지났을 때 — 아직 같은 가장자리에 있으면 하루 넘기고 새 offset, 아니면 nil(타이머 멈춤)
    mutating func tick(direction d: Int) -> Int? {
        guard active, d != 0, d == direction else { return nil }
        let next = offset + d
        guard abs(next) <= Self.maxDays else { return nil }
        offset = next
        return next
    }

    /// 끌기 끝·취소 — 모든 상태를 처음으로
    mutating func end() {
        active = false
        direction = 0
        offset = 0
    }
}
