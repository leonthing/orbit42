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

    /// 한국 로케일 그레고리력 — 주 시작 요일은 설정(`AppSettings.weekStart`)을 따른다.
    static var calendar: Calendar { AppSettings.shared.calendar }

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
    private(set) var hiddenCalendarIds: Set<String> = CalendarViewModel.loadHiddenCalendarIds()

    /// 위젯도 같은 캘린더를 숨기도록 공유 설정에 맞춰 둔다.
    private static func loadHiddenCalendarIds() -> Set<String> {
        let ids = UserDefaults.standard.stringArray(forKey: "hiddenCalendarIds") ?? []
        SharedDisplaySettings.update { $0.hiddenCalendarIds = ids.sorted() }
        return Set(ids)
    }

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
        SharedDisplaySettings.update { $0.hiddenCalendarIds = hiddenCalendarIds.sorted() }
        WidgetBridge.reload(); EventReminders.shared.refreshSoon()
    }

    /// 선택된 날짜의 이벤트 — 종일 먼저, 그다음 시작 시각 순.
    /// 숨긴 캘린더의 이벤트는 제외한다 (calendarId 없는 이벤트는 항상 표시).
    func events(on date: Date) -> [CalendarEvent] {
        // 하루 보기에서 옆 날짜를 넘겨 볼 때를 위해 그 날짜가 속한 달의 캐시를 본다.
        guard let data = cache[Self.key(for: date)] ?? currentMonthData else { return [] }
        return data.events
            .filter { event in
                guard let calendarId = event.calendarId else { return true }
                return !hiddenCalendarIds.contains(calendarId)
            }
            .filter { !$0.archived || AppSettings.shared.showArchived }
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

    /// 마지막으로 앱을 본 시각 — 날이 바뀌었거나 오래 떠나 있다 돌아오면 오늘로 돌아간다.
    @ObservationIgnored private var lastActiveAt = Date()
    /// 위젯·알림 링크로 날짜를 고른 시각 — 그 직후의 '오늘로'가 링크 날짜를 덮지 않게
    @ObservationIgnored private var linkSelectedAt = Date.distantPast

    /// 위젯·알림 링크가 고른 날 — 앞으로 올 때의 '오늘로'보다 앞선다
    func selectFromLink(date: Date) {
        linkSelectedAt = Date()
        select(date: date)
    }

    /// 앱이 다시 앞으로 올 때 — iOS 는 앱을 며칠씩 메모리에 두므로 그대로 두면
    /// 전에 보던 날(또는 앱을 처음 켠 날)에서 시작해 '엉뚱한 날짜'로 보인다.
    /// 날이 바뀌었거나 1시간 넘게 떠나 있었으면 오늘로 맞춘다(아이폰 캘린더와 같은 손).
    func returnToTodayIfStale(now: Date = Date()) {
        defer { lastActiveAt = now }
        // 링크로 막 날짜를 골랐으면 그대로 둔다 (활성화와 링크 처리 순서는 iOS 가 정한다)
        guard now.timeIntervalSince(linkSelectedAt) > 5 else { return }
        let dayChanged = !Self.calendar.isDate(lastActiveAt, inSameDayAs: now)
        guard dayChanged || now.timeIntervalSince(lastActiveAt) > Self.staleInterval else { return }
        guard !Self.calendar.isDate(selectedDate, inSameDayAs: now) else { return }
        showToday()
    }

    /// 이만큼 떠나 있었으면 오늘로 (실측용으로 DEBUG 에서 DEMO_STALE_SECONDS 로 줄일 수 있다)
    private static var staleInterval: TimeInterval {
        #if DEBUG
        if let raw = ProcessInfo.processInfo.environment["DEMO_STALE_SECONDS"], let v = TimeInterval(raw) { return v }
        #endif
        return 3600
    }

    /// 앱이 앞으로 올 때 — 1분 넘게 떠나 있었으면 일정을 다시 받는다.
    /// 월별 캐시는 프로세스가 사는 동안 남아 있어서, 다른 기기·구글·서버에서 바뀐 것이
    /// 앱을 완전히 껐다 켜기 전까지 안 보였다(10/15 종일 일정 수정 뒤 실측).
    func didBecomeActive(now: Date = Date()) {
        let away = now.timeIntervalSince(lastActiveAt)
        returnToTodayIfStale(now: now)
        guard away > 60 else { return }
        // 지금 보는 달은 화면에 둔 채로 새로 받아 바꾸고, 나머지 달은 다음에 볼 때 받는다
        let current = currentMonthKey
        cache = cache.filter { $0.key == current }
        Task { await loadDisplayedMonth(force: true) }
    }

    /// 앱이 뒤로 갈 때 — 떠난 시각을 남긴다
    func markInactive(now: Date = Date()) {
        lastActiveAt = now
    }

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
            // 일정 추가·수정·삭제 뒤의 강제 새로고침 — 홈 화면 위젯도 다시 받게 한다.
            if force { WidgetBridge.reload(); EventReminders.shared.refreshSoon() }
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

    /// 하루 보기에서 달 경계 너머 날짜를 미리 받아 둔다 (표시 달·에러 표시는 건드리지 않음).
    func prefetchMonth(containing date: Date) async {
        let key = Self.key(for: date)
        guard cache[key] == nil, !inFlight.contains(key) else { return }
        inFlight.insert(key)
        defer { inFlight.remove(key) }
        if let response: CalendarEventsResponse = try? await api.get(
            "/api/v1/calendar/events?year=\(key.year)&month=\(key.month)"
        ) {
            cache[key] = MonthData(events: response.events, calendars: response.calendars)
        }
    }

    func hasMonthData(for date: Date) -> Bool { cache[Self.key(for: date)] != nil }

    // MARK: - 이벤트 생성

    /// 이벤트를 생성하고, 성공하면 관련 월 캐시를 비운 뒤 시작일이 있는 달로 이동해 새로고침한다.
    /// - Returns: 생성된 이벤트 — 참석자 초대처럼 event id 가 필요한 후속 작업용.
    @discardableResult
    func createEvent(
        title: String,
        memo: String?,
        allDay: Bool,
        start: Date,
        end: Date,
        calendarId: String?,
        location: String? = nil,
        locationLat: Double? = nil,
        locationLng: Double? = nil,
        travelMin: Int? = nil
    ) async throws -> CalendarEvent {
        let body = CreateEventRequest(
            title: title,
            description: memo,
            startAt: allDay ? APIDateParser.encodeDateOnly(start) : APIDateParser.encodeDateTime(start),
            endAt: allDay ? APIDateParser.encodeDateOnly(end) : APIDateParser.encodeDateTime(end),
            allDay: allDay,
            calendarId: calendarId,
            location: location,
            locationLat: locationLat,
            locationLng: locationLng,
            travelMin: travelMin
        )
        let response: CreateEventResponse = try await api.post(
            "/api/v1/calendar/events",
            body: body
        )

        // 이벤트가 걸친 달의 캐시를 무효화하고 시작일로 이동
        cache.removeValue(forKey: Self.key(for: start))
        cache.removeValue(forKey: Self.key(for: end))
        selectedDate = Self.calendar.startOfDay(for: start)
        displayedMonth = Self.firstDayOfMonth(containing: start)
        await loadDisplayedMonth(force: true)
        return response.event
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

    /// 하루 보기 드래그 — 옮기기(시작·끝 함께)와 길이 바꾸기(끝만)가 모두 여기로 온다.
    /// 캐시에 먼저 반영해 블록이 놓은 자리에 바로 머물고, 저장에 실패하면 원래 자리로 되돌린 뒤 에러를 다시 던진다.
    func retimeEvent(
        _ event: CalendarEvent,
        start newStart: Date,
        end newEnd: Date,
        notifyAttendees: Bool = false
    ) async throws {
        guard newStart != event.startAt || newEnd != event.endAt, newEnd > newStart else { return }
        applyTimes(eventId: event.id, start: newStart, end: newEnd)
        var body = UpdateEventRequest()
        body.startAt = APIDateParser.encodeDateTime(newStart)
        body.endAt = APIDateParser.encodeDateTime(newEnd)
        if event.isGoogle {
            body.sourceCalendarId = event.calendarId
            if notifyAttendees { body.notifyAttendees = true }
        }
        do {
            let _: EventMutationResponse = try await api.patch(
                "/api/v1/calendar/events/\(event.id)",
                body: body
            )
            WidgetBridge.reload(); EventReminders.shared.refreshSoon()
        } catch {
            applyTimes(eventId: event.id, start: event.startAt, end: event.endAt)
            throw error
        }
    }

    // MARK: - 중요도·별점 (1.5.0 A, 나만 본다)

    /// 중요도 — 화면에 먼저 반영하고 실패하면 되돌린다.
    func setImportance(_ event: CalendarEvent, _ importance: EventImportance) async throws {
        let previous = current(event).importance
        guard previous != importance else { return }
        mutate(event.id) { $0.importance = importance }
        do {
            let _: AnnotationResponse = try await api.put(
                "/api/v1/calendar/events/\(event.id)/annotation",
                body: UpdateAnnotationRequest(importance: importance.rawValue)
            )
            WidgetBridge.reload(); EventReminders.shared.refreshSoon()
        } catch {
            mutate(event.id) { $0.importance = previous }
            throw error
        }
    }

    /// 일정별 알림 시점 (nil = 설정의 기본값) — 저장되면 대기 알림을 다시 맞춘다.
    func setReminder(_ event: CalendarEvent, minutes: Int?) async throws {
        let previous = current(event).reminderMinutes
        guard previous != minutes else { return }
        mutate(event.id) { $0.reminderMinutes = minutes }
        do {
            var body = UpdateAnnotationRequest()
            body.reminderMinutes = minutes
            body.setReminder = true
            let _: AnnotationResponse = try await api.put(
                "/api/v1/calendar/events/\(event.id)/annotation",
                body: body
            )
            EventReminders.shared.refreshSoon()
        } catch {
            mutate(event.id) { $0.reminderMinutes = previous }
            throw error
        }
    }

    /// 다시 알림 (nil = 취소) — 저장되면 기기 알림을 다시 맞춘다.
    func setRemindAt(_ event: CalendarEvent, _ date: Date?) async throws {
        let previous = current(event).remindAt
        mutate(event.id) { $0.remindAt = date }
        do {
            var body = UpdateAnnotationRequest()
            body.remindAt = date
            body.setRemindAt = true
            let _: AnnotationResponse = try await api.put(
                "/api/v1/calendar/events/\(event.id)/annotation",
                body: body
            )
            EventReminders.shared.refreshSoon()
        } catch {
            mutate(event.id) { $0.remindAt = previous }
            throw error
        }
    }

    /// 별점 (nil = 지우기) — 완료 흐름을 막지 않도록 화면 먼저, 실패하면 되돌린다.
    func setRating(_ event: CalendarEvent, _ rating: Int?) async throws {
        let previous = current(event).rating
        guard previous != rating else { return }
        mutate(event.id) { $0.rating = rating }
        do {
            var body = UpdateAnnotationRequest()
            if let rating { body.rating = rating } else { body.clearRating = true }
            let _: AnnotationResponse = try await api.put(
                "/api/v1/calendar/events/\(event.id)/annotation",
                body: body
            )
        } catch {
            mutate(event.id) { $0.rating = previous }
            throw error
        }
    }

    /// 캐시에 반영된 최신 상태 (상세 시트가 든 스냅샷이 낡았을 수 있어 캐시 우선)
    func current(_ event: CalendarEvent) -> CalendarEvent {
        for data in cache.values {
            if let cached = data.events.first(where: { $0.id == event.id }) { return cached }
        }
        return event
    }

    private func mutate(_ eventId: String, _ change: (inout CalendarEvent) -> Void) {
        for key in cache.keys {
            guard var data = cache[key] else { continue }
            var changed = false
            for index in data.events.indices where data.events[index].id == eventId {
                change(&data.events[index])
                changed = true
            }
            if changed { cache[key] = data }
        }
    }

    private func applyTimes(eventId: String, start: Date, end: Date) {
        for key in cache.keys {
            guard var data = cache[key] else { continue }
            var changed = false
            for index in data.events.indices where data.events[index].id == eventId {
                data.events[index].startAt = start
                data.events[index].endAt = end
                changed = true
            }
            if changed { cache[key] = data }
        }
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
            WidgetBridge.reload(); EventReminders.shared.refreshSoon()
        } catch {
            applyCompletion(eventId: event.id, completed: previous)
            throw error
        }
    }

    // MARK: - 보관

    /// 보관/보관 해제 — 낙관적으로 캐시에 먼저 반영하고 `PUT .../completion {status}` 로 저장.
    /// 보관하면 완료는 꺼진다 (상태는 하나). 실패하면 원복하고 에러를 다시 던진다.
    func setArchived(_ event: CalendarEvent, archived: Bool) async throws {
        let previous = currentState(of: event)
        guard previous.archived != archived else { return }
        applyState(eventId: event.id, completed: archived ? false : previous.completed, archived: archived)
        do {
            let _: EventCompletionResponse = try await api.put(
                "/api/v1/calendar/events/\(event.id)/completion",
                body: UpdateEventStatusRequest(status: archived ? "archived" : "none")
            )
            WidgetBridge.reload(); EventReminders.shared.refreshSoon()
        } catch {
            applyState(eventId: event.id, completed: previous.completed, archived: previous.archived)
            throw error
        }
    }

    /// 캐시에 반영된 최신 보관 상태.
    func isArchived(_ event: CalendarEvent) -> Bool {
        currentState(of: event).archived
    }

    private func currentState(of event: CalendarEvent) -> (completed: Bool, archived: Bool) {
        for data in cache.values {
            if let cached = data.events.first(where: { $0.id == event.id }) {
                return (cached.completed, cached.archived)
            }
        }
        return (event.completed, event.archived)
    }

    private func applyState(eventId: String, completed: Bool, archived: Bool) {
        for key in cache.keys {
            guard var data = cache[key] else { continue }
            var changed = false
            for index in data.events.indices where data.events[index].id == eventId {
                data.events[index].completed = completed
                data.events[index].archived = archived
                changed = true
            }
            if changed { cache[key] = data }
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
                // 완료로 체크하면 서버가 보관을 완료로 바꾼다 — 화면도 같이.
                if completed { data.events[index].archived = false }
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
