import SwiftUI

/// 다시 알림 (1.5.0 B) — 1주 뒤 / 한 달 뒤 / 날짜 고르기. 그날 오전 9시(기기 시간대)에 알린다.
enum RemindLater {
    static func oneWeek(from now: Date = Date()) -> Date {
        EventReminders.nineAM(on: Calendar.current.date(byAdding: .day, value: 7, to: now) ?? now)
    }

    static func oneMonth(from now: Date = Date()) -> Date {
        EventReminders.nineAM(on: Calendar.current.date(byAdding: .month, value: 1, to: now) ?? now)
    }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E) a h시"
        return f
    }()

    /// "10월 21일 (화) 오전 9시"
    static func label(_ date: Date) -> String { formatter.string(from: date) }
}

/// 날짜 고르기 — 지난 날짜와 오전 9시가 이미 지난 오늘은 고를 수 없다.
struct RemindDatePickerSheet: View {
    let onPick: (Date) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var day = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                DatePicker(
                    "날짜",
                    selection: $day,
                    in: EventReminders.firstSelectableDay()...,
                    displayedComponents: [.date]
                )
                .datePickerStyle(.graphical)
                .environment(\.locale, Locale(identifier: "ko_KR"))
                .tint(Theme.accent)
                Text("\(RemindLater.label(EventReminders.nineAM(on: day)))에 이 일정을 다시 알려 드려요.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                Spacer()
            }
            .padding(16)
            .background(Theme.background)
            .navigationTitle("다시 알림")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("설정") {
                        onPick(EventReminders.nineAM(on: day))
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.large])
    }
}

/// 설정 › 다시 알림 목록 — 날짜순, 누르면 그 일정 상세, 밀어서 취소. 못 찾는 일정은 "지워진 일정".
struct RemindersListView: View {
    @Environment(TabRouter.self) private var router
    @Environment(\.dismiss) private var dismiss
    @State private var reminders: [ActiveReminder]?
    @State private var errorMessage: String?

    var body: some View {
        List {
            if let reminders {
                if reminders.isEmpty {
                    Text("걸어 둔 다시 알림이 없어요. 일정 상세의 '…'에서 걸 수 있어요.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .listRowBackground(Theme.surface)
                }
                ForEach(reminders) { item in
                    Button { open(item) } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.missing ? "지워진 일정" : (item.title ?? ""))
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(item.missing ? Theme.secondaryText : Theme.primaryText)
                            Text("\(RemindLater.label(item.remindDate)) 다시 알림")
                                .font(.caption)
                                .foregroundStyle(Theme.accent)
                            if !item.missing {
                                Text(item.body).font(.caption).foregroundStyle(Theme.secondaryText)
                            }
                        }
                    }
                    .disabled(item.missing)
                    .swipeActions {
                        Button("취소", role: .destructive) { cancel(item) }
                    }
                    .listRowBackground(Theme.surface)
                }
            } else {
                ProgressView().listRowBackground(Theme.surface)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("다시 알림")
        .navigationBarTitleDisplayMode(.inline)
        .alert("취소하지 못했어요", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("확인", role: .cancel) {}
        } message: { Text(errorMessage ?? "") }
        .task { reminders = await EventReminders.shared.fetchReminders() ?? [] }
    }

    private func open(_ item: ActiveReminder) {
        router.selection = .calendar
        router.calendarEventRequest = CalendarEventRequest(eventId: item.eventId, date: item.startDate ?? item.remindDate)
    }

    private func cancel(_ item: ActiveReminder) {
        let previous = reminders
        reminders?.removeAll { $0.id == item.id }
        Task {
            do {
                var body = UpdateAnnotationRequest()
                body.setRemindAt = true
                let _: AnnotationResponse = try await APIClient.shared.put(
                    "/api/v1/calendar/events/\(item.eventId)/annotation",
                    body: body
                )
                EventReminders.shared.refreshSoon()
            } catch {
                reminders = previous
                errorMessage = "잠시 후 다시 시도해 주세요."
            }
        }
    }
}
