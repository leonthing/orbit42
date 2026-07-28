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
    @State private var isSaving = false
    @State private var errorMessage: String?

    /// 시트를 연 시점의 최신 캘린더 목록 — 월 캐시는 설정에서 새로 만든
    /// 캘린더를 모를 수 있어, 열릴 때 서버에서 다시 받아 덮어쓴다.
    @State private var freshCalendars: [CalendarInfo]?

    /// 이동 가능한 대상 — 전체 캘린더 (다른 Google 계정 간 이동만 서버가 거부).
    private var movableCalendars: [CalendarInfo] {
        freshCalendars ?? viewModel.calendars
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
        _locationText = State(initialValue: event.location ?? "")
        _locationLat = State(initialValue: event.locationLat)
        _locationLng = State(initialValue: event.locationLng)
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
                        .foregroundStyle(.white)
                }
                .listRowBackground(Theme.surface)

                Section {
                    Toggle("종일", isOn: $allDay)
                        .tint(Theme.accent)
                    DatePicker(
                        "시작",
                        selection: $start,
                        displayedComponents: allDay ? [.date] : [.date, .hourAndMinute]
                    )
                    DatePicker(
                        "종료",
                        selection: $end,
                        in: start...,
                        displayedComponents: allDay ? [.date] : [.date, .hourAndMinute]
                    )
                }
                .listRowBackground(Theme.surface)

                if movableCalendars.count > 1 {
                    Section {
                        Picker("캘린더", selection: $selectedCalendarId) {
                            ForEach(movableCalendars) { calendar in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(calendar.displayColor)
                                        .frame(width: 10, height: 10)
                                    Text(calendar.name)
                                }
                                .tag(Optional(calendar.id))
                            }
                        }
                        .tint(Theme.secondaryText)
                    } footer: {
                        if selectedCalendarId != event.calendarId {
                            Text("저장하면 일정이 선택한 캘린더로 이동해요.")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                    .listRowBackground(Theme.surface)
                }

                EventLocationSection(
                    locationText: $locationText,
                    locationLat: $locationLat,
                    locationLng: $locationLng
                )

                Section {
                    TextField("메모 (선택)", text: $memo, axis: .vertical)
                        .lineLimit(3...6)
                        .foregroundStyle(.white)
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
            .onChange(of: start) { _, newStart in
                if end < newStart {
                    end = allDay ? newStart : newStart.addingTimeInterval(3600)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task {
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

        // 바뀐 것이 없으면 네트워크 없이 닫는다
        if body.title == nil, body.description == nil, body.startAt == nil,
           body.allDay == nil, body.calendarId == nil, body.location == nil {
            dismiss()
            return
        }

        // Google 이벤트("gcal_" id)는 현재 소속 native 캘린더 uuid 를 함께 보낸다
        // (서버가 소속 Google 계정/캘린더를 해석하는 데 사용)
        if event.isGoogle {
            body.sourceCalendarId = event.calendarId
        }

        isSaving = true
        Task {
            defer { isSaving = false }
            do {
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
