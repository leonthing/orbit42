import SwiftUI

/// 하루 보기 — 맨 위 종일 줄 + 0~24시 시간축에 일정 블록 (구글 캘린더 하루 보기식).
/// 겹치는 일정은 옆으로 나눠 그리고, 오늘이면 현재 시각에 빨간 선을 긋는다.
/// 블록 탭 = 상세, 길게 누르기 = 완료 체크, 빈 시간 탭 = 그 시각으로 새 일정, 가로 스와이프 = 전날/다음날.
struct DayTimelineView: View {
    let date: Date
    /// 그 날에 걸친 일정 (숨긴 캘린더 제외 — `CalendarViewModel.events(on:)`)
    let events: [CalendarEvent]
    let calendars: [CalendarInfo]
    let calendar: Calendar
    let onOpen: (CalendarEvent) -> Void
    let onToggleCompletion: (CalendarEvent) -> Void
    let onAddAt: (Date) -> Void
    let onSwipeDay: (Int) -> Void

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
        .contentShape(Rectangle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 30)
                .onEnded { value in
                    let dx = value.translation.width, dy = value.translation.height
                    guard abs(dx) > abs(dy) * 1.5, abs(dx) > 50 else { return }
                    onSwipeDay(dx < 0 ? 1 : -1)
                }
        )
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
                    Button { onOpen(event) } label: {
                        Text(event.title)
                            .font(.caption.weight(.semibold))
                            .strikethrough(event.completed)
                            .lineLimit(1)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(event.displayColor(in: calendars), in: RoundedRectangle(cornerRadius: 6))
                            .opacity(event.completed ? 0.55 : 1)
                    }
                    .buttonStyle(.plain)
                    .contextMenu { completionMenu(event) }
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
        return Button { onOpen(event) } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(event.title)
                    .font(.caption.weight(.semibold))
                    .strikethrough(event.completed)
                    .lineLimit(block.height > 44 ? 2 : 1)
                if block.height > 30, let location = event.location, !location.isEmpty {
                    Text(location)
                        .font(.caption2)
                        .lineLimit(1)
                }
                if block.height > 44 {
                    Text(timeText(event))
                        .font(.caption2)
                        .lineLimit(1)
                        .opacity(0.9)
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, block.height > 22 ? 4 : 1)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(event.displayColor(in: calendars), in: RoundedRectangle(cornerRadius: 6))
            .opacity(event.completed ? 0.55 : (event.tentative ? 0.7 : 1))
            .clipped()
        }
        .buttonStyle(.plain)
        .contextMenu { completionMenu(event) }
    }

    @ViewBuilder
    private func completionMenu(_ event: CalendarEvent) -> some View {
        Button {
            onToggleCompletion(event)
        } label: {
            Label(event.completed ? "완료 해제" : "완료로 표시",
                  systemImage: event.completed ? "circle" : "checkmark.circle")
        }
        Button { onOpen(event) } label: {
            Label("상세 보기", systemImage: "info.circle")
        }
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
