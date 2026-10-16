import SwiftUI

/// 이벤트 수정 시트 — PATCH /api/v1/calendar/events/{id}
/// AddEventSheet 와 같은 폼을 프리필한다. 캘린더 Picker 로 로컬↔로컬,
/// 로컬↔구글, 구글(같은 계정)간 이동을 지원한다 (서버가 복사+삭제로 처리).
/// 바뀐 필드만 보내고, 시작/종료는 서버 요구대로 항상 쌍으로 보낸다.
struct EditEventSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: CalendarViewModel
    let event: CalendarEvent
    /// 저장 성공 후 호출 — 부모(상세 시트)가 자신을 닫는 데 사용.
    let onSaved: () -> Void

    @State private var title: String
    @State private var memo: String
    @State private var allDay: Bool
    @State private var start: Date
    @State private var end: Date
    @State private var selectedCalendarId: String?
    /// 위치 — 자유 텍스트 + (주소 검색 시) 좌표
    @State private var locationText: String
    @State private var locationLat: Double?
    @State private var locationLng: Double?
    @State private var travelMin: Int?
    @State private var isSaving = false
    @State private var errorMessage: String?
    /// 중요도 (1.5.0 A) — 일정 수정과 따로 저장한다
    @State private var importance: EventImportance
    /// 일정별 알림 시점 — nil 은 설정의 기본값
    @State private var reminderMinutes: Int?
    /// 참석자가 있는 구글 일정의 시간을 바꿀 때 — 확인을 누르면 구글이 참석자에게 변경 메일을 보낸다
    @State private var pendingNotifyBody: UpdateEventRequest?
    /// 반복(1.5.1) — 시리즈 정보를 읽어 채운다. 원래 규칙과 비교해 바뀌었을 때만 보낸다.
    @State private var repeatRule = RepeatRule()
    @State private var originalRepeat = RepeatRule()
    /// 앱이 못 만드는 규칙(격주 등) — 반복 칸을 잠근다
    @State private var repeatUnsupported = false
    @State private var series: SeriesInfo?
    /// 반복 회차 저장 — 범위 묻기 / 고른 범위로 보낼 본문 / 구글 '모두' 확인
    @State private var scopeBody: UpdateEventRequest?
    @State private var showScopeDialog = false
    @State private var pendingAllBody: UpdateEventRequest?

    /// 시트를 연 시점의 최신 캘린더 목록 — 월 캐시는 설정에서 새로 만든
    /// 캘린더를 모를 수 있어, 열릴 때 서버에서 다시 받아 덮어쓴다.
    @State private var freshCalendars: [CalendarInfo]?

    /// 이동 가능한 대상 — 전체 캘린더 (다른 Google 계정 간 이동만 서버가 거부).
    /// 옮길 수 있는 캘린더 — 보기 전용·보관한 캘린더는 빼되, 지금 소속 캘린더는 늘 보인다
    private var movableCalendars: [CalendarInfo] {
        (freshCalendars ?? viewModel.calendars).filter {
            ($0.canEdit && !$0.isArchived) || $0.id == event.calendarId
        }
    }

    /// 참석자(나 말고)가 있는 구글 일정
    private var hasGoogleAttendees: Bool {
        event.isGoogle && event.attendees.contains(where: { !$0.isSelf })
    }

    /// 참석자가 있는 구글 일정은 Orbit42 캘린더로 옮기지 못한다 — 옮기면 구글 원본이 지워져
    /// 참석자 쪽 일정이 알림 없이 사라지고 참석자 정보도 따라오지 않는다.
    private var blockedCalendarIds: Set<String> {
        // 반복 일정은 다른 캘린더로 옮기지 않는다(서버도 거절)
        if event.isRecurring || repeatRule.isRepeating {
            return Set(movableCalendars.map(\.id)).subtracting([event.calendarId].compactMap { $0 })
        }
        guard hasGoogleAttendees else { return [] }
        return Set(movableCalendars.filter(\.isNative).map(\.id))
    }

    /// 변경 감지용 원본 값
    private let originalStart: Date
    private let originalEnd: Date

    init(viewModel: CalendarViewModel, event: CalendarEvent, onSaved: @escaping () -> Void) {
        self.viewModel = viewModel
        self.event = event
        self.onSaved = onSaved

        _title = State(initialValue: event.title)
        _memo = State(initialValue: event.description ?? "")
        _allDay = State(initialValue: event.allDay)

        // 종일 이벤트의 end 는 "마지막 날 포함" 으로 프리필 (배타적 자정 end 보정 포함)
        let calendar = CalendarViewModel.calendar
        let initialEnd = event.allDay
            ? calendar.startOfDay(for: event.effectiveEnd(calendar: calendar))
            : event.endAt
        _start = State(initialValue: event.startAt)
        _end = State(initialValue: initialEnd)
        _selectedCalendarId = State(initialValue: event.calendarId)
        _importance = State(initialValue: viewModel.current(event).importance)
        _reminderMinutes = State(initialValue: viewModel.current(event).reminderMinutes)
        _locationText = State(initialValue: event.location ?? "")
        _locationLat = State(initialValue: event.locationLat)
        _locationLng = State(initialValue: event.locationLng)
        _travelMin = State(initialValue: event.travelMin)
        originalStart = event.startAt
        originalEnd = initialEnd
    }

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("제목", text: $title)
                        .foregroundStyle(Theme.primaryText)
                }
                .listRowBackground(Theme.surface)

                if movableCalendars.count > 1 {
                    Section {
                        CalendarChips(
                            calendars: movableCalendars,
                            selection: $selectedCalendarId,
                            disabledIds: blockedCalendarIds
                        )
                    } header: {
                        Text("캘린더")
                    } footer: {
                        if event.isRecurring || repeatRule.isRepeating {
                            Text("반복 일정은 다른 캘린더로 옮길 수 없어요.")
                                .foregroundStyle(Theme.secondaryText)
                        } else if !blockedCalendarIds.isEmpty {
                            Text("참석자가 있는 구글 일정은 구글 캘린더 안에서만 옮길 수 있어요.")
                                .foregroundStyle(Theme.secondaryText)
                        } else if selectedCalendarId != event.calendarId {
                            Text("저장하면 일정이 선택한 캘린더로 이동해요.")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    ImportancePicker(selection: $importance)
                } header: {
                    Text("중요도")
                }
                .listRowBackground(Theme.surface)

                if !allDay {
                    Section {
                        Picker("알림", selection: $reminderMinutes) {
                            Text(defaultReminderLabel).tag(Int?.none)
                            ForEach(ReminderOption.allCases) { Text($0.label).tag(Int?.some($0.rawValue)) }
                        }
                    } footer: {
                        Text("이 기기에서 알려 드려요. 기본값은 설정 › 캘린더에서 바꿀 수 있어요.")
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    Toggle("종일", isOn: $allDay)
                        .tint(Theme.accent)
                    DatePicker(
                        "시작",
                        selection: $start,
                        displayedComponents: allDay ? [.date] : [.date, .hourAndMinute]
                    )
                    if !allDay {
                        DurationChips(start: start, end: $end)
                    }
                    DatePicker(
                        "종료",
                        selection: $end,
                        in: start...,
                        displayedComponents: allDay ? [.date] : [.date, .hourAndMinute]
                    )
                }
                .listRowBackground(Theme.surface)

                if canEditRepeat {
                    RepeatSection(
                        rule: $repeatRule,
                        start: start,
                        lockedReason: repeatUnsupported ? "이 반복은 앱에서 바꿀 수 없어요. 구글 캘린더 앱에서 바꿔 주세요." : nil
                    )
                }

                EventLocationSection(
                    locationText: $locationText,
                    locationLat: $locationLat,
                    locationLng: $locationLng,
                    travelMin: $travelMin
                )

                Section {
                    TextField("메모 (선택)", text: $memo, axis: .vertical)
                        .lineLimit(3...6)
                        .foregroundStyle(Theme.primaryText)
                }
                .listRowBackground(Theme.surface)

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .environment(\.locale, Locale(identifier: "ko_KR"))
            .navigationTitle("일정 수정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Button("저장") { save() }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .alert(
                "시간을 바꿀까요?",
                isPresented: Binding(
                    get: { pendingNotifyBody != nil },
                    set: { if !$0 { pendingNotifyBody = nil } }
                ),
                presenting: pendingNotifyBody
            ) { body in
                Button("취소", role: .cancel) {}
                Button("바꾸기") {
                    var confirmed = body
                    confirmed.notifyAttendees = true
                    submit(confirmed)
                }
            } message: { _ in
                Text("참석자에게 구글 캘린더 변경 알림이 갑니다.")
            }
            .recurrenceScopeDialog(
                "반복 일정 고치기",
                isPresented: $showScopeDialog,
                isGoogle: event.isGoogle,
                allowThis: !repeatChanged
            ) { scope in
                guard var body = scopeBody else { return }
                body.scope = scope.rawValue
                confirmAndSubmit(body, scope: scope)
            }
            .alert(
                "모든 회차를 바꿀까요?",
                isPresented: Binding(
                    get: { pendingAllBody != nil },
                    set: { if !$0 { pendingAllBody = nil } }
                ),
                presenting: pendingAllBody
            ) { body in
                Button("취소", role: .cancel) {}
                Button("바꾸기") {
                    var confirmed = body
                    if hasGoogleAttendees { confirmed.notifyAttendees = true }
                    submit(confirmed)
                }
            } message: { _ in
                Text(allWarning)
            }
            .onChange(of: start) { oldStart, newStart in
                // 시작을 옮기면 종료도 같은 간격을 유지한 채 따라간다.
                // (예전엔 뒤집힐 때만 보정해서, 09→14 로 옮기면 종료가 10:00 에
                //  남아 매번 손으로 고쳐야 했다.)
                let delta = newStart.timeIntervalSince(oldStart)
                if delta != 0 {
                    end = end.addingTimeInterval(delta)
                }
                if end < newStart {
                    end = allDay
                        ? newStart
                        : newStart.addingTimeInterval(AppSettings.shared.eventDuration.seconds)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task {
                if event.isRecurring, let info = await viewModel.seriesInfo(event) {
                    series = info
                    if let rule = RepeatRule(rrule: info.rrule, isAnniversary: info.isAnniversary) {
                        repeatRule = rule
                        originalRepeat = rule
                    } else {
                        repeatUnsupported = true
                    }
                }
                if let response: CalendarsResponse = try? await APIClient.shared.get("/api/v1/calendars") {
                    freshCalendars = response.calendars
                }
            }
        }
    }

    // MARK: - 저장

    private func save() {
        errorMessage = nil

        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedMemo = memo.trimmingCharacters(in: .whitespacesAndNewlines)
        let originalMemo = (event.description ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let clampedEnd = max(end, start)

        var body = UpdateEventRequest()
        if trimmedTitle != event.title {
            body.title = trimmedTitle
        }
        if trimmedMemo != originalMemo {
            body.description = trimmedMemo
        }
        // 시간 관련 필드가 하나라도 바뀌면 startAt/endAt 을 쌍으로 보낸다 (서버가 쌍 요구)
        let timeChanged = allDay != event.allDay || start != originalStart || clampedEnd != originalEnd
        if timeChanged {
            body.startAt = allDay ? APIDateParser.encodeDateOnly(start) : APIDateParser.encodeDateTime(start)
            body.endAt = allDay ? APIDateParser.encodeDateOnly(clampedEnd) : APIDateParser.encodeDateTime(clampedEnd)
        }
        if allDay != event.allDay {
            body.allDay = allDay
        }

        // 캘린더 이동 — 대상이 현재 소속과 다를 때만 보낸다
        if let selectedCalendarId, selectedCalendarId != event.calendarId {
            body.calendarId = selectedCalendarId
        }

        // 위치 변경 — 빈 문자열은 해제로 처리된다
        let trimmedLocation = locationText.trimmingCharacters(in: .whitespaces)
        if trimmedLocation != (event.location ?? "")
            || locationLat != event.locationLat
            || locationLng != event.locationLng {
            body.location = trimmedLocation
            body.locationLat = locationLat
            body.locationLng = locationLng
        }

        // 이동시간 변경 — 해제는 0 으로 전송
        if travelMin != event.travelMin {
            body.travelMin = travelMin ?? 0
        }

        // 반복 규칙 — 바뀌었을 때만("" = 반복 끄기)
        if repeatChanged {
            body.rrule = repeatRule.rrule(start: start, allDay: allDay) ?? ""
            body.isAnniversary = repeatRule.anniversary
        }

        // 바뀐 것이 없으면 네트워크 없이 닫는다
        if body.title == nil, body.description == nil, body.startAt == nil,
           body.allDay == nil, body.calendarId == nil, body.location == nil,
           body.travelMin == nil, body.rrule == nil {
            if importanceChanged {
                saveImportanceOnly()
            } else {
                dismiss()
            }
            return
        }

        // Google 이벤트("gcal_" id)는 현재 소속 native 캘린더 uuid 를 함께 보낸다
        // (서버가 소속 Google 계정/캘린더를 해석하는 데 사용)
        if event.isGoogle {
            body.sourceCalendarId = event.calendarId
        }

        // 반복 회차 — 범위를 먼저 묻는다
        if event.isRecurring {
            scopeBody = body
            showScopeDialog = true
            return
        }

        // 참석자가 있는 구글 일정의 시간·날짜가 바뀌면 먼저 확인받는다 (확인해야만 참석자에게 메일).
        // 구글 캘린더끼리 옮기며 시간을 바꿀 때도 같다 (Orbit42 캘린더로는 위에서 막는다).
        if hasGoogleAttendees, timeChanged || body.rrule != nil {
            pendingNotifyBody = body
            return
        }
        submit(body)
    }

    /// 반복 칸을 보일지 — 구글은 주최자만, 예약 일정은 안 됨
    private var canEditRepeat: Bool {
        !event.isBooking && event.canModifyGoogle && !event.isInvite
    }

    private var repeatChanged: Bool {
        !repeatUnsupported && repeatRule != originalRepeat
    }

    /// 범위를 고른 뒤 — 구글 '모두'는 시간이 바뀌면 따로 고친·지운 회차가 원래대로 돌아가고,
    /// 참석자가 있으면 모든 회차의 참석자에게 알림이 간다. 해당할 때만 한 창으로 묻는다.
    private func confirmAndSubmit(_ body: UpdateEventRequest, scope: RecurrenceScope) {
        // 실측: 구글은 시간을 바꿀 때만 예외를 되돌린다(규칙 횟수·제목 변경은 지운 회차가 그대로)
        let timeChanged = body.startAt != nil
        if event.isGoogle, scope == .all, (timeChanged && resetCount > 0) || (hasGoogleAttendees && (timeChanged || body.rrule != nil)) {
            pendingAllBody = body
            return
        }
        if event.isGoogle, scope == .this, body.startAt != nil, hasGoogleAttendees {
            pendingNotifyBody = body
            return
        }
        submit(body)
    }

    private var resetCount: Int {
        guard event.isGoogle else { return 0 }
        return (series?.modifiedCount ?? 0) + (series?.cancelledCount ?? 0)
    }

    private var allWarning: String {
        var lines: [String] = []
        let modified = series?.modifiedCount ?? 0
        let cancelled = series?.cancelledCount ?? 0
        if pendingAllBody?.startAt != nil, modified > 0 || cancelled > 0 {
            if modified > 0, cancelled > 0 {
                lines.append("따로 고친 회차 \(modified)개와 지운 회차 \(cancelled)개가 원래대로 돌아가요. 지운 회차는 다시 생겨요.")
            } else if modified > 0 {
                lines.append("따로 고친 회차 \(modified)개가 원래대로 돌아가요.")
            } else {
                lines.append("지운 회차 \(cancelled)개가 다시 생겨요.")
            }
        }
        if hasGoogleAttendees { lines.append("모든 회차의 참석자에게 변경 알림이 갑니다.") }
        return lines.joined(separator: "\n")
    }

    /// '기본값'이 실제로 무엇인지 — 중요함은 30·10분 전, 스위치가 꺼진 쪽은 알리지 않음
    private var defaultReminderLabel: String {
        if importance == .high { return "기본값 (중요함: 30분·10분 전)" }
        let settings = AppSettings.shared
        let on = event.isGoogle ? settings.notifyGoogleEvents : settings.notifyOrbitEvents
        return on ? "기본값 (\(settings.defaultReminder.label))" : "기본값 (알리지 않음)"
    }

    private var importanceChanged: Bool {
        importance != viewModel.current(event).importance || reminderChanged
    }

    private var reminderChanged: Bool {
        reminderMinutes != viewModel.current(event).reminderMinutes
    }

    /// 중요도·알림 시점 (일정 수정과 따로 저장하는 주석)
    private func saveAnnotations() async throws {
        if importance != viewModel.current(event).importance {
            try await viewModel.setImportance(event, importance)
        }
        if reminderChanged {
            try await viewModel.setReminder(event, minutes: reminderMinutes)
        }
    }

    /// 중요도만 바뀐 수정 — 일정은 그대로 두고 주석만 저장한다
    private func saveImportanceOnly() {
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                try await saveAnnotations()
                dismiss()
                onSaved()
            } catch {
                errorMessage = "중요도·알림을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    private func submit(_ body: UpdateEventRequest) {
        let clampedEnd = max(end, start)
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                // 중요도를 먼저 — 캘린더를 옮기면 일정 키가 바뀌는데 서버가 주석도 함께 옮긴다
                if importanceChanged {
                    try await saveAnnotations()
                }
                try await viewModel.updateEvent(event, body: body, newStart: start, newEnd: clampedEnd)
                dismiss()
                onSaved()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "일정을 수정하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}
