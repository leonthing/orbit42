import SwiftUI

// MARK: - 모델

struct CalendarEventsResponsePublic: Decodable, Sendable {
    let year: Int
    let month: Int
    let calendar: PublicCalendarMeta
    let events: [PublicCalendarEvent]
}

struct PublicCalendarMeta: Decodable, Sendable {
    let id: String
    let name: String
    let color: String
    let visibility: String
    let goalTitle: String?
    let goalTargetHours: Double?

    var displayColor: Color { Color(hexString: color) ?? Theme.accent }
}

struct PublicCalendarEvent: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let startAt: String
    let endAt: String
    let allDay: Bool
    let tentative: Bool

    var startDate: Date? { APIDateParser.parse(startAt) }
    var endDate: Date? { APIDateParser.parse(endAt) }
}

// MARK: - 화면

/// 캘린더 상세 — 프로필의 캘린더 카드를 탭하면 열린다.
/// 월 그리드에서 날짜를 고르면 그 날의 일정이 아래에 나온다.
/// 내 캘린더면 전체, 남의 캘린더면 공개 범위가 허용하는 것만 서버가 준다.
struct CalendarDetailView: View {
    let username: String
    let calendarId: String
    let calendarName: String

    @State private var data: CalendarEventsResponsePublic?
    @State private var month: Date = Date()
    @State private var selectedDay: Date?
    @State private var isLoading = false

    private var calendar: Calendar { CalendarViewModel.calendar }

    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        return formatter
    }()

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E)"
        return formatter
    }()

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()


    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    monthHeader
                    weekdayHeader
                    monthGrid
                    Divider().overlay(Theme.fill(0.08))
                    dayEvents
                }
                .padding(16)
            }
            .refreshable { await load(force: true) }
        }
        .navigationTitle(data?.calendar.name ?? calendarName)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: monthKey) { await load() }
    }

    private var monthKey: String {
        "\(calendar.component(.year, from: month))-\(calendar.component(.month, from: month))"
    }

    // MARK: - 헤더

    @ViewBuilder
    private var header: some View {
        if let meta = data?.calendar {
            HStack(spacing: 8) {
                Circle().fill(meta.displayColor).frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 2) {
                    Text(meta.name)
                        .font(.headline)
                        .foregroundStyle(Theme.primaryText)
                    if let goal = meta.goalTitle, !goal.isEmpty {
                        Text(goal)
                            .font(.caption)
                            .foregroundStyle(meta.displayColor)
                    }
                }
                Spacer(minLength: 0)
                Text(visibilityLabel(meta.visibility))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func visibilityLabel(_ value: String) -> String {
        switch value {
        case "public": return "전체 공개"
        case "followers": return "팔로워 공개"
        default: return "비공개"
        }
    }

    // MARK: - 월 그리드

    private var monthHeader: some View {
        HStack {
            Button {
                shiftMonth(-1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 40, height: 36)
            }
            Spacer()
            Text(Self.monthFormatter.string(from: month))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
            Spacer()
            Button {
                shiftMonth(1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .frame(width: 40, height: 36)
            }
            if isLoading {
                ProgressView().tint(Theme.secondaryText)
            }
        }
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(AppSettings.shared.weekStart.symbols, id: \.self) { symbol in
                Text(symbol)
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var monthGrid: some View {
        let firstDay = calendar.date(
            from: calendar.dateComponents([.year, .month], from: month)
        ) ?? month
        let dayCount = calendar.range(of: .day, in: .month, for: firstDay)?.count ?? 30
        let leading = calendar.leadingBlankDays(forMonthContaining: firstDay)
        let color = data?.calendar.displayColor ?? Theme.accent

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7),
            spacing: 6
        ) {
            ForEach(0..<leading, id: \.self) { _ in
                Color.clear.frame(height: 38)
            }
            ForEach(1...dayCount, id: \.self) { day in
                let date = calendar.date(byAdding: .day, value: day - 1, to: firstDay)!
                let count = eventCount(on: date)
                let isSelected = selectedDay.map { calendar.isDate($0, inSameDayAs: date) } ?? false
                Button {
                    selectedDay = date
                } label: {
                    VStack(spacing: 3) {
                        Text("\(day)")
                            .font(.subheadline.weight(count > 0 ? .semibold : .regular))
                            .foregroundStyle(
                                isSelected ? Color.white
                                    : (count > 0 ? Theme.primaryText : Theme.secondaryText)
                            )
                        Circle()
                            .fill(count > 0 ? color : .clear)
                            .frame(width: 4, height: 4)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(
                        isSelected ? color.opacity(0.85) : .clear,
                        in: RoundedRectangle(cornerRadius: 8)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - 선택일 일정

    @ViewBuilder
    private var dayEvents: some View {
        let day = selectedDay
        let list = day.map { events(on: $0) } ?? (data?.events ?? [])
        VStack(alignment: .leading, spacing: 8) {
            Text(day.map(Self.dayFormatter.string(from:)) ?? "이번 달 일정")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)

            if list.isEmpty {
                Text(day == nil ? "이 달에는 일정이 없어요" : "이 날은 일정이 없어요")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            } else {
                ForEach(list) { event in
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(data?.calendar.displayColor ?? Theme.accent)
                            .frame(width: 3, height: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Theme.primaryText)
                                .lineLimit(2)
                            Text(timeText(event))
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
    }

    private func timeText(_ event: PublicCalendarEvent) -> String {
        guard let start = event.startDate else { return "" }
        if event.allDay { return "종일" }
        let startText = Self.timeFormatter.string(from: start)
        guard let end = event.endDate, end > start else { return startText }
        return "\(startText) – \(Self.timeFormatter.string(from: end))"
    }

    // MARK: - 데이터

    private func events(on date: Date) -> [PublicCalendarEvent] {
        (data?.events ?? []).filter { event in
            guard let start = event.startDate else { return false }
            return calendar.isDate(start, inSameDayAs: date)
        }
    }

    private func eventCount(on date: Date) -> Int { events(on: date).count }

    private func shiftMonth(_ delta: Int) {
        if let next = calendar.date(byAdding: .month, value: delta, to: month) {
            month = next
            selectedDay = nil
        }
    }

    private func load(force: Bool = false) async {
        if !force, data != nil, isCurrentMonthLoaded { return }
        isLoading = true
        defer { isLoading = false }
        let year = calendar.component(.year, from: month)
        let monthNumber = calendar.component(.month, from: month)
        if let response: CalendarEventsResponsePublic = try? await APIClient.shared.get(
            "/api/v1/users/\(username)/calendars/\(calendarId)/events?year=\(year)&month=\(monthNumber)"
        ) {
            data = response
        }
    }

    private var isCurrentMonthLoaded: Bool {
        guard let data else { return false }
        return data.year == calendar.component(.year, from: month)
            && data.month == calendar.component(.month, from: month)
    }
}
