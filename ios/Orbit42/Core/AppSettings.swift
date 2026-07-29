import Foundation
import Observation
import UIKit

/// 캘린더 격자가 어느 요일부터 시작하는지.
/// rawValue 는 Foundation `Calendar.firstWeekday` 와 같은 값(일=1 … 토=7),
/// `.system` 은 기기의 "언어 및 지역 > 주 시작 요일" 을 그대로 따른다.
enum WeekStart: Int, CaseIterable, Identifiable {
    case system = 0
    case sunday = 1
    case monday = 2
    case tuesday = 3
    case wednesday = 4
    case thursday = 5
    case friday = 6
    case saturday = 7

    var id: Int { rawValue }

    /// 직접 고르는 요일들 (`.system` 제외) — 선택 화면의 두 번째 섹션.
    static let weekdayCases: [WeekStart] = allCases.filter { $0 != .system }

    /// 항상 일요일부터인 고정 배열 — `component(.weekday:) - 1` 로 인덱싱할 때 쓴다.
    static let absoluteSymbols = ["일", "월", "화", "수", "목", "금", "토"]
    static let absoluteNames = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]

    /// 실제로 적용할 `Calendar.firstWeekday` (일=1 … 토=7).
    var resolvedFirstWeekday: Int {
        self == .system ? Calendar.current.firstWeekday : rawValue
    }

    /// 선택 화면에 표시할 이름. `.system` 은 현재 시스템 값을 괄호로 덧붙인다.
    var label: String {
        guard self != .system else {
            return "시스템 설정(\(Self.name(forFirstWeekday: Calendar.current.firstWeekday)))"
        }
        return Self.name(forFirstWeekday: rawValue)
    }

    /// firstWeekday(1…7) → "일요일" … "토요일"
    static func name(forFirstWeekday firstWeekday: Int) -> String {
        let index = min(max(firstWeekday, 1), 7) - 1
        return absoluteNames[index]
    }
}

/// 기기별 앱 설정. 서버와 동기화하지 않고 `UserDefaults` 에만 저장한다.
@MainActor
@Observable
final class AppSettings {
    static let shared = AppSettings()

    private static let weekStartKey = "weekStart"

    /// 캘린더 주 시작 요일 — 기본값은 기기 설정 따름.
    /// 쓰기는 `setWeekStart(_:)` 로만 한다(파생 `calendar` 를 함께 갱신해야 해서).
    private(set) var weekStart: WeekStart

    /// 주 시작이 반영된 ko_KR 그레고리력 — 앱의 모든 월 격자가 이걸 쓴다.
    /// 격자 렌더링마다 다시 만들지 않도록 저장해 둔다.
    private(set) var calendar: Calendar

    @ObservationIgnored private var foregroundObserver: NSObjectProtocol?

    private init() {
        let stored = (UserDefaults.standard.object(forKey: Self.weekStartKey) as? Int)
            .flatMap(WeekStart.init(rawValue:)) ?? .system
        weekStart = stored
        calendar = Self.makeCalendar(firstWeekday: stored.resolvedFirstWeekday)

        // `.system` 인 동안 사용자가 기기 설정을 바꾸고 돌아올 수 있다.
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in
            Task { @MainActor in AppSettings.shared.syncWithSystemIfNeeded() }
        }
    }

    // MARK: - 파생 값

    var firstWeekday: Int { calendar.firstWeekday }

    /// 시작 요일에 맞춰 회전한 헤더용 기호 (월요일 시작이면 월·화·…·일).
    var weekdaySymbols: [String] { rotated(WeekStart.absoluteSymbols) }

    /// 설정 목록의 오른쪽에 띄우는 현재 값 ("월요일").
    var weekStartDisplayName: String { WeekStart.name(forFirstWeekday: firstWeekday) }

    /// 일~토 순서로 만든 7칸 배열을 시작 요일에 맞춰 회전한다.
    /// (요일 헤더, 근무시간 요일 목록처럼 "일요일부터" 만들어 둔 것들에 쓴다.)
    func rotated<T>(_ sundayFirst: [T]) -> [T] {
        guard sundayFirst.count == 7 else { return sundayFirst }
        let offset = firstWeekday - 1
        return Array(sundayFirst[offset...] + sundayFirst[..<offset])
    }

    /// 헤더 열 index 가 실제로 가리키는 요일 (0=일 … 6=토).
    func weekdayIndex(atColumn column: Int) -> Int {
        (column + firstWeekday - 1) % 7
    }

    // MARK: - 변경

    func setWeekStart(_ value: WeekStart) {
        weekStart = value
        UserDefaults.standard.set(value.rawValue, forKey: Self.weekStartKey)
        let resolved = value.resolvedFirstWeekday
        if resolved != calendar.firstWeekday {
            calendar = Self.makeCalendar(firstWeekday: resolved)
        }
    }

    /// `.system` 일 때 기기 설정이 바뀌었으면 따라간다.
    func syncWithSystemIfNeeded() {
        guard weekStart == .system else { return }
        let resolved = weekStart.resolvedFirstWeekday
        guard resolved != calendar.firstWeekday else { return }
        calendar = Self.makeCalendar(firstWeekday: resolved)
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
