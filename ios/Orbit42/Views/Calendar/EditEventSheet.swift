import SwiftUI

/// 이벤트 수정 시트 — PATCH /api/v1/calendar/events/{id}
/// AddEventSheet 와 같은 폼을 프리필하되, 캘린더 이동은 미지원이라 캘린더 Picker 는 없다.
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
    @State private var isSaving = false
    @State private var errorMessage: String?

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

        // 바뀐 것이 없으면 네트워크 없이 닫는다
        if body.title == nil, body.description == nil, body.startAt == nil, body.allDay == nil {
            dismiss()
            return
        }

        // Google 이벤트("gcal_" id)는 소속 native 캘린더 uuid 를 body 에 반드시 포함
        if event.isGoogle {
            body.calendarId = event.calendarId
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
