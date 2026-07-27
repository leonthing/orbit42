import SwiftUI

/// 이벤트 추가 시트 — POST /api/v1/calendar/events
struct AddEventSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: CalendarViewModel

    @State private var title = ""
    @State private var memo = ""
    @State private var allDay = false
    @State private var start: Date
    @State private var end: Date
    @State private var selectedCalendarId: String?
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(viewModel: CalendarViewModel, defaultDate: Date) {
        self.viewModel = viewModel

        // 선택된 날짜 + 다음 정시로 시작 시각 제안
        let calendar = CalendarViewModel.calendar
        let now = Date()
        let hour = calendar.component(.hour, from: now)
        let suggestedHour = min(hour + 1, 23)
        let startDate = calendar.date(
            bySettingHour: suggestedHour, minute: 0, second: 0,
            of: calendar.startOfDay(for: defaultDate)
        ) ?? defaultDate
        _start = State(initialValue: startDate)
        _end = State(initialValue: startDate.addingTimeInterval(3600))

        // 기본값: isDefault 캘린더. 구글 연동 캘린더도 선택 가능
        // (서버가 생성 시 구글에도 push 한다).
        let writable = viewModel.calendars
        _selectedCalendarId = State(initialValue: (writable.first(where: \.isDefault) ?? writable.first)?.id)
    }

    /// 시트를 연 시점의 최신 캘린더 목록 — 월 캐시(viewModel.calendars)는 설정에서
    /// 새로 만든 캘린더를 모를 수 있어, 열릴 때 서버에서 다시 받아 덮어쓴다.
    @State private var freshCalendars: [CalendarInfo]?

    private var writableCalendars: [CalendarInfo] {
        freshCalendars ?? viewModel.calendars
    }

    private func refreshCalendars() async {
        guard let response: CalendarsResponse = try? await APIClient.shared.get("/api/v1/calendars") else {
            return
        }
        freshCalendars = response.calendars
        // 선택이 비어있거나(캐시가 비었던 경우) 사라진 캘린더면 기본값으로 보정.
        if selectedCalendarId == nil
            || !response.calendars.contains(where: { $0.id == selectedCalendarId }) {
            selectedCalendarId = (response.calendars.first(where: \.isDefault)
                ?? response.calendars.first)?.id
        }
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

                if !writableCalendars.isEmpty {
                    Section {
                        Picker("캘린더", selection: $selectedCalendarId) {
                            ForEach(writableCalendars) { calendarInfo in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(calendarInfo.displayColor)
                                        .frame(width: 10, height: 10)
                                    Text(calendarInfo.name)
                                }
                                .tag(Optional(calendarInfo.id))
                            }
                        }
                    }
                    .listRowBackground(Theme.surface)
                }

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
            .navigationTitle("새 일정")
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
            .task { await refreshCalendars() }
        }
    }

    private func save() {
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let trimmedMemo = memo.trimmingCharacters(in: .whitespacesAndNewlines)
                try await viewModel.createEvent(
                    title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                    memo: trimmedMemo.isEmpty ? nil : trimmedMemo,
                    allDay: allDay,
                    start: start,
                    end: max(end, start),
                    calendarId: selectedCalendarId
                )
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    AddEventSheet(viewModel: CalendarViewModel(), defaultDate: Date())
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
