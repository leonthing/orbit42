import SwiftUI
import WidgetKit

enum WidgetPalette {
    static let accent = Color(red: 0x63 / 255, green: 0x66 / 255, blue: 0xF1 / 255)
    static let completedOpacity = 0.55
}

extension Color {
    /// "#6366f1" / "6366f1" / "#6366f1ff"
    init?(widgetHex: String) {
        var hex = widgetHex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6 || hex.count == 8, let value = UInt64(hex, radix: 16) else { return nil }
        let shift: UInt64 = hex.count == 8 ? 8 : 0
        let alpha = hex.count == 8 ? Double(value & 0xFF) / 255 : 1
        self = Color(
            red: Double((value >> (16 + shift)) & 0xFF) / 255,
            green: Double((value >> (8 + shift)) & 0xFF) / 255,
            blue: Double((value >> shift) & 0xFF) / 255,
            opacity: alpha
        )
    }
}

// MARK: - 공통 표시

enum WidgetText {
    static func time(_ date: Date) -> String {
        date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits).locale(Locale(identifier: "en_GB")))
    }

    /// "14:00–16:00" / "종일"
    static func range(_ event: WidgetEvent) -> String {
        event.allDay ? "종일" : "\(time(event.start))–\(time(event.end.addingTimeInterval(1)))"
    }

    /// 오늘이 아닌 날이면 앞에 "내일" / "10/15(수)"
    static func dayPrefix(_ event: WidgetEvent, entry: CalendarEntry) -> String? {
        let calendar = entry.calendar
        let today = calendar.startOfDay(for: entry.date)
        let day = calendar.startOfDay(for: max(event.start, today))
        if day == today { return nil }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: today), day == tomorrow { return "내일" }
        let comps = calendar.dateComponents([.month, .day, .weekday], from: day)
        let weekday = calendar.shortWeekdaySymbols[(comps.weekday ?? 1) - 1]
        return "\(comps.month ?? 0)/\(comps.day ?? 0)(\(weekday))"
    }

    static func weekdayName(_ date: Date, calendar: Calendar) -> String {
        calendar.weekdaySymbols[calendar.component(.weekday, from: date) - 1]
    }
}

struct LoggedOutView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "calendar")
                .font(.title2)
                .foregroundStyle(WidgetPalette.accent)
            Text("Orbit42에 로그인하면\n일정이 보여요")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// 꽉 찬 색 카드 (구글 캘린더 위젯식) — 다가오는 일정
struct SolidEventCard: View {
    let event: WidgetEvent
    let entry: CalendarEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(event.title)
                .font(.caption.weight(.semibold))
                .strikethrough(event.completed)
                .lineLimit(1)
            Text([WidgetText.dayPrefix(event, entry: entry), WidgetText.range(event)].compactMap { $0 }.joined(separator: " "))
                .font(.caption2)
                .lineLimit(1)
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
        .background(entry.color(of: event), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .opacity(event.completed ? WidgetPalette.completedOpacity : (event.tentative ? 0.7 : 1))
    }
}

/// 옅은 색 + 왼쪽 막대 (애플 캘린더 위젯식) — 오늘·내일 목록
struct TintedEventRow: View {
    let event: WidgetEvent
    let entry: CalendarEntry

    var body: some View {
        let color = entry.color(of: event)
        Group {
            if event.allDay {
                HStack(spacing: 5) {
                    Circle().fill(color).frame(width: 6, height: 6)
                    Text(event.title)
                        .font(.caption.weight(.semibold))
                        .strikethrough(event.completed)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
            } else {
                HStack(spacing: 5) {
                    RoundedRectangle(cornerRadius: 1.5).fill(color).frame(width: 3)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(event.title)
                            .font(.caption.weight(.semibold))
                            .strikethrough(event.completed)
                            .lineLimit(1)
                        Text(WidgetText.range(event))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 3)
                .padding(.trailing, 4)
                .padding(.leading, 3)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        // Link 안이라 기본 tint(액센트)가 글자에 묻지 않도록 명시
        .foregroundStyle(Color.primary)
        .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .opacity(event.completed ? WidgetPalette.completedOpacity : (event.tentative ? 0.7 : 1))
    }

    /// 배치 계산용 대략 높이 (pt)
    static func height(_ event: WidgetEvent) -> CGFloat { event.allDay ? 22 : 36 }
}

// MARK: - 중형 A: 월 달력 + 다가오는 일정 3개

struct MonthUpcomingView: View {
    let entry: CalendarEntry

    var body: some View {
        if entry.state == .loggedOut {
            LoggedOutView()
        } else {
            HStack(spacing: 10) {
                MonthGrid(entry: entry)
                    .frame(maxWidth: .infinity)
                upcoming
                    .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private var upcoming: some View {
        let events = entry.upcoming(limit: 3)
        if events.isEmpty {
            Text("다가오는 일정이 없어요")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 4) {
                ForEach(events) { event in
                    Link(destination: SharedConfig.calendarURL(for: max(event.start, entry.calendar.startOfDay(for: entry.date)))) {
                        SolidEventCard(event: event, entry: entry)
                    }
                }
                ForEach(0..<(3 - events.count), id: \.self) { _ in
                    Color.clear
                }
            }
        }
    }
}

struct MonthGrid: View {
    let entry: CalendarEntry

    var body: some View {
        let calendar = entry.calendar
        let today = calendar.startOfDay(for: entry.date)
        let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: today)) ?? today
        let leading = (calendar.component(.weekday, from: monthStart) - calendar.firstWeekday + 7) % 7
        let daysInMonth = calendar.range(of: .day, in: .month, for: monthStart)?.count ?? 30
        let weeks = Int(ceil(Double(leading + daysInMonth) / 7))
        let gridStart = calendar.date(byAdding: .day, value: -leading, to: monthStart) ?? monthStart
        let symbols = rotated(calendar.veryShortWeekdaySymbols, firstWeekday: calendar.firstWeekday)

        VStack(alignment: .leading, spacing: 2) {
            Text("\(calendar.component(.month, from: today))월")
                .font(.caption.weight(.bold))
                .foregroundStyle(WidgetPalette.accent)
                .padding(.leading, 2)
            HStack(spacing: 0) {
                ForEach(Array(symbols.enumerated()), id: \.offset) { _, symbol in
                    Text(symbol)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                }
            }
            ForEach(0..<weeks, id: \.self) { week in
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { column in
                        let day = calendar.date(byAdding: .day, value: week * 7 + column, to: gridStart) ?? gridStart
                        dayCell(day, inMonth: calendar.isDate(day, equalTo: monthStart, toGranularity: .month),
                                isToday: calendar.isDate(day, inSameDayAs: today))
                    }
                }
                .frame(maxHeight: .infinity)
            }
        }
    }

    private func dayCell(_ day: Date, inMonth: Bool, isToday: Bool) -> some View {
        Link(destination: SharedConfig.calendarURL(for: day)) {
            Text("\(entry.calendar.component(.day, from: day))")
                .font(.system(size: 10, weight: isToday ? .bold : .regular))
                .foregroundStyle(isToday ? Color.white : (inMonth ? Color.primary : Color.secondary.opacity(0.5)))
                .frame(width: 17, height: 17)
                .background {
                    if isToday { Circle().fill(WidgetPalette.accent) }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func rotated(_ symbols: [String], firstWeekday: Int) -> [String] {
        guard symbols.count == 7 else { return symbols }
        let offset = firstWeekday - 1
        return Array(symbols[offset...] + symbols[..<offset])
    }
}

// MARK: - 중형 B: 오늘 + 내일

struct TodayTomorrowView: View {
    let entry: CalendarEntry

    /// 한 칸의 대략 높이 — 중형 위젯 내용 영역(약 126pt)에서 머리글을 뺀 값
    private let leftCapacity: CGFloat = 76
    private let rightCapacity: CGFloat = 112

    var body: some View {
        if entry.state == .loggedOut {
            LoggedOutView()
        } else {
            content
        }
    }

    private var content: some View {
        let calendar = entry.calendar
        let today = calendar.startOfDay(for: entry.date)
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today) ?? today
        // 오늘은 아직 끝나지 않은 일정만
        let todayEvents = entry.events(on: today).filter { $0.allDay || $0.end > entry.date }
        let tomorrowEvents = entry.events(on: tomorrow)
        let (left, rightToday) = split(todayEvents, capacity: leftCapacity)
        let rightUsed = rightToday.reduce(0) { $0 + TintedEventRow.height($1) + 4 }
        let (tomorrowShown, _) = split(tomorrowEvents, capacity: rightCapacity - rightUsed - 18)

        return HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                VStack(alignment: .leading, spacing: -2) {
                    Text(WidgetText.weekdayName(today, calendar: calendar))
                        .font(.caption.weight(.bold))
                        .foregroundStyle(WidgetPalette.accent)
                    Text("\(calendar.component(.day, from: today))")
                        .font(.system(size: 34, weight: .regular))
                }
                if left.isEmpty {
                    Text(tomorrowEvents.isEmpty ? "남은 일정이 없어요" : "오늘 남은 일정 없음")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                ForEach(left) { event in
                    Link(destination: SharedConfig.calendarURL(for: today)) {
                        TintedEventRow(event: event, entry: entry)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                ForEach(rightToday) { event in
                    Link(destination: SharedConfig.calendarURL(for: today)) {
                        TintedEventRow(event: event, entry: entry)
                    }
                }
                Text("내일")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(.top, rightToday.isEmpty ? 0 : 2)
                if tomorrowShown.isEmpty {
                    Text("일정 없음")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                ForEach(tomorrowShown) { event in
                    Link(destination: SharedConfig.calendarURL(for: tomorrow)) {
                        TintedEventRow(event: event, entry: entry)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// 높이 안에 들어가는 만큼 앞에서 자르고 나머지를 돌려준다.
    private func split(_ events: [WidgetEvent], capacity: CGFloat) -> ([WidgetEvent], [WidgetEvent]) {
        var used: CGFloat = 0
        var head: [WidgetEvent] = []
        for (index, event) in events.enumerated() {
            let height = TintedEventRow.height(event) + 4
            if used + height > capacity { return (head, Array(events[index...])) }
            used += height
            head.append(event)
        }
        return (head, [])
    }
}

// MARK: - 소형: 오늘 날짜 + 다음 일정

struct NextEventView: View {
    let entry: CalendarEntry

    var body: some View {
        if entry.state == .loggedOut {
            LoggedOutView()
        } else {
            let calendar = entry.calendar
            VStack(alignment: .leading, spacing: 6) {
                VStack(alignment: .leading, spacing: -2) {
                    Text(WidgetText.weekdayName(entry.date, calendar: calendar))
                        .font(.caption.weight(.bold))
                        .foregroundStyle(WidgetPalette.accent)
                    Text("\(calendar.component(.day, from: entry.date))")
                        .font(.system(size: 34, weight: .regular))
                }
                Spacer(minLength: 0)
                if let event = entry.upcoming(limit: 1).first {
                    HStack(spacing: 6) {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(entry.color(of: event))
                            .frame(width: 3)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(event.title)
                                .font(.subheadline.weight(.semibold))
                                .strikethrough(event.completed)
                                .lineLimit(2)
                            Text([WidgetText.dayPrefix(event, entry: entry), WidgetText.range(event)].compactMap { $0 }.joined(separator: " "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .opacity(event.completed ? WidgetPalette.completedOpacity : 1)
                } else {
                    Text("다가오는 일정이 없어요")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }
}
