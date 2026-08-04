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
        // 기본 길이는 캘린더 설정(AppSettings.eventDuration)을 따른다.
        _end = State(
            initialValue: startDate.addingTimeInterval(AppSettings.shared.eventDuration.seconds)
        )

        // 기본값: isDefault 캘린더. 구글 연동 캘린더도 선택 가능
        // (서버가 생성 시 구글에도 push 한다).
        let writable = viewModel.calendars
        _selectedCalendarId = State(initialValue: (writable.first(where: \.isDefault) ?? writable.first)?.id)
    }

    /// 시트를 연 시점의 최신 캘린더 목록 — 월 캐시(viewModel.calendars)는 설정에서
    /// 새로 만든 캘린더를 모를 수 있어, 열릴 때 서버에서 다시 받아 덮어쓴다.
    @State private var freshCalendars: [CalendarInfo]?

    /// 위치 — 자유 텍스트 + (주소 검색 시) 좌표
    @State private var locationText = ""
    @State private var locationLat: Double?
    @State private var locationLng: Double?
    @State private var travelMin: Int?

    /// 참석자는 event_key 가 있어야 붙일 수 있어서, 저장 전에는 여기 담아 뒀다가
    /// 일정이 만들어진 직후 초대를 보낸다.
    @State private var pendingParticipants: [PendingParticipant] = []
    @State private var showingAddParticipant = false
    /// 일정은 저장됐는데 초대만 실패한 상태 — 다시 "저장" 을 눌러도 일정이
    /// 두 번 만들어지지 않도록 붙잡아 둔다.
    @State private var createdEvent: CalendarEvent?

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
                        .foregroundStyle(Theme.primaryText)
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

                EventLocationSection(
                    locationText: $locationText,
                    locationLat: $locationLat,
                    locationLng: $locationLng,
                    travelMin: $travelMin
                )

                participantsSection

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
            .task { await refreshCalendars() }
            .sheet(isPresented: $showingAddParticipant) {
                ParticipantAddSheet(mode: .collect($pendingParticipants))
            }
        }
    }

    // MARK: - 참석자

    private var participantsSection: some View {
        Section {
            ForEach(pendingParticipants) { pending in
                HStack(spacing: 10) {
                    DiscoverAvatar(
                        url: pending.avatarURL,
                        name: pending.label,
                        size: 30
                    )
                    VStack(alignment: .leading, spacing: 1) {
                        Text(pending.label)
                            .font(.subheadline)
                            .foregroundStyle(Theme.primaryText)
                            .lineLimit(1)
                        Text(pending.detail)
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                            .lineLimit(1)
                    }
                    Spacer()
                }
            }
            .onDelete { offsets in
                pendingParticipants.remove(atOffsets: offsets)
            }

            Button {
                showingAddParticipant = true
            } label: {
                Label("참석자 추가", systemImage: "person.badge.plus")
                    .foregroundStyle(Theme.accent)
            }
            .disabled(isSaving)
        } header: {
            Text("참석자")
        } footer: {
            Text(
                pendingParticipants.isEmpty
                    ? "orbit42 사용자를 태그하거나 이메일로 초대할 수 있어요."
                    : "일정을 저장하면 \(pendingParticipants.count)명에게 초대가 나가요."
            )
        }
        .listRowBackground(Theme.surface)
    }

    private func save() {
        errorMessage = nil
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                let event: CalendarEvent
                if let createdEvent {
                    // 일정은 이미 만들어졌고 초대만 남은 재시도.
                    event = createdEvent
                } else {
                    let trimmedMemo = memo.trimmingCharacters(in: .whitespacesAndNewlines)
                    event = try await viewModel.createEvent(
                        title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                        memo: trimmedMemo.isEmpty ? nil : trimmedMemo,
                        allDay: allDay,
                        start: start,
                        end: max(end, start),
                        calendarId: selectedCalendarId,
                        location: locationText.trimmingCharacters(in: .whitespaces).isEmpty
                            ? nil : locationText.trimmingCharacters(in: .whitespaces),
                        locationLat: locationLat,
                        locationLng: locationLng,
                        travelMin: travelMin
                    )
                    createdEvent = event
                }

                let failed = await invitePending(to: event)
                guard failed.isEmpty else {
                    // 일정은 살아 있다. 실패한 사람만 남겨 두고 다시 시도하게 한다.
                    pendingParticipants = failed
                    errorMessage = "일정은 저장했지만 \(failed.count)명을 초대하지 못했어요. 다시 시도해 주세요."
                    return
                }
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "일정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    /// 담아 둔 참석자를 순서대로 초대하고, 실패한 사람만 돌려준다.
    private func invitePending(to event: CalendarEvent) async -> [PendingParticipant] {
        guard !pendingParticipants.isEmpty else { return [] }
        let snapshot = AddParticipantRequest(
            username: nil,
            email: nil,
            title: event.title,
            startAt: event.allDay
                ? APIDateParser.encodeDateOnly(event.startAt)
                : APIDateParser.encodeDateTime(event.startAt),
            endAt: event.allDay
                ? APIDateParser.encodeDateOnly(event.endAt)
                : APIDateParser.encodeDateTime(event.endAt),
            allDay: event.allDay
        )
        var failed: [PendingParticipant] = []
        for pending in pendingParticipants {
            var body = snapshot
            body.username = pending.username
            body.email = pending.email
            do {
                let _: ParticipantsResponse = try await APIClient.shared.post(
                    "/api/v1/calendar/events/\(event.id)/participants",
                    body: body
                )
            } catch {
                failed.append(pending)
            }
        }
        return failed
    }
}

#Preview {
    AddEventSheet(viewModel: CalendarViewModel(), defaultDate: Date())
        .tint(Theme.accent)
}
