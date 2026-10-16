import SwiftUI

/// 캘린더 탭 — 일정(연·월·주 드릴다운 + 이벤트 목록).
/// 예약 링크(슬롯 관리)는 예약 탭의 "예약 링크" 구역에 있다.
struct CalendarView: View {
    @State private var viewModel = CalendarViewModel()
    /// 새 일정 화면 — 시작 시각을 요청에 실어 보내야 꾹 누르기 경로에서도 누른 자리 시각이 들어간다
    @State private var addRequest: AddRequest?

    private struct AddRequest: Identifiable {
        let id = UUID()
        /// nil 이면 새 일정 화면 기본 시작(다음 정시)
        let start: Date?
    }
    /// 마지막으로 고른 보기 — "day" 면 하루 보기로 연다.
    @AppStorage("calendarScheduleMode") private var storedScheduleMode = "month"
    @State private var selectedEvent: CalendarEvent?
    @State private var completionErrorMessage: String?
    /// 하루 보기에서 블록을 끄는 중 — 가로 페이저 넘김을 막는다
    @State private var isDraggingEvent = false
    /// 다른 날로 끄는 중 손가락 자리에 그릴 유령 블록 (1.5.1)
    @State private var crossDrag: DayTimelineView.CrossDayDrag?
    /// 일정을 끌어 다른 날로 넘어간 동안 보여 줄 날 — 페이지는 넘기지 않고 날짜 표시만 (버그-4)
    @State private var dragPreviewDay: Date?
    /// 하루 보기 머리·주간 띠가 가리키는 날
    private var shownDay: Date { dragPreviewDay ?? viewModel.selectedDate }
    /// 위쪽 주간 날짜 칸의 전역 좌표 — 여기에 놓으면 그날 같은 시각
    @State private var stripFrames: [Date: CGRect] = [:]
    /// 날짜별 하루 보기 스크롤 위치 — 화면을 다시 그리지 않도록 참조로 둔다
    @State private var dayScrollRegistry = DayScrollRegistry()
    /// 다른 날로 옮긴 뒤 아래에 잠깐 뜨는 안내 ("10월 23일 (금)로 옮겼어요 · 보기")
    /// 끌어 옮긴 뒤 아래 안내 — 다른 날로 옮겼으면 그 날(보기), 반복 회차면 '이 회차만'
    @State private var movedToast: MovedToast?
    @State private var movedToastTask: Task<Void, Never>?

    final class DayScrollRegistry {
        var y: [Date: CGFloat] = [:]
    }
    /// 참석자가 있는 구글 일정을 옮기기 전 확인 (구글이 참석자에게 변경 메일을 보낸다)
    @State private var pendingMove: PendingMove?
    @State private var moveErrorMessage: String?

    private struct PendingMove: Identifiable {
        let event: CalendarEvent
        let newStart: Date
        let newEnd: Date
        var id: String { event.id }
    }

    @Environment(TabRouter.self) private var router
    @Environment(\.scenePhase) private var scenePhase

    private var calendar: Calendar { CalendarViewModel.calendar }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                // 캘린더 탭은 일정만 — 예약 링크는 예약 탭으로 옮겼다.
                scheduleContent
                crossDragGhost
                movedToastView
            }
            .navigationTitle("캘린더")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $addRequest) { request in
                AddEventSheet(viewModel: viewModel, defaultDate: viewModel.selectedDate, defaultStart: request.start)
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
            .alert(
                pendingMove.map { calendar.isDate($0.newStart, inSameDayAs: $0.event.startAt) } == false ? "일정을 옮길까요?" : "시간을 바꿀까요?",
                isPresented: Binding(
                    get: { pendingMove != nil },
                    set: { if !$0 { pendingMove = nil } }
                ),
                presenting: pendingMove
            ) { move in
                Button("취소", role: .cancel) {}
                Button("바꾸기") { performMove(move, notifyAttendees: true) }
            } message: { move in
                Text("\(DayTimelineView.dateTimeLabel(move.newStart, move.newEnd))로 바꿔요. 참석자에게 구글 캘린더 변경 알림이 갑니다.")
            }
            .alert("시간을 바꾸지 못했어요", isPresented: Binding(
                get: { moveErrorMessage != nil },
                set: { if !$0 { moveErrorMessage = nil } }
            )) {
                Button("확인", role: .cancel) { moveErrorMessage = nil }
            } message: {
                Text(moveErrorMessage ?? "")
            }
            // 알림에서 넘어온 일정 딥링크.
            .onChange(of: router.calendarEventRequest) { _, request in
                applyEventRequest(request)
            }
            .onAppear {
                if storedScheduleMode == "day" && scheduleViewMode == .month { scheduleViewMode = .day }
                applyEventRequest(router.calendarEventRequest)
                applyDateRequest(router.calendarDateRequest)
            }
            // 홈 화면 위젯에서 누른 날짜.
            // 날이 바뀌었거나 오래 떠나 있다 돌아오면 오늘로 (위젯·알림 링크는 아래에서 그 날짜로 다시 맞춘다)
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .active: viewModel.didBecomeActive()
                case .background: viewModel.markInactive()
                default: break
                }
            }
            .onChange(of: router.calendarDateRequest) { _, date in
                applyDateRequest(date)
            }
        }
    }

    /// 위젯 딥링크 — 그 날짜의 하루 보기로 연다.
    private func applyDateRequest(_ date: Date?) {
        guard let date else { return }
        router.calendarDateRequest = nil
        selectedEvent = nil
        scheduleViewMode = .day
        viewModel.selectFromLink(date: date)
    }

    /// 알림 딥링크 — 그 일정이 있는 날로 이동해 상세 시트를 연다.
    /// 해당 달을 새로 불러온 뒤 id 로 찾으며, 못 찾으면 날짜만 선택된 상태로 둔다.
    private func applyEventRequest(_ request: CalendarEventRequest?) {
        guard let request else { return }
        router.calendarEventRequest = nil
        scheduleViewMode = .month
        viewModel.selectFromLink(date: request.date)
        Task {
            await viewModel.loadDisplayedMonth(force: true)
            if let event = viewModel.currentMonthData?.events
                .first(where: { $0.id == request.eventId }) {
                selectedEvent = event
            }
        }
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
        /// 하루 보기(시간축) — 툴바의 보기 전환으로 월 보기와 오간다.
        case day
    }

    @State private var scheduleViewMode: ScheduleViewMode = .month {
        didSet {
            // 월↔일 전환만 기억한다(연·주는 월에서 드릴다운하는 중간 단계).
            if scheduleViewMode == .day { storedScheduleMode = "day" }
            else if scheduleViewMode == .month { storedScheduleMode = "month" }
        }
    }

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
            case .day:
                dayHeader
                swipeableWeekStrip
                Divider()
                    .overlay(Theme.fill(0.08))
                    .padding(.top, 8)
                dayTimeline
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
            // 보기 전환 — 월 ↔ 일(시간축)
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    withAnimation { scheduleViewMode = scheduleViewMode == .day ? .month : .day }
                } label: {
                    Image(systemName: scheduleViewMode == .day ? "calendar" : "calendar.day.timeline.left")
                }
                .accessibilityLabel(scheduleViewMode == .day ? "월 보기" : "하루 보기")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    addRequest = AddRequest(start: nil)
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
                    .background(
                        GeometryReader { g in
                            Color.clear.preference(key: StripFramesKey.self, value: [calendar.startOfDay(for: date): g.frame(in: .global)])
                        }
                    )
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .onPreferenceChange(StripFramesKey.self) { stripFrames = $0 }
    }

    private static let toastDayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E)"
        return f
    }()

    private struct MovedToast: Equatable {
        let text: String
        /// 있으면 '보기'로 그 날로
        let date: Date?
    }

    private func showMovedToast(to date: Date?, occurrenceOnly: Bool = false) {
        var text = occurrenceOnly ? "이 회차만 옮겼어요" : ""
        if let date {
            let day = "\(Self.toastDayFormatter.string(from: date))로 옮겼어요"
            text = occurrenceOnly ? "이 회차만 \(day)" : day
        }
        movedToastTask?.cancel()
        withAnimation(.easeOut(duration: 0.2)) { movedToast = MovedToast(text: text, date: date) }
        movedToastTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.2)) { movedToast = nil }
        }
    }

    @ViewBuilder
    private var movedToastView: some View {
        if let toast = movedToast {
            VStack {
                Spacer()
                HStack(spacing: 12) {
                    Text(toast.text)
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    if let date = toast.date {
                        Button("보기") {
                            movedToastTask?.cancel()
                            withAnimation { movedToast = nil }
                            viewModel.select(date: date)
                        }
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(hexString: "#a5b4fc") ?? .white)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 11)
                .background(Color.black.opacity(0.82), in: Capsule())
                .padding(.bottom, 96)
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    /// 다른 날로 끄는 동안 손가락을 따라가는 블록 + 날짜·시각. 주간 날짜 칸 위면 그 칸을 강조한다.
    @ViewBuilder
    private var crossDragGhost: some View {
        GeometryReader { geo in
            if let drag = crossDrag {
                let origin = geo.frame(in: .global).origin
                if let strip = drag.stripDay, let frame = stripFrames[strip] {
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(drag.color, lineWidth: 2.5)
                        .frame(width: frame.width - 4, height: frame.height)
                        .position(x: frame.midX - origin.x, y: frame.midY - origin.y)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(drag.title).font(.caption.weight(.semibold)).lineLimit(1)
                    Text(drag.label).font(.caption2.weight(.semibold).monospacedDigit()).lineLimit(1)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .frame(width: drag.size.width, height: max(drag.size.height, 40), alignment: .topLeading)
                .background(drag.color, in: RoundedRectangle(cornerRadius: 6))
                .shadow(color: .black.opacity(0.25), radius: 8, y: 3)
                .position(x: drag.globalCenter.x - origin.x, y: drag.globalCenter.y - origin.y)
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }

    private func weekDayCell(_ date: Date) -> some View {
        let isSelected = calendar.isDate(date, inSameDayAs: shownDay)
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

    // MARK: - 하루 보기

    private static let dayTitleFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E)"
        return formatter
    }()

    private var dayHeader: some View {
        HStack(spacing: 4) {
            Button {
                withAnimation { scheduleViewMode = .month }
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "chevron.left")
                        .font(.subheadline.weight(.semibold))
                    Text("\(calendar.component(.month, from: shownDay))월")
                        .font(.subheadline.weight(.medium))
                }
                .foregroundStyle(Theme.accent)
                .frame(height: 44)
            }
            .accessibilityLabel("월간 보기")

            Spacer()

            Text(Self.dayTitleFormatter.string(from: shownDay))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)

            Spacer()

            Button {
                withAnimation { shiftDays(-1) }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 44)
            }
            .accessibilityLabel("전날")
            Button {
                withAnimation { shiftDays(1) }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 40, height: 44)
            }
            .accessibilityLabel("다음날")
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
    }

    /// 주간 날짜 띠 — 좌우로 밀면 지난주/다음 주.
    private var swipeableWeekStrip: some View {
        weekStrip
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 20)
                    .onEnded { value in
                        let dx = value.translation.width
                        guard abs(dx) > 40, abs(dx) > abs(value.translation.height) else { return }
                        withAnimation { shiftDays(dx < 0 ? 7 : -7) }
                    }
            )
    }

    @ViewBuilder
    private var dayTimeline: some View {
        if viewModel.currentMonthData == nil {
            eventListSection
        } else {
            DayPager(
                selectedDate: viewModel.selectedDate,
                calendar: calendar,
                onSettle: { day in viewModel.select(date: day) }
            ) { day in
                DayTimelineView(
                    date: day,
                    events: viewModel.events(on: day),
                    calendars: viewModel.calendars,
                    calendar: calendar,
                    onOpen: { selectedEvent = $0 },
                    onToggleCompletion: { toggleCompletion($0) },
                    onAddAt: { start in
                        addRequest = AddRequest(start: start)
                    },
                    canMove: canMove,
                    onRetime: { event, newStart, newEnd in
                        requestMove(PendingMove(event: event, newStart: newStart, newEnd: newEnd))
                    },
                    isDragging: $isDraggingEvent,
                    onRate: { event, rating in
                        Task { try? await viewModel.setRating(event, rating) }
                    },
                    onDayOffset: { offset in
                        // 끄는 동안엔 페이지를 넘기지 않는다 — 넘기면 원래 페이지가 내려가 끄는 제스처가 끊긴다(버그-4)
                        let target = offset == 0 ? nil : calendar.date(byAdding: .day, value: offset, to: day)
                        withAnimation(.easeInOut(duration: 0.2)) { dragPreviewDay = target }
                        if let target, !viewModel.hasMonthData(for: target) {
                            Task { await viewModel.prefetchMonth(containing: target) }
                        }
                    },
                    eventsForDay: { viewModel.events(on: $0) },
                    onSettleDay: { target in
                        withAnimation(.easeInOut(duration: 0.25)) { viewModel.select(date: target) }
                    },
                    onCrossDayDrag: { crossDrag = $0 },
                    scrollYForOffset: { offset in
                        calendar.date(byAdding: .day, value: offset, to: day)
                            .flatMap { dayScrollRegistry.y[calendar.startOfDay(for: $0)] }
                    },
                    onScrollY: { date, y in dayScrollRegistry.y[date] = y },
                    stripFrames: stripFrames
                )
                // 달 경계 너머 날짜는 미리 받아 둔다
                .task(id: day) {
                    if !viewModel.hasMonthData(for: day) { await viewModel.prefetchMonth(containing: day) }
                }
            }
            .scrollDisabled(isDraggingEvent)
        }
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
                    } onLongPress: {
                        // 꾹 누르기 → 그 날짜로 새 일정 (시작 시각은 새 일정 화면 기본값)
                        viewModel.selectedDate = day
                        addRequest = AddRequest(start: nil)
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

    // MARK: - 하루 보기 끌어 옮기기

    /// 종일 일정은 DayTimelineView 가 따로 뺀다. 초대·예약·보기 전용 공유 캘린더·남이 주최한 구글 일정은 못 옮긴다.
    private func canMove(_ event: CalendarEvent) -> Bool {
        if event.isInvite || event.isBooking { return false }
        if !event.canModifyGoogle { return false }
        if let calendarId = event.calendarId,
           let info = viewModel.calendars.first(where: { $0.id == calendarId }),
           !info.canEdit {
            return false
        }
        return true
    }

    private func requestMove(_ move: PendingMove) {
        if move.event.isGoogle && move.event.attendees.contains(where: { !$0.isSelf }) {
            pendingMove = move
        } else {
            performMove(move, notifyAttendees: false)
        }
    }

    /// 뷰모델이 먼저 화면에 옮겨 두고, 실패하면 되돌린다 — 여기선 실패 alert 만.
    private func performMove(_ move: PendingMove, notifyAttendees: Bool) {
        Task {
            do {
                try await viewModel.retimeEvent(
                    move.event, start: move.newStart, end: move.newEnd, notifyAttendees: notifyAttendees
                )
                // 지금 보는 날과 다른 날로 옮겼으면(주간 날짜 칸에 놓기) 아래에 잠깐 알리고 '보기'로 그 날로
                let otherDay = !calendar.isDate(move.newStart, inSameDayAs: viewModel.selectedDate)
                if otherDay || move.event.isRecurring {
                    showMovedToast(to: otherDay ? move.newStart : nil, occurrenceOnly: move.event.isRecurring)
                }
            } catch let apiError as APIError {
                moveErrorMessage = apiError.errorDescription
            } catch {
                moveErrorMessage = "잠시 후 다시 시도해 주세요."
            }
        }
    }

    private static let moveTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "a h:mm"
        return formatter
    }()

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
    /// 꾹 누르기 — 그 날짜로 새 일정
    var onLongPress: () -> Void = {}

    /// 꾹 누른 손을 뗄 때 버튼 탭(선택·주 보기 드릴다운)이 같이 눌리지 않게
    @State private var suppressTap = false

    var body: some View {
        Button {
            if suppressTap {
                suppressTap = false
                return
            }
            onTap()
        } label: {
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
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.4).onEnded { _ in
                suppressTap = true
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onLongPress()
                // 손을 떼지 않고 끝나는 경우(시트가 바로 덮음)에도 다음 탭은 정상으로
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) { suppressTap = false }
            }
        )
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

            // 중요함은 동그라미 대신 별 (색만으로 구분하지 않음)
            Button(action: onToggleCompletion) {
                Image(systemName: CompletionMark.symbol(event))
                    .font(.system(size: 22, weight: .regular))
                    .foregroundStyle(event.completed ? Self.completedGreen : Theme.secondaryText)
                    .frame(width: 36, height: 36)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CompletionMark.label(event))

            Button(action: onOpen) {
                HStack(spacing: 8) {
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 6) {
                            Text(event.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.primaryText)
                                .strikethrough(event.completed)
                                .lineLimit(2)
                            if let years = event.anniversaryYears {
                                AnniversaryBadge(years: years, compact: true)
                            }
                            if let rating = event.rating, event.completed {
                                Label("\(rating)", systemImage: "heart.fill")
                                    .labelStyle(.titleAndIcon)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.satisfaction)
                                    .accessibilityLabel("만족도 하트 \(rating)개")
                            }
                            if event.archived {
                                ArchivedTag()
                            }
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
        // 가벼움 — 조금 옅게
        .opacity(event.importance == .low && !event.completed ? 0.7 : 1)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .opacity(rowOpacity)
        .fixedSize(horizontal: false, vertical: true)
        .animation(.easeInOut(duration: 0.15), value: event.completed)
        .animation(.easeInOut(duration: 0.15), value: event.archived)
    }

    private var rowOpacity: Double {
        if event.archived { return CalendarEvent.archivedOpacity }
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

/// 하루 보기 위쪽 주간 날짜 칸들의 전역 좌표 (다른 날로 끌어 놓기용)
private struct StripFramesKey: PreferenceKey {
    static var defaultValue: [Date: CGRect] = [:]
    static func reduce(value: inout [Date: CGRect], nextValue: () -> [Date: CGRect]) {
        value.merge(nextValue()) { $1 }
    }
}
