import Foundation
import Observation
import SwiftUI

/// 캘린더 탭 상태 관리.
/// 월별 응답(`GET /api/v1/calendar/events?year=&month=`)을 메모리에 캐시하고,
/// 강제 새로고침(재시도·이벤트 생성 후)에서만 다시 불러온다.
@MainActor
@Observable
final class CalendarViewModel {
    struct MonthKey: Hashable {
        let year: Int
        let month: Int
    }

    struct MonthData {
        var events: [CalendarEvent]
        var calendars: [CalendarInfo]
    }

    /// 한국 로케일 그레고리력 — 주 시작은 일요일.
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale(identifier: "ko_KR")
        calendar.firstWeekday = 1
        return calendar
    }()

    /// 현재 표시 중인 달 (해당 월 1일 자정으로 정규화)
    private(set) var displayedMonth: Date
    var selectedDate: Date
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private var cache: [MonthKey: MonthData] = [:]
    private var inFlight: Set<MonthKey> = []
    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
        let calendar = Self.calendar
        let today = Date()
        selectedDate = calendar.startOfDay(for: today)
        displayedMonth = Self.firstDayOfMonth(containing: today)
    }

    // MARK: - 파생 상태

    var currentMonthKey: MonthKey { Self.key(for: displayedMonth) }

    var currentMonthData: MonthData? { cache[currentMonthKey] }

    var calendars: [CalendarInfo] { currentMonthData?.calendars ?? [] }

    /// 선택된 날짜의 이벤트 — 종일 먼저, 그다음 시작 시각 순.
    func events(on date: Date) -> [CalendarEvent] {
        guard let data = currentMonthData else { return [] }
        return data.events
            .filter { $0.occurs(on: date, calendar: Self.calendar) }
            .sorted { lhs, rhs in
                if lhs.allDay != rhs.allDay { return lhs.allDay }
                if lhs.startAt != rhs.startAt { return lhs.startAt < rhs.startAt }
                return lhs.title < rhs.title
            }
    }

    /// 그리드 점 표시용 색 (최대 3개)
    func dotColors(on date: Date) -> [Color] {
        var colors: [Color] = []
        for event in events(on: date) {
            colors.append(event.displayColor(in: calendars))
            if colors.count == 3 { break }
        }
        return colors
    }

    // MARK: - 월 이동

    func showPreviousMonth() { shiftMonth(by: -1) }

    func showNextMonth() { shiftMonth(by: 1) }

    func showToday() {
        let today = Date()
        selectedDate = Self.calendar.startOfDay(for: today)
        displayedMonth = Self.firstDayOfMonth(containing: today)
        errorMessage = nil
    }

    private func shiftMonth(by delta: Int) {
        guard let newMonth = Self.calendar.date(byAdding: .month, value: delta, to: displayedMonth) else { return }
        displayedMonth = newMonth
        // 오늘이 포함된 달이면 오늘을, 아니면 1일을 선택
        let today = Self.calendar.startOfDay(for: Date())
        selectedDate = Self.key(for: today) == Self.key(for: newMonth) ? today : newMonth
        errorMessage = nil
    }

    // MARK: - 로딩

    /// 표시 중인 달의 이벤트를 불러온다. 캐시가 있으면 `force` 가 아닌 한 네트워크를 타지 않는다.
    func loadDisplayedMonth(force: Bool = false) async {
        let key = currentMonthKey
        if !force {
            if cache[key] != nil { return }
            if inFlight.contains(key) { return }
        }

        inFlight.insert(key)
        isLoading = true
        errorMessage = nil
        defer {
            inFlight.remove(key)
            isLoading = false
        }

        do {
            let response: CalendarEventsResponse = try await api.get(
                "/api/v1/calendar/events?year=\(key.year)&month=\(key.month)"
            )
            cache[key] = MonthData(events: response.events, calendars: response.calendars)
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            if key == currentMonthKey {
                errorMessage = apiError.errorDescription
            }
        } catch {
            if key == currentMonthKey {
                errorMessage = "일정을 불러오지 못했어요. 네트워크를 확인해 주세요."
            }
        }
    }

    // MARK: - 이벤트 생성

    /// 이벤트를 생성하고, 성공하면 관련 월 캐시를 비운 뒤 시작일이 있는 달로 이동해 새로고침한다.
    func createEvent(
        title: String,
        memo: String?,
        allDay: Bool,
        start: Date,
        end: Date,
        calendarId: String?
    ) async throws {
        let body = CreateEventRequest(
            title: title,
            description: memo,
            startAt: allDay ? APIDateParser.encodeDateOnly(start) : APIDateParser.encodeDateTime(start),
            endAt: allDay ? APIDateParser.encodeDateOnly(end) : APIDateParser.encodeDateTime(end),
            allDay: allDay,
            calendarId: calendarId
        )
        let _: CreateEventResponse = try await api.post("/api/v1/calendar/events", body: body)

        // 이벤트가 걸친 달의 캐시를 무효화하고 시작일로 이동
        cache.removeValue(forKey: Self.key(for: start))
        cache.removeValue(forKey: Self.key(for: end))
        selectedDate = Self.calendar.startOfDay(for: start)
        displayedMonth = Self.firstDayOfMonth(containing: start)
        await loadDisplayedMonth(force: true)
    }

    // MARK: - 내부

    static func key(for date: Date) -> MonthKey {
        let components = calendar.dateComponents([.year, .month], from: date)
        return MonthKey(year: components.year ?? 0, month: components.month ?? 0)
    }

    static func firstDayOfMonth(containing date: Date) -> Date {
        let components = calendar.dateComponents([.year, .month], from: date)
        return calendar.date(from: components) ?? date
    }
}
