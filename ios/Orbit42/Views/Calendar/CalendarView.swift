import SwiftUI

/// 캘린더 탭 — 상단 세그먼트로 "일정"(월 그리드 + 이벤트 목록)과
/// "타임슬롯"(`SlotsContent`, 내가 열어둔 슬롯 관리)을 오간다.
struct CalendarView: View {
    /// 상단 세그먼트 구분.
    private enum Mode: String, CaseIterable, Identifiable {
        case schedule
        case slots

        var id: String { rawValue }

        var title: String {
            switch self {
            case .schedule: return "일정"
            case .slots: return "타임슬롯"
            }
        }
    }

    @State private var viewModel = CalendarViewModel()
    @State private var showingAddSheet = false
    @State private var selectedEvent: CalendarEvent?
    @State private var completionErrorMessage: String?

    @Environment(TabRouter.self) private var router
    @State private var mode: Mode = CalendarView.initialMode
    /// 세그먼트 전환에도 슬롯 목록 캐시가 유지되도록 여기서 소유한다.
    @State private var slotsViewModel = SlotsViewModel()
    /// 슬롯 상세 push 용 path — `SlotsContent` 의 DEMO_SLOT_ID 자동 진입에도 쓰인다.
    @State private var path = NavigationPath()

    /// DEBUG 데모/스크린샷용: 구 DEMO_TAB=slots 는 이제 캘린더 탭의
    /// "타임슬롯" 세그먼트로 통합되었으므로 초기 세그먼트를 그쪽으로 연다.
    private static var initialMode: Mode {
        #if DEBUG
        if ProcessInfo.processInfo.environment["DEMO_TAB"] == "slots" {
            return .slots
        }
        #endif
        return .schedule
    }

    private var calendar: Calendar { CalendarViewModel.calendar }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    modePicker
                    switch mode {
                    case .schedule:
                        scheduleContent
                    case .slots:
                        SlotsContent(viewModel: slotsViewModel, path: $path)
                    }
                }
            }
            .navigationTitle("캘린더")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingAddSheet) {
                AddEventSheet(viewModel: viewModel, defaultDate: viewModel.selectedDate)
            }
            .sheet(item: $selectedEvent) { event in
                EventDetailSheet(viewModel: viewModel, event: event)
            }
            .task(id: viewModel.currentMonthKey) {
                await viewModel.loadDisplayedMonth()
            }
            .alert("완료 상태를 저장하지 못했어요", isPresented: showCompletionErrorAlert) {
                Button("확인", role: .cancel) { completionErrorMessage = nil }
            } message: {
                Text(completionErrorMessage ?? "")
            }
            // 자산 탭 추천 카드 등 다른 탭에서 요청한 세그먼트로 전환.
            .onChange(of: router.calendarModeRequest) { _, request in
                applyModeRequest(request)
            }
            // 알림에서 넘어온 일정 딥링크.
            .onChange(of: router.calendarEventRequest) { _, request in
                applyEventRequest(request)
            }
            .onAppear {
                applyModeRequest(router.calendarModeRequest)
                applyEventRequest(router.calendarEventRequest)
            }
        }
    }

    private func applyModeRequest(_ request: String?) {
        guard let request, let requested = Mode(rawValue: request) else { return }
        mode = requested
        router.calendarModeRequest = nil
    }

    /// 알림 딥링크 — 그 일정이 있는 날로 이동해 상세 시트를 연다.
    /// 해당 달을 새로 불러온 뒤 id 로 찾으며, 못 찾으면 날짜만 선택된 상태로 둔다.
    private func applyEventRequest(_ request: CalendarEventRequest?) {
        guard let request else { return }
        router.calendarEventRequest = nil
        mode = .schedule
        scheduleViewMode = .month
        viewModel.select(date: request.date)
        Task {
            await viewModel.loadDisplayedMonth(force: true)
            if let event = viewModel.currentMonthData?.events
                .first(where: { $0.id == request.eventId }) {
                selectedEvent = event
            }
        }
    }

    // MARK: - 세그먼트

    private var modePicker: some View {
        Picker("캘린더 보기", selection: $mode) {
            ForEach(Mode.allCases) { mode in
                Text(mode.title).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    // MARK: - 일정 콘텐츠

    /// "일정" 세그먼트 — 캘린더 전용 toolbar(오늘/+)는 이 브랜치에만 붙어서,
    /// "타임슬롯" 세그먼트에서는 `SlotsContent` 의 +(프리셋) toolbar 가 대신 보인다.
    /// 일정 세그먼트의 보기 단계 — 애플 캘린더식 드릴다운 (연 → 월 → 주).
    /// 좌상단 뒤로가기로 한 단계 올라가고, 연의 월 탭 / 월의 선택일 재탭으로 내려간다.
    private enum ScheduleViewMode {
        case year
        case month
        case week
    }

    @State private var scheduleViewMode: ScheduleViewMode = .month

    private var scheduleContent: some View {
        VStack(spacing: 0) {
            switch scheduleViewMode {
            case .year:
                yearView
            case .month:
                monthHeader
                weekdayHeader
                monthGrid
                Divider()
                    .overlay(Theme.fill(0.08))
                    .padding(.top, 8)
                swipeableEventList
            case .week:
                weekHeader
                weekStrip
                Divider()
                    .overlay(Theme.fill(0.08))
                    .padding(.top, 8)
                swipeableEventList
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("오늘") {
                    withAnimation { viewModel.showToday() }
                }
                .font(.subheadline.weight(.medium))
            }
            ToolbarItem(placement: .topBarTrailing) {
                calendarFilterMenu
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddSheet = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("일정 추가")
            }
        }
    }

    /// 표시할 캘린더 선택 — 체크 해제한 캘린더의 일정은 그리드·리스트에서 숨겨진다.
    private var calendarFilterMenu: some View {
        Menu {
            ForEach(viewModel.calendars) { calendarInfo in
                Button {
                    viewModel.toggleCalendarVisibility(calendarInfo.id)
                } label: {
                    if viewModel.isCalendarVisible(calendarInfo.id) {
                        Label(calendarInfo.name, systemImage: "checkmark")
                    } else {
                        Text(calendarInfo.name)
                    }
                }
            }
        } label: {
            Image(systemName: viewModel.hiddenCalendarIds.isEmpty
                ? "line.3.horizontal.decrease.circle"
                : "line.3.horizontal.decrease.circle.fill")
        }
        .accessibilityLabel("표시할 캘린더 선택")
    }

    // MARK: - 월 헤더

    private var monthHeader: some View {
        HStack(spacing: 4) {
            // 애플 캘린더식 뒤로가기 — 연간 보기로 올라간다.
            Button {
                withAnimation { scheduleViewMode = .year }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                        .font(.subheadline.weight(.semibold))
                    Text(String(displayedYear) + "년")
                        .font(.subheadline.weight(.medium))
                }
                .foregroundStyle(Theme.accent)
                .frame(height: 44)
            }
            .accessibilityLabel("연간 보기")

            Spacer()

            Text(Self.monthTitleFormatter.string(from: viewModel.displayedMonth))
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.primaryText)

            Spacer()

            Button {
                withAnimation { viewModel.showPreviousMonth() }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 44)
            }
            .accessibilityLabel("이전 달")
            Button {
                withAnimation { viewModel.showNextMonth() }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 44)
            }
            .accessibilityLabel("다음 달")
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
    }

    // MARK: - 주간 뷰

    /// 선택일이 속한 주의 시작(일요일).
    private var weekStart: Date {
        calendar.dateInterval(of: .weekOfYear, for: viewModel.selectedDate)?.start
            ?? calendar.startOfDay(for: viewModel.selectedDate)
    }

    private static let weekRangeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일"
        return formatter
    }()

    private var weekHeader: some View {
        HStack(spacing: 4) {
            // 뒤로가기 — 월간 보기로 올라간다.
            Button {
                withAnimation { scheduleViewMode = .month }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                        .font(.subheadline.weight(.semibold))
                    Text("\(calendar.component(.month, from: viewModel.selectedDate))월")
                        .font(.subheadline.weight(.medium))
                }
                .foregroundStyle(Theme.accent)
                .frame(height: 44)
            }
            .accessibilityLabel("월간 보기")

            Spacer()

            Text("\(Self.weekRangeFormatter.string(from: weekStart)) ~ \(Self.weekRangeFormatter.string(from: calendar.date(byAdding: .day, value: 6, to: weekStart) ?? weekStart))")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)

            Spacer()

            Button {
                withAnimation { shiftDays(-7) }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 44)
            }
            .accessibilityLabel("이전 주")
            Button {
                withAnimation { shiftDays(7) }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 44)
            }
            .accessibilityLabel("다음 주")
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
    }

    private var weekStrip: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { offset in
                let date = calendar.date(byAdding: .day, value: offset, to: weekStart) ?? weekStart
                weekDayCell(date)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
    }

    private func weekDayCell(_ date: Date) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: viewModel.selectedDate)
        let isToday = calendar.isDateInToday(date)
        let dots = viewModel.dotColors(on: date)

        return Button {
            withAnimation { viewModel.select(date: date) }
        } label: {
            VStack(spacing: 4) {
                Text(WeekStart.absoluteSymbols[calendar.component(.weekday, from: date) - 1])
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                Text("\(calendar.component(.day, from: date))")
                    .font(.subheadline.weight(isToday ? .bold : .medium))
                    .foregroundStyle(isSelected ? Theme.primaryText : (isToday ? Theme.accent : Theme.primaryText.opacity(0.85)))
                HStack(spacing: 3) {
                    ForEach(Array(dots.prefix(3).enumerated()), id: \.offset) { _, color in
                        Circle().fill(color).frame(width: 4, height: 4)
                    }
                    if dots.isEmpty {
                        Circle().fill(.clear).frame(width: 4, height: 4)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                isSelected ? Theme.accent.opacity(0.3) : .clear,
                in: RoundedRectangle(cornerRadius: 10)
            )
        }
        .buttonStyle(.plain)
    }

    private func shiftDays(_ delta: Int) {
        if let next = calendar.date(byAdding: .day, value: delta, to: viewModel.selectedDate) {
            viewModel.select(date: next)
        }
    }

    // MARK: - 연간 뷰

    private var displayedYear: Int {
        calendar.component(.year, from: viewModel.displayedMonth)
    }

    private var yearView: some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    withAnimation { shiftYear(-1) }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("이전 해")
                Spacer()
                Text("\(String(displayedYear))년")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                Spacer()
                Button {
                    withAnimation { shiftYear(1) }
                } label: {
                    Image(systemName: "chevron.right")
                        .font(.body.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("다음 해")
            }
            .padding(.horizontal, 8)
            .padding(.top, 4)

            ScrollView {
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3),
                    spacing: 16
                ) {
                    ForEach(1...12, id: \.self) { month in
                        miniMonth(month)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            }
        }
    }

    private func shiftYear(_ delta: Int) {
        var comps = calendar.dateComponents([.year, .month], from: viewModel.displayedMonth)
        comps.year = (comps.year ?? displayedYear) + delta
        comps.day = 1
        if let date = calendar.date(from: comps) {
            viewModel.select(date: date)
        }
    }

    private func miniMonth(_ month: Int) -> some View {
        let firstDay = calendar.date(
            from: DateComponents(year: displayedYear, month: month, day: 1)
        ) ?? Date()
        let dayCount = calendar.range(of: .day, in: .month, for: firstDay)?.count ?? 30
        let leading = calendar.leadingBlankDays(forMonthContaining: firstDay)
        let isCurrentMonth = calendar.isDate(firstDay, equalTo: Date(), toGranularity: .month)

        return Button {
            viewModel.select(date: firstDay)
            withAnimation { scheduleViewMode = .month }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(month)월")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(isCurrentMonth ? Theme.accent : Theme.primaryText)
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: 1), count: 7),
                    spacing: 2
                ) {
                    ForEach(0..<leading, id: \.self) { _ in
                        Text(" ").font(.system(size: 8))
                    }
                    ForEach(1...dayCount, id: \.self) { day in
                        let isToday = isCurrentMonth
                            && calendar.component(.day, from: Date()) == day
                        Text("\(day)")
                            .font(.system(size: 8, weight: isToday ? .bold : .regular))
                            .foregroundStyle(isToday ? Theme.accent : Theme.secondaryText)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(8)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 요일 헤더 (시작 요일은 설정을 따름)

    private var weekdayHeader: some View {
        let settings = AppSettings.shared
        return HStack(spacing: 0) {
            ForEach(Array(settings.weekdaySymbols.enumerated()), id: \.offset) { index, symbol in
                Text(symbol)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(weekdayColor(weekday: settings.weekdayIndex(atColumn: index)))
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    /// weekday: 0=일 … 6=토
    private func weekdayColor(weekday: Int) -> Color {
        switch weekday {
        case 0: return Color(red: 0.94, green: 0.45, blue: 0.45)   // 일
        case 6: return Color(red: 0.45, green: 0.62, blue: 0.94)   // 토
        default: return Theme.secondaryText
        }
    }

    // MARK: - 월 그리드

    private var monthGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 4) {
            ForEach(Array(monthDays.enumerated()), id: \.offset) { _, day in
                if let day {
                    DayCell(
                        date: day,
                        isSelected: calendar.isDate(day, inSameDayAs: viewModel.selectedDate),
                        isToday: calendar.isDateInToday(day),
                        dotColors: viewModel.dotColors(on: day)
                    ) {
                        // 애플 캘린더식 드릴다운: 이미 선택된 날을 다시 탭하면 주 보기로.
                        if calendar.isDate(day, inSameDayAs: viewModel.selectedDate) {
                            withAnimation { scheduleViewMode = .week }
                        } else {
                            viewModel.selectedDate = day
                        }
                    }
                } else {
                    Color.clear.frame(height: 46)
                }
            }
        }
        .padding(.horizontal, 12)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 25)
                .onEnded { value in
                    guard abs(value.translation.width) > abs(value.translation.height) else { return }
                    withAnimation {
                        if value.translation.width < -40 {
                            viewModel.showNextMonth()
                        } else if value.translation.width > 40 {
                            viewModel.showPreviousMonth()
                        }
                    }
                }
        )
    }

    /// 표시 중인 달의 셀 배열 — 앞뒤를 nil 로 패딩해 7의 배수를 맞춘다.
    private var monthDays: [Date?] {
        let first = CalendarViewModel.firstDayOfMonth(containing: viewModel.displayedMonth)
        guard let range = calendar.range(of: .day, in: .month, for: first) else { return [] }
        let leading = calendar.leadingBlankDays(forMonthContaining: first)
        var days: [Date?] = Array(repeating: nil, count: leading)
        for offset in 0..<range.count {
            days.append(calendar.date(byAdding: .day, value: offset, to: first))
        }
        while days.count % 7 != 0 { days.append(nil) }
        return days
    }

    // MARK: - 이벤트 목록

    /// 일정 목록 영역 — 좌우로 스와이프하면 어제/내일로 이동한다.
    /// 세로 스크롤·당겨서 새로고침을 막지 않도록 simultaneousGesture 로 얹고,
    /// 가로 이동이 세로보다 확실히 클 때만 날짜를 바꾼다.
    private var swipeableEventList: some View {
        eventListSection
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
            .simultaneousGesture(
                DragGesture(minimumDistance: 24)
                    .onEnded { value in
                        let horizontal = value.translation.width
                        guard abs(horizontal) > 48,
                              abs(horizontal) > abs(value.translation.height) * 1.5
                        else { return }
                        withAnimation(.easeInOut(duration: 0.2)) {
                            shiftDays(horizontal < 0 ? 1 : -1)
                        }
                    }
            )
    }

    @ViewBuilder
    private var eventListSection: some View {
        if viewModel.currentMonthData == nil {
            if viewModel.isLoading {
                VStack {
                    Spacer()
                    ProgressView()
                        .tint(Theme.accent)
                    Text("일정을 불러오는 중이에요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .padding(.top, 12)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else if let message = viewModel.errorMessage {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 32, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text(message)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.secondaryText)
                    Button {
                        Task { await viewModel.loadDisplayedMonth(force: true) }
                    } label: {
                        Text("다시 시도")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .background(Theme.surface, in: Capsule())
                    }
                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 32)
            } else {
                Spacer()
            }
        } else {
            eventList
        }
    }

    private var eventList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(Self.selectedDayFormatter.string(from: viewModel.selectedDate))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.primaryText)
                    if viewModel.isLoading {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Theme.secondaryText)
                    }
                    Spacer()
                }
                .padding(.top, 14)

                let events = viewModel.events(on: viewModel.selectedDate)
                if events.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "moon.zzz")
                            .font(.system(size: 28, weight: .light))
                            .foregroundStyle(Theme.secondaryText)
                        Text("일정이 없어요")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    ForEach(events) { event in
                        EventRow(
                            event: event,
                            calendars: viewModel.calendars,
                            onToggleCompletion: { toggleCompletion(event) },
                            onOpen: { selectedEvent = event }
                        )
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .refreshable {
            await viewModel.loadDisplayedMonth(force: true)
        }
    }

    // MARK: - 완료 체크

    private var showCompletionErrorAlert: Binding<Bool> {
        Binding(
            get: { completionErrorMessage != nil },
            set: { if !$0 { completionErrorMessage = nil } }
        )
    }

    /// 행의 체크 버튼 탭 — 뷰모델이 낙관적으로 반영/원복하므로 여기선 실패 alert 만 담당.
    private func toggleCompletion(_ event: CalendarEvent) {
        Task {
            do {
                try await viewModel.toggleCompletion(event)
            } catch let apiError as APIError {
                completionErrorMessage = apiError.errorDescription
            } catch {
                completionErrorMessage = "완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 포매터

    /// "2026년 7월"
    private static let monthTitleFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        return formatter
    }()

    /// "7월 26일 (일)"
    private static let selectedDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E)"
        return formatter
    }()

}

// MARK: - 날짜 셀

private struct DayCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let dotColors: [Color]
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 3) {
                Text("\(CalendarViewModel.calendar.component(.day, from: date))")
                    .font(.callout.weight(isToday || isSelected ? .semibold : .regular))
                    .foregroundStyle(numberColor)
                    .frame(width: 32, height: 32)
                    .background {
                        if isSelected {
                            Circle().fill(Theme.accent)
                        } else if isToday {
                            Circle().strokeBorder(Theme.accent, lineWidth: 1.5)
                        }
                    }

                HStack(spacing: 3) {
                    ForEach(Array(dotColors.enumerated()), id: \.offset) { _, color in
                        Circle()
                            .fill(color)
                            .frame(width: 4.5, height: 4.5)
                    }
                }
                .frame(height: 5)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 46)
        }
        .buttonStyle(.plain)
    }

    private var numberColor: Color {
        if isSelected { return .white }
        if isToday { return Theme.accent }
        return Theme.primaryText.opacity(0.9)
    }
}

// MARK: - 이벤트 행

/// 일별 이벤트 목록의 한 행 — 완료 체크 버튼과 상세 열기(나머지 영역)를
/// 형제 버튼으로 분리해 히트영역이 겹치지 않게 한다. (버튼 중첩은 탭이 안 먹는다)
private struct EventRow: View {
    let event: CalendarEvent
    let calendars: [CalendarInfo]
    let onToggleCompletion: () -> Void
    let onOpen: () -> Void

    /// 완료 체크 초록 — 웹과 동일한 #22c55e
    private static let completedGreen = Color(hexString: "#22c55e") ?? .green

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2)
                .fill(event.displayColor(in: calendars))
                .frame(width: 4)
                .frame(maxHeight: .infinity)

            Button(action: onToggleCompletion) {
                Image(systemName: event.completed ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(event.completed ? Self.completedGreen : Theme.secondaryText)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(event.completed ? "완료 해제" : "완료로 표시")

            Button(action: onOpen) {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(event.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.primaryText)
                                .strikethrough(event.completed)
                                .lineLimit(2)
                            if event.isGoogle {
                                Text("Google")
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(Theme.secondaryText)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Theme.fill(0.08), in: Capsule())
                            }
                            if event.isInvite {
                                Text(event.inviteStatus == "accepted" ? "참여" : "초대")
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(Theme.accent)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Theme.accent.opacity(0.15), in: Capsule())
                            }
                        }
                        HStack(spacing: 6) {
                            Text(timeText)
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                            // 모든 일정 = 시간 = 금액 — 수동 기록은 강조, 자동 환산은 은은하게
                            if let earningText {
                                Text(earningText)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.accent)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Theme.accent.opacity(0.15), in: Capsule())
                            } else if let autoValueText {
                                Text(autoValueText)
                                    .font(.caption2)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                        if let description = event.description, !description.isEmpty {
                            Text(description)
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .opacity(rowOpacity)
        .fixedSize(horizontal: false, vertical: true)
        .animation(.easeInOut(duration: 0.15), value: event.completed)
    }

    private var rowOpacity: Double {
        if event.completed { return 0.55 }
        return event.tentative ? 0.65 : 1
    }

    private static let wonFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter
    }()

    private static func won(_ amount: Int) -> String {
        "₩\(wonFormatter.string(from: NSNumber(value: amount)) ?? "\(amount)")"
    }

    /// 수동 수익 기록 배지 — "₩50,000"
    private var earningText: String? {
        event.earningKrw.map(Self.won)
    }

    /// 자동 환산(시급×시간) — 수동 기록이 없을 때만
    private var autoValueText: String? {
        event.autoValueKrw.map(Self.won)
    }

    private var timeText: String {
        if event.allDay { return "종일" }
        let start = Self.timeFormatter.string(from: event.startAt)
        let end = Self.timeFormatter.string(from: event.endAt)
        return "\(start) – \(end)"
    }

    /// "오전 9:00"
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "a h:mm"
        return formatter
    }()
}

#Preview {
    CalendarView()
        .tint(Theme.accent)
}
