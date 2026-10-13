import SwiftUI
import WidgetKit

@main
struct Orbit42WidgetBundle: WidgetBundle {
    var body: some Widget {
        MonthUpcomingWidget()
        TodayTomorrowWidget()
        NextEventWidget()
    }
}

private extension View {
    /// 위젯 배경(다크 모드 대응) + 기본 탭 동작: 오늘 날짜의 캘린더
    func orbitWidgetChrome(_ entry: CalendarEntry, url: URL? = nil) -> some View {
        self
            .widgetURL(url ?? SharedConfig.calendarURL(for: entry.date))
            .containerBackground(for: .widget) { Color(uiColor: .systemBackground) }
    }
}

struct MonthUpcomingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "org.orbit42.widget.month", provider: CalendarProvider()) { entry in
            MonthUpcomingView(entry: entry).orbitWidgetChrome(entry)
        }
        .configurationDisplayName("월간 달력")
        .description("이번 달 달력과 다가오는 일정 3개")
        .supportedFamilies([.systemMedium])
    }
}

struct TodayTomorrowWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "org.orbit42.widget.today", provider: CalendarProvider()) { entry in
            TodayTomorrowView(entry: entry).orbitWidgetChrome(entry)
        }
        .configurationDisplayName("오늘과 내일")
        .description("오늘 일정과 내일 일정을 한 번에")
        .supportedFamilies([.systemMedium])
    }
}

struct NextEventWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "org.orbit42.widget.next", provider: CalendarProvider()) { entry in
            NextEventView(entry: entry)
                .orbitWidgetChrome(entry, url: entry.upcoming(limit: 1).first.map {
                    SharedConfig.calendarURL(for: max($0.start, entry.calendar.startOfDay(for: entry.date)))
                })
        }
        .configurationDisplayName("다음 일정")
        .description("오늘 날짜와 바로 다음 일정")
        .supportedFamilies([.systemSmall])
    }
}

#Preview(as: .systemMedium) {
    MonthUpcomingWidget()
} timeline: {
    CalendarProvider.sampleEntry()
}

#Preview(as: .systemMedium) {
    TodayTomorrowWidget()
} timeline: {
    CalendarProvider.sampleEntry()
}

#Preview(as: .systemSmall) {
    NextEventWidget()
} timeline: {
    CalendarProvider.sampleEntry()
}
