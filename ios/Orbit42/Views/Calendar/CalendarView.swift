import SwiftUI

/// 캘린더 탭 — 월 그리드 + 선택된 날짜의 이벤트 목록.
struct CalendarView: View {
    @State private var viewModel = CalendarViewModel()
    @State private var showingAddSheet = false
    @State private var selectedEvent: CalendarEvent?

    private var calendar: Calendar { CalendarViewModel.calendar }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    monthHeader
                    weekdayHeader
                    monthGrid
                    Divider()
                        .overlay(Color.white.opacity(0.08))
                        .padding(.top, 8)
                    eventListSection
                }
            }
            .navigationTitle("캘린더")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("오늘") {
                        withAnimation { viewModel.showToday() }
                    }
                    .font(.subheadline.weight(.medium))
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
            .sheet(isPresented: $showingAddSheet) {
                AddEventSheet(viewModel: viewModel, defaultDate: viewModel.selectedDate)
                    .preferredColorScheme(.dark)
            }
            .sheet(item: $selectedEvent) { event in
                EventDetailSheet(viewModel: viewModel, event: event)
                    .preferredColorScheme(.dark)
            }
            .task(id: viewModel.currentMonthKey) {
                await viewModel.loadDisplayedMonth()
            }
        }
    }

    // MARK: - 월 헤더

    private var monthHeader: some View {
        HStack {
            Button {
                withAnimation { viewModel.showPreviousMonth() }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("이전 달")

            Spacer()

            Text(Self.monthTitleFormatter.string(from: viewModel.displayedMonth))
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)

            Spacer()

            Button {
                withAnimation { viewModel.showNextMonth() }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("다음 달")
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
    }

    // MARK: - 요일 헤더 (일요일 시작)

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(Array(Self.weekdaySymbols.enumerated()), id: \.offset) { index, symbol in
                Text(symbol)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(weekdayColor(at: index))
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
    }

    private func weekdayColor(at index: Int) -> Color {
        switch index {
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
                        viewModel.selectedDate = day
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
        let leading = (calendar.component(.weekday, from: first) - calendar.firstWeekday + 7) % 7
        var days: [Date?] = Array(repeating: nil, count: leading)
        for offset in 0..<range.count {
            days.append(calendar.date(byAdding: .day, value: offset, to: first))
        }
        while days.count % 7 != 0 { days.append(nil) }
        return days
    }

    // MARK: - 이벤트 목록

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
                        .foregroundStyle(.white)
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
                        Button {
                            selectedEvent = event
                        } label: {
                            EventRow(event: event, calendars: viewModel.calendars)
                        }
                        .buttonStyle(.plain)
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

    private static let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]
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
        return .white.opacity(0.9)
    }
}

// MARK: - 이벤트 행

private struct EventRow: View {
    let event: CalendarEvent
    let calendars: [CalendarInfo]

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2)
                .fill(event.displayColor(in: calendars))
                .frame(width: 4)
                .frame(maxHeight: .infinity)

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(event.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    if event.isGoogle {
                        Text("Google")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.secondaryText)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.08), in: Capsule())
                    }
                }
                Text(timeText)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                if let description = event.description, !description.isEmpty {
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .opacity(event.tentative ? 0.65 : 1)
        .fixedSize(horizontal: false, vertical: true)
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
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
