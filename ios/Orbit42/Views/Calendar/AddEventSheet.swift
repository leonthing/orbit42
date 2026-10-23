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
    @FocusState private var titleFocused: Bool
    /// 위치·참석자·메모는 "더 보기" 뒤로 접는다. 미리 채워진 값이 있으면 펼친 채로 연다.
    @State private var showMore = false

    /// - initialTitle / initialParticipants: 관계 궤도의 "일정 잡기"처럼 상대가 정해진 채로 열 때.
    init(
        viewModel: CalendarViewModel,
        defaultDate: Date,
        defaultStart: Date? = nil,
        initialTitle: String = "",
        initialParticipants: [PendingParticipant] = []
    ) {
        self.viewModel = viewModel
        _title = State(initialValue: initialTitle)
        _pendingParticipants = State(initialValue: initialParticipants)
        _showMore = State(initialValue: !initialParticipants.isEmpty)

        // 선택된 날짜 + 다음 정시로 시작 시각 제안
        let calendar = CalendarViewModel.calendar
        let now = Date()
        let hour = calendar.component(.hour, from: now)
        let suggestedHour = min(hour + 1, 23)
        // 하루 보기에서 빈 시간을 누르면 그 시각(defaultStart)으로 연다.
        let startDate = defaultStart ?? calendar.date(
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
    /// 중요도 (1.5.0 A) — 일정이 만들어진 뒤 주석으로 저장한다
    @State private var importance: EventImportance = .normal
    /// 반복(1.5.1) — 안 함이면 한 번짜리
    @State private var repeatRule = RepeatRule()
    /// 구글 캘린더에 저장하면서 참석자를 넣을 때 — 구글 초대 메일 확인
    @State private var confirmingGoogleInvite = false

    /// 고른 캘린더가 구글 연동이면 참석자는 구글 일정 참석자로 들어가고 구글이 메일을 보낸다.
    private var savesToGoogle: Bool {
        guard let id = selectedCalendarId else { return false }
        return writableCalendars.first(where: { $0.id == id }).map { !$0.isNative } ?? false
    }

    /// 일정을 넣을 수 있는 캘린더 — 보기 전용으로 공유받은 것과 보관한 것은 뺀다
    private var writableCalendars: [CalendarInfo] {
        (freshCalendars ?? viewModel.calendars).filter { $0.canEdit && !$0.isArchived }
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
                        .focused($titleFocused)
                        .submitLabel(.done)
                }
                .listRowBackground(Theme.surface)

                // 캘린더 — 버튼으로 모두 펼쳐 둔다. 제목 바로 아래라 키보드가 올라와도 보인다.
                if !writableCalendars.isEmpty {
                    Section {
                        CalendarChips(calendars: writableCalendars, selection: $selectedCalendarId)
                    } header: {
                        Text("캘린더")
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    ImportancePicker(selection: $importance)
                } header: {
                    Text("중요도")
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

                RepeatSection(rule: $repeatRule, start: start)

                if showMore {
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
                } else {
                    Section {
                        Button {
                            withAnimation { showMore = true }
                        } label: {
                            Label("위치 · 참석자 · 메모", systemImage: "plus.circle")
                                .font(.subheadline)
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    .listRowBackground(Theme.surface)
                }

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
                        Button("저장") {
                            if savesToGoogle, !pendingParticipants.isEmpty {
                                confirmingGoogleInvite = true
                            } else {
                                save()
                            }
                        }
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
            .onAppear {
                // 이미 제목이 정해진 채로 열렸으면(오르빗 "일정 잡기") 키보드를 띄우지 않는다.
                if title.isEmpty {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { titleFocused = true }
                }
            }
            .sheet(isPresented: $showingAddParticipant) {
                ParticipantAddSheet(mode: .collect($pendingParticipants))
            }
            .alert("참석자 \(pendingParticipants.count)명을 초대할까요?", isPresented: $confirmingGoogleInvite) {
                Button("취소", role: .cancel) {}
                Button("저장하고 초대") { save() }
            } message: {
                Text("구글 캘린더 초대 메일이 함께 보내져요.")
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
                    VisibleRemoveButton(accessibilityLabel: "\(pending.label) 빼기") {
                        pendingParticipants.removeAll { $0.id == pending.id }
                    }
                    .disabled(isSaving)
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
                    : savesToGoogle
                        ? "일정을 저장하면 \(pendingParticipants.count)명에게 구글 캘린더 초대 메일이 가요."
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
                        travelMin: travelMin,
                        repeatRule: repeatRule
                    )
                    createdEvent = event
                    // 중요도는 일정과 따로 저장 — 실패해도 일정은 살아 있으니 저장 흐름을 막지 않는다
                    if importance != .normal {
                        try? await viewModel.setImportance(event, importance)
                    }
                    // 일정 알림 권한은 첫 실행이 아니라 처음 일정을 만들 때 묻는다(이미 정했으면 묻지 않음)
                    if AppSettings.shared.notifyOrbitEvents || AppSettings.shared.notifyGoogleEvents {
                        await EventReminders.shared.requestAuthorizationIfNeeded()
                    }
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
        // 장소·메모까지 담긴 스냅샷 — 초대 메일에 함께 나간다.
        let snapshot = ParticipantEventSnapshot(event: event)
        if event.isGoogle {
            // 구글 일정은 한 번에 넣는다 — 한 명씩 넣으면 앞서 넣은 사람에게 '변경' 메일이 거듭 간다.
            var request = snapshot.request(username: nil, email: nil)
            request.googleInvite = true
            request.invitees = pendingParticipants.map {
                AddParticipantRequest.Invitee(username: $0.username, email: $0.email)
            }
            do {
                let _: ParticipantsResponse = try await APIClient.shared.post(
                    "/api/v1/calendar/events/\(event.id)/participants",
                    body: request
                )
                return []
            } catch {
                return pendingParticipants
            }
        }
        var failed: [PendingParticipant] = []
        for pending in pendingParticipants {
            do {
                let _: ParticipantsResponse = try await APIClient.shared.post(
                    "/api/v1/calendar/events/\(event.id)/participants",
                    body: snapshot.request(
                        username: pending.username,
                        email: pending.email
                    )
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
