import SwiftUI
import UserNotifications

/// 프로필 탭 > 내 캘린더 — 캘린더 목록/편집/생성/삭제.
struct CalendarSettingsView: View {
    @State private var viewModel = CalendarSettingsViewModel()
    private var settings = AppSettings.shared
    @State private var editingCalendar: CalendarInfo?
    @State private var showingCreate = false
    @State private var deleteTarget: CalendarInfo?

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("내 캘린더")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("캘린더 추가")
            }
        }
        .sheet(item: $editingCalendar) { calendar in
            CalendarEditorSheet(mode: .edit(calendar), viewModel: viewModel)
        }
        .sheet(isPresented: $showingCreate) {
            CalendarEditorSheet(mode: .create, viewModel: viewModel)
        }
        // 캘린더를 지우면 안의 일정도 함께 지워진다 — 밀기로도 한 번 더 묻는다 (개선-26)
        .confirmationDialog(
            "'\(deleteTarget?.name ?? "")' 캘린더를 삭제할까요?",
            isPresented: Binding(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } }),
            titleVisibility: .visible,
            presenting: deleteTarget
        ) { calendar in
            Button("삭제", role: .destructive) {
                Task { await viewModel.delete(calendar) }
            }
            Button("돌아가기", role: .cancel) {}
        } message: { _ in
            Text(CalendarEditorSheet.deleteNotice)
        }
        .alert(
            "안내",
            isPresented: Binding(
                get: { viewModel.actionMessage != nil },
                set: { if !$0 { viewModel.actionMessage = nil } }
            )
        ) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(viewModel.actionMessage ?? "")
        }
        .task { await viewModel.load() }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let calendars = viewModel.calendars {
            calendarList(calendars)
        } else if viewModel.isLoading {
            loadingState
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else {
            Color.clear
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.accent)
            Text("캘린더를 불러오는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
            Button {
                Task { await viewModel.load(force: true) }
            } label: {
                Text("다시 시도")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
    }

    // MARK: - 보기 설정 (캘린더 목록 아래)

    /// 기기별 표시 설정 — 캘린더 탭·예약 화면의 월 격자가 모두 이 값을 따른다.
    private var displaySection: some View {
        Section {
            NavigationLink {
                WeekStartPickerView()
            } label: {
                HStack {
                    Text("시작 요일")
                        .foregroundStyle(Theme.primaryText)
                    Spacer(minLength: 0)
                    Text(settings.weekStartDisplayName)
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            Picker(
                "기본 일정 시간",
                selection: Binding(
                    get: { settings.eventDuration },
                    set: { settings.setEventDuration($0) }
                )
            ) {
                ForEach(EventDuration.allCases) { option in
                    Text(option.label).tag(option)
                }
            }
            Toggle(
                "보관한 일정 보기",
                isOn: Binding(
                    get: { settings.showArchived },
                    set: { settings.setShowArchived($0) }
                )
            )
            .tint(Theme.accent)
        } header: {
            Text("보기 설정")
                .foregroundStyle(Theme.secondaryText)
        } footer: {
            Text("새 일정을 만들 때 종료 시각이 이만큼 뒤로 잡혀요. 보관한 일정은 켜 두면 흐리게, 끄면 보이지 않아요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - 목록

    private func calendarList(_ calendars: [CalendarInfo]) -> some View {
        List {
            Section {
                ForEach(calendars) { calendar in
                    Button {
                        editingCalendar = calendar
                    } label: {
                        CalendarSettingsRow(calendar: calendar)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        // 기본 캘린더는 스와이프 삭제 자체를 막는다
                        if !calendar.isDefault, !calendar.isSharedWithMe {
                            Button(role: .destructive) {
                                deleteTarget = calendar
                            } label: {
                                Label("삭제", systemImage: "trash")
                            }
                        }
                    }
                }
            } footer: {
                Text("행을 누르면 이름·용도·색·공개 범위와 함께 쓰기(공유)를 설정하거나 캘린더를 삭제할 수 있어요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)

            displaySection

            ReminderSettingsSection()
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }
}

// MARK: - 캘린더 행

private struct CalendarSettingsRow: View {
    let calendar: CalendarInfo

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(calendar.displayColor)
                .frame(width: 12, height: 12)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(calendar.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    if calendar.source == "google" {
                        SettingBadge(text: "Google", color: Theme.secondaryText)
                    }
                    if calendar.isDefault {
                        SettingBadge(text: "기본", color: Theme.accent)
                    }
                }
                Text(visibilityLabel)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText.opacity(0.6))
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    private var visibilityLabel: String {
        CalendarVisibility(rawValue: calendar.visibility ?? "")?.label ?? "비공개"
    }
}

// MARK: - 뱃지

private struct SettingBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.fill(0.08), in: Capsule())
    }
}

#Preview {
    NavigationStack {
        CalendarSettingsView()
    }
    .tint(Theme.accent)
}


/// 일정 알림 설정 (1.5.0 A 2차) — 기기 로컬 알림. 권한은 여기서 처음 켤 때 묻는다.
struct ReminderSettingsSection: View {
    @State private var status: UNAuthorizationStatus = .notDetermined
    @State private var reminderCount: Int?
    private var settings: AppSettings { AppSettings.shared }

    var body: some View {
        Section {
            if status == .denied {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                } label: {
                    HStack {
                        Label("알림이 꺼져 있어요", systemImage: "bell.slash")
                            .foregroundStyle(Theme.primaryText)
                        Spacer()
                        Text("설정 열기").foregroundStyle(Theme.accent)
                    }
                }
            }
            Toggle("Orbit42 일정 알림", isOn: Binding(
                get: { settings.notifyOrbitEvents },
                set: { on in settings.setNotifyOrbitEvents(on); changed(turnedOn: on) }
            ))
            .tint(Theme.accent)
            Toggle("구글 일정도 알림", isOn: Binding(
                get: { settings.notifyGoogleEvents },
                set: { on in settings.setNotifyGoogleEvents(on); changed(turnedOn: on) }
            ))
            .tint(Theme.accent)
            NavigationLink {
                RemindersListView()
            } label: {
                HStack {
                    Text("다시 알림").foregroundStyle(Theme.primaryText)
                    Spacer()
                    Text(reminderCount.map { "\($0)개" } ?? "")
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            Picker("기본 알림 시점", selection: Binding(
                get: { settings.defaultReminder },
                set: { settings.setDefaultReminder($0); EventReminders.shared.refreshSoon() }
            )) {
                ForEach(ReminderOption.allCases) { Text($0.label).tag($0) }
            }
            Toggle("아침 일정 요약", isOn: Binding(
                get: { settings.morningSummary },
                set: { on in settings.setMorningSummary(on); changed(turnedOn: on) }
            ))
            .tint(Theme.accent)
            .accessibilityIdentifier("morningSummaryToggle")
            if settings.morningSummary {
                DatePicker("요약 받을 시각", selection: Binding(
                    get: {
                        Calendar.current.date(byAdding: .minute, value: settings.morningSummaryMinutes,
                                              to: Calendar.current.startOfDay(for: Date())) ?? Date()
                    },
                    set: { date in
                        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
                        settings.setMorningSummaryMinutes((c.hour ?? 8) * 60 + (c.minute ?? 0))
                        EventReminders.shared.refreshSoon()
                    }
                ), displayedComponents: .hourAndMinute)
            }
        } header: {
            Text("알림").foregroundStyle(Theme.secondaryText)
        } footer: {
            Text("'중요함' 일정은 30분 전과 10분 전에, 일정마다 고른 알림은 그 시점에 늘 울려요(구글 일정도). 위 두 스위치는 그 밖의 일정을 기본 알림 시점에 울릴지 정해요 — 구글 일정은 구글 캘린더 앱에서도 울릴 수 있어 기본으로 꺼 두었어요. 종일·완료·보관한 일정은 알리지 않아요. 아침 일정 요약은 일정이 있는 날만 고른 시각에 오늘 일정을 한 번 알려 드려요. 앱을 14일 넘게 열지 않으면 알림이 끊길 수 있어요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
        .task {
            status = await EventReminders.shared.authorizationStatus()
            reminderCount = await EventReminders.shared.fetchReminders()?.count
        }
    }

    private func changed(turnedOn: Bool) {
        Task {
            if turnedOn { await EventReminders.shared.requestAuthorizationIfNeeded() }
            status = await EventReminders.shared.authorizationStatus()
            await EventReminders.shared.refresh()
        }
    }
}
