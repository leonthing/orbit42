import SwiftUI

/// 하루 보기 — 맨 위 종일 줄 + 0~24시 시간축에 일정 블록 (구글 캘린더 하루 보기식).
/// 겹치는 일정은 옆으로 나눠 그리고, 오늘이면 현재 시각에 빨간 선을 긋는다.
/// 블록 탭 = 상세, 블록 앞 체크박스 = 완료 토글, 빈 시간 탭 = 그 시각으로 새 일정.
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
                    grid
                        .frame(height: hourHeight * 24 + topInset * 2)
                }
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
                        Button { onOpen(event) } label: {
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

    private var grid: some View {
        GeometryReader { geo in
            let columnsWidth = geo.size.width - labelWidth - 12
            ZStack(alignment: .topLeading) {
                hourLines
                // 빈 시간 탭 → 그 시각(30분 단위)으로 새 일정
                Color.clear
                    .contentShape(Rectangle())
                    .frame(width: columnsWidth, height: hourHeight * 24)
                    .offset(x: labelWidth, y: topInset)
                    .onTapGesture { location in
                        let minutes = max(0, min(23 * 60 + 30, Int(location.y / hourHeight * 60) / 30 * 30))
                        if let start = calendar.date(byAdding: .minute, value: minutes, to: dayStart) {
                            onAddAt(start)
                        }
                    }
                ForEach(layoutBlocks()) { block in
                    eventBlock(block)
                        .frame(width: max(columnsWidth * block.width - 2, 10), height: block.height)
                        .offset(x: labelWidth + columnsWidth * block.x, y: topInset + block.y)
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
            Button { onOpen(event) } label: {
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
        .opacity(blockOpacity(event))
        .clipped()
    }

    // 보관한 일정은 회색 블록 + 제목 앞 "보관" — 완료(취소선)와 구분된다.
    private func titleText(_ event: CalendarEvent) -> AttributedString {
        var title = AttributedString(event.title)
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
        return event.tentative ? 0.7 : 1
    }

    /// 위젯과 같은 모양의 완료 체크 — 누르면 바로 토글 (`CalendarViewModel.setCompletion`, 낙관적 반영)
    private func checkbox(_ event: CalendarEvent, size: CGFloat) -> some View {
        Button { onToggleCompletion(event) } label: {
            Image(systemName: event.completed ? "checkmark.circle.fill" : "circle")
                .font(.system(size: size, weight: .medium))
                .frame(width: size + 10, height: size + 8)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(event.completed ? "완료 해제" : "완료로 표시")
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

/// 하루 보기 페이저 — 날짜마다 한 페이지인 가로 페이징 스크롤(iOS 기본 페이징 애니메이션).
/// 넘기는 동안 블록 탭은 스크롤 뷰가 취소하므로 상세가 잘못 열리지 않는다.
/// 기준일 ±400일을 지연 생성하고, 페이지가 멈추면 선택 날짜를 바꾼다.
struct DayPager<Page: View>: View {
    let selectedDate: Date
    let calendar: Calendar
    let onSettle: (Date) -> Void
    @ViewBuilder let page: (Date) -> Page

    @State private var base = Date()
    @State private var position: Int?

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
            base = calendar.startOfDay(for: Date())
            position = offset(of: selectedDate)
        }
        // 날짜 띠·화살표·위젯 링크로 날짜가 바뀌면 그 페이지로
        .onChange(of: calendar.startOfDay(for: selectedDate)) { _, day in
            let target = offset(of: day)
            if position != target { position = target }
        }
        .onChange(of: position) { _, new in
            guard let new else { return }
            let day = day(at: new)
            if !calendar.isDate(day, inSameDayAs: selectedDate) { onSettle(day) }
        }
    }

    private func day(at offset: Int) -> Date {
        calendar.date(byAdding: .day, value: offset, to: base) ?? base
    }

    private func offset(of date: Date) -> Int {
        let days = calendar.dateComponents([.day], from: base, to: calendar.startOfDay(for: date)).day ?? 0
        return max(-Self.span, min(Self.span, days))
    }
}
