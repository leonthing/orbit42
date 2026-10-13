import SwiftUI

/// "다른 날로" — 같은 제목·길이·캘린더로 새 일정을 만들고 원본은 보관한다.
/// 구글 일정이면 구글에 새로 만든다 (참석자는 복사하지 않아 초대 메일도 없다). 원본은 지우지 않는다.
struct MoveEventSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: CalendarViewModel
    let event: CalendarEvent
    /// 새 일정을 만들고 원본을 보관한 뒤 — 상세 시트까지 닫는다.
    var onMoved: () -> Void = {}

    @State private var newStart: Date
    @State private var isSaving = false
    @State private var errorMessage: String?

    private var calendar: Calendar { CalendarViewModel.calendar }

    init(viewModel: CalendarViewModel, event: CalendarEvent, onMoved: @escaping () -> Void = {}) {
        self.viewModel = viewModel
        self.event = event
        self.onMoved = onMoved
        // 기본값은 다음 날 같은 시각.
        let next = CalendarViewModel.calendar.date(byAdding: .day, value: 1, to: event.startAt) ?? event.startAt
        _newStart = State(initialValue: next)
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    DatePicker(
                        event.allDay ? "날짜" : "시작",
                        selection: $newStart,
                        displayedComponents: event.allDay ? [.date] : [.date, .hourAndMinute]
                    )
                    .datePickerStyle(.graphical)
                    .tint(Theme.accent)
                    .environment(\.locale, Locale(identifier: "ko_KR"))
                    .environment(\.calendar, calendar)
                } footer: {
                    Text("같은 제목·길이·캘린더로 새 일정을 만들고, 지금 일정은 보관해요. 원래 일정은 지우지 않아요."
                         + (event.isGoogle ? " 참석자는 옮기지 않아 초대 메일이 가지 않아요." : ""))
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
            .navigationTitle("다른 날로")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView().tint(Theme.accent)
                    } else {
                        Button("옮기기") { move() }
                            .fontWeight(.semibold)
                    }
                }
            }
            .interactiveDismissDisabled(isSaving)
        }
    }

    /// "10/13에서 옮김" + 원래 메모
    private var movedMemo: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.calendar = calendar
        formatter.dateFormat = "M/d"
        let line = "\(formatter.string(from: event.startAt))에서 옮김"
        if let memo = event.description?.trimmingCharacters(in: .whitespacesAndNewlines), !memo.isEmpty {
            return line + "\n\n" + memo
        }
        return line
    }

    private func move() {
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            let start: Date
            let end: Date
            if event.allDay {
                // 종일은 날짜 수를 유지한다.
                start = calendar.startOfDay(for: newStart)
                let days = calendar.dateComponents(
                    [.day],
                    from: calendar.startOfDay(for: event.startAt),
                    to: calendar.startOfDay(for: event.effectiveEnd(calendar: calendar))
                ).day ?? 0
                end = calendar.date(byAdding: .day, value: days, to: start) ?? start
            } else {
                start = newStart
                end = newStart.addingTimeInterval(max(event.endAt.timeIntervalSince(event.startAt), 0))
            }
            do {
                _ = try await viewModel.createEvent(
                    title: event.title,
                    memo: movedMemo,
                    allDay: event.allDay,
                    start: start,
                    end: end,
                    calendarId: event.calendarId,
                    location: event.location,
                    locationLat: event.locationLat,
                    locationLng: event.locationLng,
                    travelMin: event.travelMin
                )
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
                return
            } catch {
                errorMessage = "새 일정을 만들지 못했어요. 잠시 후 다시 시도해 주세요."
                return
            }
            // 새 일정은 만들어졌다 — 원본 보관이 실패해도 새 일정은 남기고 알린다.
            do {
                try await viewModel.setArchived(event, archived: true)
            } catch {
                errorMessage = "새 일정은 만들었지만 원래 일정을 보관하지 못했어요. 상세에서 직접 보관해 주세요."
                return
            }
            dismiss()
            onMoved()
        }
    }
}
