import SwiftUI

/// 하루 보기 — 맨 위 종일 줄 + 0~24시 시간축에 일정 블록 (구글 캘린더 하루 보기식).
/// 겹치는 일정은 옆으로 나눠 그리고, 오늘이면 현재 시각에 빨간 선을 긋는다.
/// 블록 탭 = 상세, 블록 앞 체크박스 = 완료 토글, 빈 시간 탭 = 그 시각으로 새 일정.
/// 블록을 꾹 누르면 떠오르고, 위아래로 끌면 15분 단위로 시간이 옮겨진다 (아이폰 캘린더식, 같은 날 안에서만).
/// 블록 아래 끝을 잡고 끌면 끝 시각만 바뀐다(길이 바꾸기, 최소 15분).
/// 전날/다음날 넘기기는 바깥의 `DayPager`(가로 페이징 스크롤)가 맡는다.
struct DayTimelineView: View {
    let date: Date
    /// 그 날에 걸친 일정 (숨긴 캘린더 제외 — `CalendarViewModel.events(on:)`)
    let events: [CalendarEvent]
    let calendars: [CalendarInfo]
    let calendar: Calendar
    let onOpen: (CalendarEvent) -> Void
    let onToggleCompletion: (CalendarEvent) -> Void
    let onAddAt: (Date) -> Void
    /// 끌어 옮길 수 있는 일정인지 (종일·초대·예약·편집 권한 없는 일정은 부모가 false)
    let canMove: (CalendarEvent) -> Bool
    /// 놓은 자리의 새 시작·끝 시각 — 저장·확인은 부모가 맡는다
    let onRetime: (CalendarEvent, Date, Date) -> Void
    /// 끄는 동안 바깥 페이저의 가로 넘김을 막는다
    @Binding var isDragging: Bool
    /// 완료 직후 뜨는 별점 — 누르면 저장 (1.5.0 A, 나만 본다)
    var onRate: (CalendarEvent, Int) -> Void = { _, _ in }

    /// 체크박스로 막 완료한 일정 — 블록 위에 별 5개가 잠깐 떠 있다
    @State private var ratingPromptId: String?
    @State private var ratingPromptTask: Task<Void, Never>?

    /// 끄는 중인 블록과 방식 (옮기기 / 아래 끝 끌어 길이 바꾸기)
    @State private var dragId: String?
    @State private var dragMode: DragMode = .move
    /// 손가락이 움직인 거리(화면 기준)
    @State private var dragTranslation: CGFloat = 0
    /// 콘텐츠가 위로 스크롤된 양 — 끄는 동안 자동 스크롤된 만큼 블록도 따라간다
    @State private var scrollY: CGFloat = 0
    @State private var dragStartScrollY: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0
    /// 화면 위/아래 가장자리에 닿으면 -1/+1 — 그 방향으로 자동 스크롤
    @State private var autoScrollDirection = 0
    @State private var autoScrollTask: Task<Void, Never>?
    @State private var lastSnap = 0
    /// 끌기를 막 끝낸 손가락이 블록 탭으로 상세를 열지 않게
    @State private var lastDragEnd = Date.distantPast

    private enum DragMode { case move, resize }

    private static let viewportSpace = "dayTimelineViewport"
    private let snapMinutes = 15

    private let hourHeight: CGFloat = 56
    private let labelWidth: CGFloat = 52
    private let topInset: CGFloat = 8

    private var dayStart: Date { calendar.startOfDay(for: date) }
    private var dayEnd: Date { calendar.date(byAdding: .day, value: 1, to: dayStart) ?? dayStart }
    private var allDayEvents: [CalendarEvent] { events.filter(\.allDay) }
    private var timedEvents: [CalendarEvent] { events.filter { !$0.allDay } }

    var body: some View {
        VStack(spacing: 0) {
            if !allDayEvents.isEmpty {
                allDayRow
                Divider().overlay(Theme.fill(0.08))
            }
            ScrollViewReader { proxy in
                ScrollView {
                    grid(proxy)
                        .frame(height: hourHeight * 24 + topInset * 2)
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: ScrollYKey.self,
                                    value: -geo.frame(in: .named(Self.viewportSpace)).minY
                                )
                            }
                        )
                }
                .coordinateSpace(name: Self.viewportSpace)
                .scrollDisabled(dragId != nil)
                .onPreferenceChange(ScrollYKey.self) { scrollY = $0 }
                .background(
                    GeometryReader { geo in
                        Color.clear
                            .onAppear { viewportHeight = geo.size.height }
                            .onChange(of: geo.size.height) { _, height in viewportHeight = height }
                    }
                )
                .onAppear { scrollToAnchor(proxy, animated: false) }
                .onChange(of: dayStart) { _, _ in scrollToAnchor(proxy, animated: true) }
            }
        }
    }

    // MARK: - 종일 줄

    private var allDayRow: some View {
        HStack(alignment: .top, spacing: 0) {
            Text("종일")
                .font(.caption2)
                .foregroundStyle(Theme.secondaryText)
                .frame(width: labelWidth, alignment: .trailing)
                .padding(.trailing, 6)
                .padding(.top, 5)
            VStack(spacing: 3) {
                ForEach(allDayEvents) { event in
                    HStack(spacing: 0) {
                        checkbox(event, size: 14)
                        Button { open(event) } label: {
                            Text(titleText(event))
                                .font(.caption.weight(.semibold))
                                .strikethrough(event.completed)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.vertical, 4)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    .foregroundStyle(.white)
                    .padding(.leading, 3)
                    .padding(.trailing, 8)
                    .background(blockColor(event), in: RoundedRectangle(cornerRadius: 6))
                    .opacity(blockOpacity(event))
                }
            }
            .padding(.trailing, 12)
        }
        .padding(.vertical, 6)
    }

    // MARK: - 시간축

    private func grid(_ proxy: ScrollViewProxy) -> some View {
        GeometryReader { geo in
            let columnsWidth = geo.size.width - labelWidth - 12
            ZStack(alignment: .topLeading) {
                hourLines
                // 빈 시간 탭 → 그 시각(30분 단위), 꾹 누르기 → 누른 자리 시각(15분 단위)으로 새 일정.
                // 손가락이 움직이지 않는 꾹 누르기에서도 위치를 얻으려고 UIKit 인식기를 쓴다(스크롤과도 함께 동작).
                EmptySlotTouchCatcher(
                    onTap: { location in
                        let minutes = max(0, min(23 * 60 + 30, Int(location.y / hourHeight * 60) / 30 * 30))
                        if let start = calendar.date(byAdding: .minute, value: minutes, to: dayStart) {
                            onAddAt(start)
                        }
                    },
                    onLongPress: { location in
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        let step = snapMinutes
                        let minutes = max(0, min(24 * 60 - step, Int(location.y / hourHeight * 60) / step * step))
                        if let start = calendar.date(byAdding: .minute, value: minutes, to: dayStart) {
                            onAddAt(start)
                        }
                    }
                )
                .frame(width: columnsWidth, height: hourHeight * 24)
                // offset 은 UIKit 뷰의 터치 영역을 옮기지 않아 padding 으로 자리를 잡는다
                .padding(.leading, labelWidth)
                .padding(.top, topInset)
                ForEach(layoutBlocks()) { block in
                    let isLifted = dragId == block.id
                    let movable = isMovable(block.event)
                    let shift = isLifted ? CGFloat(snappedDelta(block)) / 60 * hourHeight : 0
                    let isResizing = isLifted && dragMode == .resize
                    eventBlock(block)
                        .overlay(alignment: .topTrailing) {
                            if isLifted { dragTimeBadge(block) }
                        }
                        .overlay(alignment: .bottomTrailing) {
                            if ratingPromptId == block.id { ratingPrompt(block.event) }
                        }
                        .frame(
                            width: max(columnsWidth * block.width - 2, 10),
                            height: block.height + (isResizing ? shift : 0)
                        )
                        // 아래 끝 손잡이 — 꾹 눌러 끌면 길이 바꾸기 (옮기기보다 먼저 잡힌다)
                        .overlay(alignment: .bottom) {
                            if movable && block.height >= 28 {
                                resizeHandle(visible: isResizing)
                                    .highPriorityGesture(dragGesture(block, mode: .resize, proxy: proxy))
                            }
                        }
                        .scaleEffect(isLifted && !isResizing ? 1.03 : 1)
                        .shadow(color: .black.opacity(isLifted ? 0.25 : 0), radius: 8, y: 3)
                        .offset(
                            x: labelWidth + columnsWidth * block.x,
                            y: topInset + block.y + (isLifted && !isResizing ? shift : 0)
                        )
                        .zIndex(isLifted || ratingPromptId == block.id ? 1 : 0)
                        .simultaneousGesture(
                            dragGesture(block, mode: .move, proxy: proxy),
                            including: movable ? .all : .subviews
                        )
                        .animation(.easeOut(duration: 0.12), value: shift)
                }
                if calendar.isDateInToday(date) {
                    nowLine(width: columnsWidth)
                }
            }
        }
    }

    private var hourLines: some View {
        VStack(spacing: 0) {
            ForEach(0..<24, id: \.self) { hour in
                HStack(alignment: .top, spacing: 6) {
                    Text(String(format: "%02d:00", hour))
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: labelWidth - 6, alignment: .trailing)
                        .offset(y: -7)
                        .opacity(hour == 0 ? 0 : 1)
                    Rectangle()
                        .fill(Theme.fill(0.08))
                        .frame(height: 0.5)
                }
                .frame(height: hourHeight, alignment: .top)
                .id(hour)
            }
        }
        .padding(.top, topInset)
    }

    private func nowLine(width: CGFloat) -> some View {
        SwiftUI.TimelineView(.periodic(from: .now, by: 60)) { context in
            let minutes = context.date.timeIntervalSince(dayStart) / 60
            HStack(spacing: 0) {
                Circle().fill(Color.red).frame(width: 8, height: 8)
                Rectangle().fill(Color.red).frame(width: width, height: 1.5)
            }
            .offset(x: labelWidth - 4, y: topInset + CGFloat(minutes) / 60 * hourHeight - 4)
        }
        .allowsHitTesting(false)
    }

    private func eventBlock(_ block: Block) -> some View {
        let event = block.event
        // 짧은 블록(30분 이하)은 체크박스와 제목을 한 줄에, 긴 블록은 체크박스 옆에 제목·장소·시간.
        return HStack(alignment: .top, spacing: 0) {
            checkbox(event, size: block.height > 22 ? 15 : 12)
            Button { open(event) } label: {
                VStack(alignment: .leading, spacing: 1) {
                    Text(titleText(event))
                        .font(.caption.weight(.semibold))
                        .strikethrough(event.completed)
                        .lineLimit(block.height > 44 ? 2 : 1)
                    if block.height > 30, let location = event.location, !location.isEmpty {
                        Text(location)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                    if block.height > 44 {
                        // 참석자가 있으면 시간 옆에 👤n (공간 될 때만)
                        Text(timeText(event) + (event.attendees.count > 1 ? "  👤\(event.attendees.count)" : ""))
                            .font(.caption2)
                            .lineLimit(1)
                            .opacity(0.9)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, block.height > 22 ? 4 : 1)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(.white)
        .padding(.leading, 1)
        .padding(.trailing, 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(blockColor(event), in: RoundedRectangle(cornerRadius: 6))
        // 중요함 — 왼쪽 굵은 띠 (제목 앞 "!" 와 함께, 색만으로 구분하지 않음)
        .overlay(alignment: .leading) {
            if event.importance == .high && !event.archived {
                // 가장자리에 붙이면 둥근 모서리에 묻혀 틈처럼 보여 안쪽으로 2pt 띄운다
                RoundedRectangle(cornerRadius: 1.5).fill(.white).frame(width: 3).padding(.vertical, 4).padding(.leading, 2)
            }
        }
        .opacity(blockOpacity(event))
        .clipped()
    }

    // MARK: - 끌어 옮기기

    private func isMovable(_ event: CalendarEvent) -> Bool {
        // 날을 넘는 일정은 같은 날 안에서 옮긴다는 전제가 안 맞아 뺀다
        !event.allDay && event.startAt >= dayStart && event.endAt <= dayEnd && canMove(event)
    }

    private func open(_ event: CalendarEvent) {
        guard dragId == nil, Date().timeIntervalSince(lastDragEnd) > 0.5 else { return }
        onOpen(event)
    }

    /// 지금 끈 거리를 15분 단위 분으로 — 그 날 0시~24시 밖으로는 못 나가고, 길이는 15분보다 짧아지지 않는다.
    private func snappedDelta(_ block: Block) -> Int {
        let points = dragTranslation + (scrollY - dragStartScrollY)
        let raw = Double(points / hourHeight * 60)
        var minutes = Int((raw / Double(snapMinutes)).rounded()) * snapMinutes
        let startMinutes = Int(block.event.startAt.timeIntervalSince(dayStart) / 60)
        let endMinutes = Int(block.event.endAt.timeIntervalSince(dayStart) / 60)
        if dragMode == .resize {
            minutes = max(minutes, startMinutes + snapMinutes - endMinutes)
        } else {
            minutes = max(minutes, -startMinutes)
        }
        minutes = min(minutes, 24 * 60 - endMinutes)
        return minutes
    }

    /// 끌기가 끝난 뒤의 시작·끝 — 옮기기는 둘 다, 길이 바꾸기는 끝만 바뀐다.
    private func retimed(_ block: Block) -> (start: Date, end: Date) {
        let delta = TimeInterval(snappedDelta(block) * 60)
        let start = dragMode == .move ? block.event.startAt.addingTimeInterval(delta) : block.event.startAt
        return (start, block.event.endAt.addingTimeInterval(delta))
    }

    private func resizeHandle(visible: Bool) -> some View {
        Capsule()
            .fill(Color.white.opacity(visible ? 0.9 : 0))
            .frame(width: 18, height: 3)
            .frame(maxWidth: .infinity)
            .frame(height: 12)
            .contentShape(Rectangle())
    }

    private func dragGesture(_ block: Block, mode: DragMode, proxy: ScrollViewProxy) -> some Gesture {
        LongPressGesture(minimumDuration: mode == .resize ? 0.25 : 0.4)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .named(Self.viewportSpace)))
            .onChanged { value in
                guard case .second(true, let drag) = value else { return }
                if dragId != block.id { beginDrag(block, mode: mode) }
                guard dragMode == mode else { return }
                guard let drag else { return }
                dragTranslation = drag.translation.height
                let snap = snappedDelta(block)
                if snap != lastSnap {
                    lastSnap = snap
                    UISelectionFeedbackGenerator().selectionChanged()
                }
                updateAutoScroll(fingerY: drag.location.y, proxy: proxy)
            }
            .onEnded { value in
                guard case .second(true, _) = value, dragId == block.id, dragMode == mode else {
                    if dragMode == mode { endDrag() }
                    return
                }
                let delta = snappedDelta(block)
                let times = retimed(block)
                endDrag()
                if delta != 0 {
                    onRetime(block.event, times.start, times.end)
                }
            }
    }

    private func beginDrag(_ block: Block, mode: DragMode) {
        dragId = block.id
        dragMode = mode
        dragTranslation = 0
        dragStartScrollY = scrollY
        lastSnap = 0
        isDragging = true
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    private func endDrag() {
        autoScrollTask?.cancel()
        autoScrollTask = nil
        autoScrollDirection = 0
        if dragId != nil { lastDragEnd = Date() }
        dragId = nil
        dragTranslation = 0
        isDragging = false
    }

    /// 손가락이 화면 위/아래 60pt 안에 들어오면 그 방향으로 한 시간씩 스크롤한다.
    private func updateAutoScroll(fingerY: CGFloat, proxy: ScrollViewProxy) {
        let edge: CGFloat = 60
        let direction = fingerY < edge ? -1 : (fingerY > viewportHeight - edge ? 1 : 0)
        autoScrollDirection = direction
        guard direction != 0, autoScrollTask == nil else { return }
        autoScrollTask = Task { @MainActor in
            while !Task.isCancelled, autoScrollDirection != 0 {
                let maxTop = max(0, 24 - Int(viewportHeight / hourHeight))
                let current = Int((scrollY / hourHeight).rounded())
                let target = max(0, min(maxTop, current + autoScrollDirection))
                if target != current {
                    withAnimation(.linear(duration: 0.3)) { proxy.scrollTo(target, anchor: .top) }
                }
                try? await Task.sleep(nanoseconds: 350_000_000)
            }
            autoScrollTask = nil
        }
    }

    private func dragTimeBadge(_ block: Block) -> some View {
        let (start, end) = retimed(block)
        return Text("\(Self.timeFormatter.string(from: start))–\(Self.timeFormatter.string(from: end))")
            .font(.caption2.weight(.semibold).monospacedDigit())
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.black.opacity(0.55), in: Capsule())
            .padding(4)
    }

    // 보관한 일정은 회색 블록 + 제목 앞 "보관" — 완료(취소선)와 구분된다.
    private func titleText(_ event: CalendarEvent) -> AttributedString {
        var title = AttributedString(event.title)
        if event.importance == .high && !event.archived {
            var mark = AttributedString("! ")
            mark.font = .caption.weight(.heavy)
            title = mark + title
        }
        guard event.archived else { return title }
        var tag = AttributedString("보관 ")
        tag.font = .caption2.weight(.bold)
        title = tag + title
        return title
    }

    private func blockColor(_ event: CalendarEvent) -> Color {
        event.archived ? Color.gray : event.displayColor(in: calendars)
    }

    private func blockOpacity(_ event: CalendarEvent) -> Double {
        if event.archived { return 0.75 }
        if event.completed { return 0.55 }
        if event.tentative { return 0.7 }
        // 가벼움 — 조금 옅게
        return event.importance == .low ? 0.7 : 1
    }

    /// 위젯과 같은 모양의 완료 체크 — 누르면 바로 토글 (`CalendarViewModel.setCompletion`, 낙관적 반영)
    private func checkbox(_ event: CalendarEvent, size: CGFloat) -> some View {
        Button {
            let completing = !event.completed
            onToggleCompletion(event)
            if completing { showRatingPrompt(for: event) } else if ratingPromptId == event.id { ratingPromptId = nil }
        } label: {
            Image(systemName: event.completed ? "checkmark.circle.fill" : "circle")
                .font(.system(size: size, weight: .medium))
                .frame(width: size + 10, height: size + 8)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(event.completed ? "완료 해제" : "완료로 표시")
    }

    // MARK: - 완료 후 별점

    /// 완료를 막지 않도록 블록 위에 2.5초만 떠 있다가 사라진다. 누르면 저장하고 바로 닫힌다.
    private func showRatingPrompt(for event: CalendarEvent) {
        ratingPromptTask?.cancel()
        withAnimation(.easeOut(duration: 0.15)) { ratingPromptId = event.id }
        ratingPromptTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.2)) { if ratingPromptId == event.id { ratingPromptId = nil } }
        }
    }

    private func ratingPrompt(_ event: CalendarEvent) -> some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { n in
                Button {
                    UISelectionFeedbackGenerator().selectionChanged()
                    onRate(event, n)
                    ratingPromptTask?.cancel()
                    withAnimation(.easeIn(duration: 0.2)) { ratingPromptId = nil }
                } label: {
                    Image(systemName: n <= (event.rating ?? 0) ? "star.fill" : "star")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.orange)
                        .frame(width: 30, height: 30)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("별 \(n)개")
            }
        }
        .padding(.horizontal, 4)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
        .offset(y: 34)
        .transition(.opacity.combined(with: .scale(scale: 0.9)))
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    private func timeText(_ event: CalendarEvent) -> String {
        let end = event.effectiveEnd(calendar: calendar).addingTimeInterval(1)
        return "\(Self.timeFormatter.string(from: event.startAt))–\(Self.timeFormatter.string(from: end))"
    }

    // MARK: - 스크롤 위치

    /// 오늘이면 현재 시각 한 시간 전, 아니면 첫 일정 한 시간 전, 일정이 없으면 8시.
    private func scrollToAnchor(_ proxy: ScrollViewProxy, animated: Bool) {
        var hour = 8
        if calendar.isDateInToday(date) {
            hour = calendar.component(.hour, from: Date()) - 1
        } else if let first = timedEvents.map({ max($0.startAt, dayStart) }).min() {
            hour = calendar.component(.hour, from: first) - 1
        }
        hour = max(0, min(hour, 17))
        if animated {
            withAnimation { proxy.scrollTo(hour, anchor: .top) }
        } else {
            DispatchQueue.main.async { proxy.scrollTo(hour, anchor: .top) }
        }
    }

    // MARK: - 겹침 배치

    struct Block: Identifiable {
        let event: CalendarEvent
        let y: CGFloat
        let height: CGFloat
        /// 열 너비 대비 비율 (0~1)
        let x: CGFloat
        let width: CGFloat
        var id: String { event.id }
    }

    /// 서로 이어서 겹치는 일정끼리 한 묶음으로 보고, 묶음 안에서 비어 있는 첫 열에 넣는다.
    private func layoutBlocks() -> [Block] {
        struct Item {
            let event: CalendarEvent
            let start: Date
            let end: Date
            var column = 0
        }
        let items: [Item] = timedEvents.compactMap { event in
            let start = max(event.startAt, dayStart)
            var end = min(event.effectiveEnd(calendar: calendar).addingTimeInterval(1), dayEnd)
            end = max(end, start.addingTimeInterval(15 * 60))  // 너무 짧은 일정도 누를 수 있게
            guard start < dayEnd else { return nil }
            return Item(event: event, start: start, end: end)
        }
        .sorted { $0.start != $1.start ? $0.start < $1.start : $0.end > $1.end }

        var blocks: [Block] = []
        var cluster: [Item] = []
        var clusterEnd = Date.distantPast

        func flush() {
            guard !cluster.isEmpty else { return }
            var columnEnds: [Date] = []
            for index in cluster.indices {
                if let free = columnEnds.firstIndex(where: { $0 <= cluster[index].start }) {
                    cluster[index].column = free
                    columnEnds[free] = cluster[index].end
                } else {
                    cluster[index].column = columnEnds.count
                    columnEnds.append(cluster[index].end)
                }
            }
            let count = CGFloat(columnEnds.count)
            for item in cluster {
                let y = CGFloat(item.start.timeIntervalSince(dayStart) / 3600) * hourHeight
                let height = CGFloat(item.end.timeIntervalSince(item.start) / 3600) * hourHeight
                blocks.append(Block(event: item.event, y: y, height: max(height - 1, 14),
                                    x: CGFloat(item.column) / count, width: 1 / count))
            }
            cluster = []
        }

        for item in items {
            if item.start >= clusterEnd { flush(); clusterEnd = .distantPast }
            cluster.append(item)
            clusterEnd = max(clusterEnd, item.end)
        }
        flush()
        return blocks
    }
}

/// 하루 보기 빈 시간의 탭·꾹 누르기 — 둘 다 누른 자리 좌표를 준다.
/// 꾹 누르기가 잡히면 탭은 실패하도록 묶어, 손을 뗄 때 새 일정이 두 번 열리지 않는다.
private struct EmptySlotTouchCatcher: UIViewRepresentable {
    let onTap: (CGPoint) -> Void
    let onLongPress: (CGPoint) -> Void

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        let longPress = UILongPressGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.longPressed(_:)))
        longPress.minimumPressDuration = 0.4
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        tap.require(toFail: longPress)
        view.addGestureRecognizer(longPress)
        view.addGestureRecognizer(tap)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.parent = self
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject {
        var parent: EmptySlotTouchCatcher
        init(parent: EmptySlotTouchCatcher) { self.parent = parent }

        @objc func tapped(_ recognizer: UITapGestureRecognizer) {
            parent.onTap(recognizer.location(in: recognizer.view))
        }

        @objc func longPressed(_ recognizer: UILongPressGestureRecognizer) {
            guard recognizer.state == .began else { return }
            parent.onLongPress(recognizer.location(in: recognizer.view))
        }
    }
}

private struct ScrollYKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// 하루 보기 페이저 — 날짜마다 한 페이지인 가로 페이징 스크롤(iOS 기본 페이징 애니메이션).
/// 넘기는 동안 블록 탭은 스크롤 뷰가 취소하므로 상세가 잘못 열리지 않는다.
/// 기준일 ±400일을 지연 생성하고, 페이지가 멈추면 선택 날짜를 바꾼다.
struct DayPager<Page: View>: View {
    let selectedDate: Date
    let calendar: Calendar
    let onSettle: (Date) -> Void
    @ViewBuilder let page: (Date) -> Page

    /// 페이지 번호의 기준일 — 한 번 정하면 바꾸지 않는다. 다시 나타날 때마다 오늘로 바꾸면
    /// 스크롤 뷰가 들고 있던 옛 번호가 새 기준으로 읽혀 날짜가 며칠씩 튄다.
    @State private var base: Date?
    @State private var position: Int?
    /// 처음 자리 잡기 전에 스크롤 뷰가 알려 오는 위치(맨 앞 페이지 등)는 무시한다
    @State private var ready = false

    private static var span: Int { 400 }

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(-Self.span...Self.span, id: \.self) { offset in
                    page(day(at: offset))
                        .containerRelativeFrame(.horizontal)
                        .id(offset)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $position)
        .onAppear {
            let selectedDay = calendar.startOfDay(for: selectedDate)
            // 기준일이 없거나 고른 날이 페이지 범위를 벗어났을 때만 다시 잡는다
            if base == nil || abs(offset(of: selectedDay, unclamped: true)) > Self.span - 7 {
                base = calendar.startOfDay(for: Date())
            }
            ready = false
            position = offset(of: selectedDay)
            DispatchQueue.main.async { ready = true }
        }
        // 날짜 띠·화살표·위젯 링크로 날짜가 바뀌면 그 페이지로
        .onChange(of: calendar.startOfDay(for: selectedDate)) { _, day in
            let target = offset(of: day)
            if position != target { position = target }
        }
        .onChange(of: position) { _, new in
            guard ready, let new else { return }
            let day = day(at: new)
            if !calendar.isDate(day, inSameDayAs: selectedDate) { onSettle(day) }
        }
    }

    private var anchor: Date { base ?? calendar.startOfDay(for: Date()) }

    private func day(at offset: Int) -> Date {
        calendar.date(byAdding: .day, value: offset, to: anchor) ?? anchor
    }

    private func offset(of date: Date, unclamped: Bool = false) -> Int {
        let days = calendar.dateComponents([.day], from: anchor, to: calendar.startOfDay(for: date)).day ?? 0
        return unclamped ? days : max(-Self.span, min(Self.span, days))
    }
}
