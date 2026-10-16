import SwiftUI
import WidgetKit

enum WidgetPalette {
    static let accent = Color(red: 0x63 / 255, green: 0x66 / 255, blue: 0xF1 / 255)
    static let completedOpacity = 0.55

    /// 완료·미정·가벼움(1.5.0 A)은 옅게 — 중요함은 체크 자리 별로 구분(색만으로 구분하지 않음)
    static func opacity(_ event: WidgetEvent) -> Double {
        if event.completed { return completedOpacity }
        if event.tentative { return 0.7 }
        return event.isLight ? 0.7 : 1
    }
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
    /// 제목 — 중요함은 체크 자리 별로 보인다. 체크 칸이 없는 표시에서만 `withStar: true` 로 앞에 "★ "
    static func title(_ event: WidgetEvent, withStar: Bool = false) -> String {
        withStar && event.isImportant ? "★ " + event.title : event.title
    }

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

/// 위젯 체크박스 — 누르면 앱을 열지 않고 완료/해제 (iOS 17 인터랙티브 위젯)
struct CompletionCheckbox: View {
    let event: WidgetEvent
    let tint: Color
    var size: CGFloat = 15

    var body: some View {
        Button(intent: ToggleCompletionIntent(eventId: event.id, completed: !event.completed)) {
            // 중요함은 동그라미 대신 별
            Image(systemName: event.isImportant
                  ? (event.completed ? "star.fill" : "star")
                  : (event.completed ? "checkmark.circle.fill" : "circle"))
                .font(.system(size: size, weight: .medium))
                .foregroundStyle(tint)
                // 최소 28pt 터치 영역 — 옆의 카드 링크(앱 열기)와 겹치지 않게 칸을 고정한다
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel((event.isImportant ? "중요 일정, " : "") + (event.completed ? "완료 해제" : "완료로 표시"))
    }
}

/// 답해야 할 요청 수 — 없으면 아무것도 그리지 않는다. 누르면 받은 예약 목록.
struct RequestBadge: View {
    let count: Int

    var body: some View {
        if count > 0 {
            Link(destination: SharedConfig.bookingsURL) {
                Text("요청 \(count)건")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.orange, in: Capsule())
                    .lineLimit(1)
                    .fixedSize()
            }
        }
    }
}

/// 꽉 찬 색 카드 (구글 캘린더 위젯식) — 다가오는 일정
struct SolidEventCard: View {
    let event: WidgetEvent
    let entry: CalendarEntry
    let destination: URL

    var body: some View {
        HStack(spacing: 2) {
            CompletionCheckbox(event: event, tint: .white, size: 14)
            Link(destination: destination) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(WidgetText.title(event))
                        .font(.caption.weight(.semibold))
                        .strikethrough(event.completed)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text([WidgetText.dayPrefix(event, entry: entry), WidgetText.range(event)].compactMap { $0 }.joined(separator: " "))
                        .font(.caption2)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.leading, 3)
        .padding(.trailing, 8)
        .background(entry.color(of: event), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .opacity(WidgetPalette.opacity(event))
    }
}

/// 옅은 색 + 왼쪽 막대 (애플 캘린더 위젯식) — 오늘·내일 목록
struct TintedEventRow: View {
    let event: WidgetEvent
    let entry: CalendarEntry
    let destination: URL

    var body: some View {
        let color = entry.color(of: event)
        HStack(spacing: 2) {
            CompletionCheckbox(event: event, tint: color, size: event.allDay ? 12 : 14)
            Link(destination: destination) {
                if event.allDay {
                    HStack {
                        Text(WidgetText.title(event))
                            .font(.caption.weight(.semibold))
                            .strikethrough(event.completed)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                } else {
                    HStack {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(WidgetText.title(event))
                                .font(.caption.weight(.semibold))
                                .strikethrough(event.completed)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(WidgetText.range(event))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(.vertical, event.allDay ? 1 : 3)
        .padding(.leading, 1)
        .padding(.trailing, 4)
        .fixedSize(horizontal: false, vertical: true)
        // Link 안이라 기본 tint(액센트)가 글자에 묻지 않도록 명시
        .foregroundStyle(Color.primary)
        .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .opacity(WidgetPalette.opacity(event))
    }

    /// 배치 계산용 대략 높이 (pt)
    static func height(_ event: WidgetEvent) -> CGFloat { event.allDay ? 30 : 38 }
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
                    SolidEventCard(event: event, entry: entry,
                                   destination: SharedConfig.calendarURL(for: max(event.start, entry.calendar.startOfDay(for: entry.date))))
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
            HStack(spacing: 4) {
                Text("\(calendar.component(.month, from: today))월")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(WidgetPalette.accent)
                Spacer(minLength: 0)
                RequestBadge(count: entry.pendingRequests)
            }
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
                    HStack(spacing: 4) {
                        Text(WidgetText.weekdayName(today, calendar: calendar))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(WidgetPalette.accent)
                        RequestBadge(count: entry.pendingRequests)
                    }
                    Text("\(calendar.component(.day, from: today))")
                        .font(.system(size: 34, weight: .regular))
                }
                if left.isEmpty {
                    Text(tomorrowEvents.isEmpty ? "남은 일정이 없어요" : "오늘 남은 일정 없음")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                ForEach(left) { event in
                    TintedEventRow(event: event, entry: entry, destination: SharedConfig.calendarURL(for: today))
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                ForEach(rightToday) { event in
                    TintedEventRow(event: event, entry: entry, destination: SharedConfig.calendarURL(for: today))
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
                    TintedEventRow(event: event, entry: entry, destination: SharedConfig.calendarURL(for: tomorrow))
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
                    HStack(spacing: 4) {
                        Text(WidgetText.weekdayName(entry.date, calendar: calendar))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(WidgetPalette.accent)
                        Spacer(minLength: 0)
                        RequestBadge(count: entry.pendingRequests)
                    }
                    Text("\(calendar.component(.day, from: entry.date))")
                        .font(.system(size: 34, weight: .regular))
                }
                Spacer(minLength: 0)
                if let event = entry.upcoming(limit: 1).first {
                    HStack(alignment: .top, spacing: 3) {
                        CompletionCheckbox(event: event, tint: entry.color(of: event), size: 16)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(WidgetText.title(event))
                                .font(.subheadline.weight(.semibold))
                                .strikethrough(event.completed)
                                .lineLimit(2)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text([WidgetText.dayPrefix(event, entry: entry), WidgetText.range(event)].compactMap { $0 }.joined(separator: " "))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .opacity(WidgetPalette.opacity(event))
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
