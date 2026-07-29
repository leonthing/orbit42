import Foundation
import Observation

/// 캘린더 격자가 어느 요일부터 시작하는지.
/// rawValue 는 Foundation `Calendar.firstWeekday` 와 같은 값(일=1 … 토=7).
enum WeekStart: Int, CaseIterable, Identifiable {
    case sunday = 1
    case monday = 2

    var id: Int { rawValue }

    var firstWeekday: Int { rawValue }

    var label: String {
        switch self {
        case .sunday: return "일요일"
        case .monday: return "월요일"
        }
    }

    /// 항상 일요일부터인 고정 배열 — `component(.weekday:) - 1` 로 인덱싱할 때 쓴다.
    static let absoluteSymbols = ["일", "월", "화", "수", "목", "금", "토"]

    /// 일~토 순서로 만든 7칸 배열을 시작 요일에 맞춰 회전한다.
    /// (요일 헤더, 근무시간 요일 목록처럼 "일요일부터" 만들어 둔 것들에 쓴다.)
    func rotated<T>(_ sundayFirst: [T]) -> [T] {
        guard sundayFirst.count == 7 else { return sundayFirst }
        let offset = firstWeekday - 1
        return Array(sundayFirst[offset...] + sundayFirst[..<offset])
    }

    /// 시작 요일에 맞춰 회전한 헤더용 기호 (월요일 시작이면 월·화·…·일).
    var symbols: [String] { rotated(Self.absoluteSymbols) }

    /// 헤더 열 index 가 실제로 가리키는 요일 (0=일 … 6=토).
    func weekdayIndex(atColumn column: Int) -> Int {
        (column + firstWeekday - 1) % 7
    }
}

/// 기기별 앱 설정. 서버와 동기화하지 않고 `UserDefaults` 에만 저장한다.
@MainActor
@Observable
final class AppSettings {
    static let shared = AppSettings()

    private static let weekStartKey = "weekStart"

    /// 캘린더 주 시작 요일 — 기본값은 일요일.
    /// 쓰기는 `setWeekStart(_:)` 로만 한다(파생 `calendar` 를 함께 갱신해야 해서).
    private(set) var weekStart: WeekStart

    /// 주 시작이 반영된 ko_KR 그레고리력 — 앱의 모든 월 격자가 이걸 쓴다.
    /// 격자 렌더링마다 다시 만들지 않도록 저장해 둔다.
    private(set) var calendar: Calendar

    private init() {
        let stored =
            WeekStart(rawValue: UserDefaults.standard.integer(forKey: Self.weekStartKey))
            ?? .sunday
        weekStart = stored
        calendar = Self.makeCalendar(firstWeekday: stored.firstWeekday)
    }

    func setWeekStart(_ value: WeekStart) {
        guard value != weekStart else { return }
        weekStart = value
        calendar = Self.makeCalendar(firstWeekday: value.firstWeekday)
        UserDefaults.standard.set(value.rawValue, forKey: Self.weekStartKey)
    }

    private static func makeCalendar(firstWeekday: Int) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        calendar.firstWeekday = firstWeekday
        return calendar
    }
}

extension Calendar {
    /// 이 달 1일 앞에 비워 둘 칸 수 — 주 시작 요일을 반영한다.
    func leadingBlankDays(forMonthContaining date: Date) -> Int {
        (component(.weekday, from: date) - firstWeekday + 7) % 7
    }
}
