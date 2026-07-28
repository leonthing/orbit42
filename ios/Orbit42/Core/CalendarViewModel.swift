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

    // MARK: - 표시 캘린더 필터

    /// 캘린더 탭에서 숨긴 캘린더 id — 기기별 설정으로 유지된다.
    private(set) var hiddenCalendarIds: Set<String> = Set(
        UserDefaults.standard.stringArray(forKey: "hiddenCalendarIds") ?? []
    )

    func isCalendarVisible(_ id: String) -> Bool {
        !hiddenCalendarIds.contains(id)
    }

    func toggleCalendarVisibility(_ id: String) {
        if hiddenCalendarIds.contains(id) {
            hiddenCalendarIds.remove(id)
        } else {
            hiddenCalendarIds.insert(id)
        }
        UserDefaults.standard.set(Array(hiddenCalendarIds), forKey: "hiddenCalendarIds")
    }

    /// 선택된 날짜의 이벤트 — 종일 먼저, 그다음 시작 시각 순.
    /// 숨긴 캘린더의 이벤트는 제외한다 (calendarId 없는 이벤트는 항상 표시).
    func events(on date: Date) -> [CalendarEvent] {
        guard let data = currentMonthData else { return [] }
        return data.events
            .filter { event in
                guard let calendarId = event.calendarId else { return true }
                return !hiddenCalendarIds.contains(calendarId)
            }
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

    /// 주간/일간/연간 뷰에서 임의 날짜 선택 — 달이 바뀌면 표시 달도 따라간다.
    func select(date: Date) {
        let day = Self.calendar.startOfDay(for: date)
        selectedDate = day
        let month = Self.firstDayOfMonth(containing: day)
        if Self.key(for: month) != currentMonthKey {
            displayedMonth = month
        }
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
        calendarId: String?,
        location: String? = nil,
        locationLat: Double? = nil,
        locationLng: Double? = nil
    ) async throws {
        let body = CreateEventRequest(
            title: title,
            description: memo,
            startAt: allDay ? APIDateParser.encodeDateOnly(start) : APIDateParser.encodeDateTime(start),
            endAt: allDay ? APIDateParser.encodeDateOnly(end) : APIDateParser.encodeDateTime(end),
            allDay: allDay,
            calendarId: calendarId,
            location: location,
            locationLat: locationLat,
            locationLng: locationLng
        )
        let _: CreateEventResponse = try await api.post("/api/v1/calendar/events", body: body)

        // 이벤트가 걸친 달의 캐시를 무효화하고 시작일로 이동
        cache.removeValue(forKey: Self.key(for: start))
        cache.removeValue(forKey: Self.key(for: end))
        selectedDate = Self.calendar.startOfDay(for: start)
        displayedMonth = Self.firstDayOfMonth(containing: start)
        await loadDisplayedMonth(force: true)
    }

    // MARK: - 이벤트 수정/삭제

    /// 이벤트를 수정하고, 성공하면 기존/새 기간이 걸친 달의 캐시를 비운 뒤 표시 중인 달을 새로고침한다.
    /// - Parameters:
    ///   - body: 바뀐 필드만 담은 PATCH 페이로드 (startAt/endAt 은 쌍으로).
    ///   - newStart/newEnd: 수정 후 기간 — 캐시 무효화 범위 계산용.
    func updateEvent(
        _ event: CalendarEvent,
        body: UpdateEventRequest,
        newStart: Date,
        newEnd: Date
    ) async throws {
        let _: EventMutationResponse = try await api.patch(
            "/api/v1/calendar/events/\(event.id)",
            body: body
        )
        invalidateCache(around: [event.startAt, event.endAt, newStart, newEnd])
        await loadDisplayedMonth(force: true)
    }

    /// 이벤트를 삭제하고, 성공하면 기간이 걸친 달의 캐시를 비운 뒤 표시 중인 달을 새로고침한다.
    /// Google 이벤트(`gcal_` id)는 소속 native 캘린더 uuid 를 쿼리로 함께 보낸다.
    func deleteEvent(_ event: CalendarEvent) async throws {
        var path = "/api/v1/calendar/events/\(event.id)"
        if event.isGoogle, let calendarId = event.calendarId {
            path += "?calendarId=\(calendarId)"
        }
        let _: EventMutationResponse = try await api.delete(path)
        invalidateCache(around: [event.startAt, event.endAt])
        await loadDisplayedMonth(force: true)
    }

    // MARK: - 자산 분류 오버라이드

    /// 이벤트의 자산 분류를 지정/해제(`bucket: nil`)하고,
    /// 성공하면 기간이 걸친 달의 캐시를 비운 뒤 표시 중인 달을 새로고침한다.
    func setEventBucket(_ event: CalendarEvent, bucket: String?) async throws {
        let _: EventMutationResponse = try await api.put(
            "/api/v1/time-asset/event-bucket",
            body: UpdateEventBucketRequest(eventId: event.id, bucket: bucket)
        )
        invalidateCache(around: [event.startAt, event.endAt])
        await loadDisplayedMonth(force: true)
    }

    /// 일정별 실제 수익 기록 (nil = 해제, 자동 계산으로 복귀).
    func setEventEarning(_ event: CalendarEvent, amountKrw: Int?) async throws {
        let _: EventMutationResponse = try await api.put(
            "/api/v1/time-asset/event-earning",
            body: UpdateEventEarningRequest(eventId: event.id, amountKrw: amountKrw)
        )
        invalidateCache(around: [event.startAt, event.endAt])
        await loadDisplayedMonth(force: true)
    }

    /// 초대 응답 등 외부 변경 후 해당 이벤트가 걸친 달을 다시 불러온다.
    func reloadMonth(around event: CalendarEvent) async {
        invalidateCache(around: [event.startAt, event.endAt])
        await loadDisplayedMonth(force: true)
    }

    /// 주어진 날짜들이 속한 달의 캐시를 제거한다. (createEvent 와 같은 무효화 패턴)
    private func invalidateCache(around dates: [Date]) {
        for date in dates {
            cache.removeValue(forKey: Self.key(for: date))
        }
    }

    // MARK: - 완료 체크(투두)

    /// 이벤트의 완료 상태를 토글한다 — 캐시의 최신 값 기준으로 반전.
    func toggleCompletion(_ event: CalendarEvent) async throws {
        try await setCompletion(event, completed: !currentCompleted(of: event))
    }

    /// 완료 상태를 낙관적으로 캐시에 먼저 반영하고 `PUT .../completion` 으로 저장한다.
    /// 실패하면 원복한 뒤 에러를 다시 던진다 (표출은 호출한 뷰가 담당).
    func setCompletion(_ event: CalendarEvent, completed: Bool) async throws {
        let previous = currentCompleted(of: event)
        guard previous != completed else { return }
        applyCompletion(eventId: event.id, completed: completed)
        do {
            let _: EventCompletionResponse = try await api.put(
                "/api/v1/calendar/events/\(event.id)/completion",
                body: UpdateEventCompletionRequest(completed: completed)
            )
        } catch {
            applyCompletion(eventId: event.id, completed: previous)
            throw error
        }
    }

    /// 캐시에 반영된 최신 완료 상태. (상세 시트가 든 스냅샷이 낡았을 수 있어 캐시 우선)
    private func currentCompleted(of event: CalendarEvent) -> Bool {
        for data in cache.values {
            if let cached = data.events.first(where: { $0.id == event.id }) {
                return cached.completed
            }
        }
        return event.completed
    }

    /// 모든 월 캐시에서 해당 이벤트의 completed 를 교체한다. (여러 달에 걸친 이벤트 포함)
    private func applyCompletion(eventId: String, completed: Bool) {
        for key in cache.keys {
            guard var data = cache[key] else { continue }
            var changed = false
            for index in data.events.indices where data.events[index].id == eventId {
                data.events[index].completed = completed
                changed = true
            }
            if changed { cache[key] = data }
        }
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
