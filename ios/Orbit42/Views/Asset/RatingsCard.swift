import SwiftUI

// MARK: - 응답 (GET /api/v1/ratings — 본인만)

struct RatingsSummary: Decodable {
    struct WeekAverage: Decodable {
        let average: Double?
        let count: Int
    }
    struct Item: Decodable, Identifiable {
        let eventId: String
        let title: String?
        let startAt: String?
        let calendarId: String?
        let rating: Int
        let ratingNote: String?
        let missing: Bool
        var id: String { eventId }
    }
    struct CalendarAverage: Decodable, Identifiable {
        let calendarId: String?
        let average: Double?
        let count: Int
        var id: String { calendarId ?? "_missing" }
    }
    let weeks: Int
    let thisWeek: WeekAverage
    let lastWeek: WeekAverage
    let top: [Item]
    let bottom: [Item]
    let byCalendar: [CalendarAverage]
    let average: Double?
    let total: Int
}

/// 리포트 탭의 별점 카드 — 이번 주·지난주 평균과 캘린더별 평균. 나만 본다(서버도 본인 것만 준다).
struct RatingsCard: View {
    @State private var summary: RatingsSummary?
    @State private var calendars: [CalendarInfo] = []
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("별점")
                    .font(.headline)
                    .foregroundStyle(Theme.primaryText)
                Label("나만 봐요", systemImage: "lock")
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                Spacer()
                if let summary, summary.total > 0 {
                    NavigationLink {
                        RatingsListView(summary: summary, calendars: calendars)
                    } label: {
                        Text("모두 보기")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            if let summary {
                if summary.total == 0 {
                    Text("일정을 완료로 표시하면 별점을 남길 수 있어요. 남긴 별점이 여기 모여요.")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                } else {
                    HStack(spacing: 12) {
                        weekBox("이번 주", summary.thisWeek)
                        weekBox("지난주", summary.lastWeek)
                    }
                    if !summary.byCalendar.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("캘린더별 평균 · 지난 \(summary.weeks)주")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                            ForEach(summary.byCalendar) { row in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(calendar(row.calendarId)?.displayColor ?? Theme.secondaryText)
                                        .frame(width: 8, height: 8)
                                    Text(calendar(row.calendarId)?.name ?? (row.calendarId == nil ? "지워진 일정" : "다른 캘린더"))
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.primaryText)
                                        .lineLimit(1)
                                    Spacer()
                                    stars(row.average)
                                    Text("\(row.count)개")
                                        .font(.caption)
                                        .foregroundStyle(Theme.secondaryText)
                                        .frame(minWidth: 30, alignment: .trailing)
                                }
                            }
                        }
                    }
                }
            } else if failed {
                Text("별점을 불러오지 못했어요.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            } else {
                ProgressView().tint(Theme.accent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .task { await load() }
    }

    private func load() async {
        async let s: RatingsSummary? = try? APIClient.shared.get("/api/v1/ratings")
        async let c: CalendarsResponse? = try? APIClient.shared.get("/api/v1/calendars")
        let (summaryResult, calendarResult) = await (s, c)
        summary = summaryResult
        failed = summaryResult == nil
        calendars = calendarResult?.calendars ?? []
    }

    private func calendar(_ id: String?) -> CalendarInfo? {
        guard let id else { return nil }
        return calendars.first { $0.id == id }
    }

    private func weekBox(_ title: String, _ week: RatingsSummary.WeekAverage) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Image(systemName: "star.fill").foregroundStyle(Color.orange).font(.subheadline)
                Text(week.average.map { String(format: "%.1f", $0) } ?? "–")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                Text("\(week.count)개")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Theme.fill(0.05), in: RoundedRectangle(cornerRadius: 10))
    }

    private func stars(_ value: Double?) -> some View {
        HStack(spacing: 2) {
            Image(systemName: "star.fill").font(.caption2).foregroundStyle(Color.orange)
            Text(value.map { String(format: "%.1f", $0) } ?? "–")
                .font(.subheadline.weight(.medium).monospacedDigit())
                .foregroundStyle(Theme.primaryText)
        }
    }
}

/// 별점 높은·낮은 일정 목록 — 지워졌거나 구글 연결이 끊긴 일정은 "지워진 일정"으로 남는다.
struct RatingsListView: View {
    let summary: RatingsSummary
    let calendars: [CalendarInfo]

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M월 d일 (E) a h:mm"
        return f
    }()

    var body: some View {
        List {
            Section("별점 높은 일정") { rows(summary.top, empty: "별 4개 이상 준 일정이 없어요.") }
                .listRowBackground(Theme.surface)
            Section("별점 낮은 일정") { rows(summary.bottom, empty: "별 2개 이하 준 일정이 없어요.") }
                .listRowBackground(Theme.surface)
            Section {
                EmptyView()
            } footer: {
                Text("지난 \(summary.weeks)주 동안 남긴 별점이에요. 나만 볼 수 있어요.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("별점")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func rows(_ items: [RatingsSummary.Item], empty: String) -> some View {
        if items.isEmpty {
            Text(empty).font(.footnote).foregroundStyle(Theme.secondaryText)
        } else {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(item.missing ? "지워진 일정" : (item.title ?? ""))
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(item.missing ? Theme.secondaryText : Theme.primaryText)
                            .lineLimit(1)
                        Spacer()
                        HStack(spacing: 1) {
                            ForEach(0..<item.rating, id: \.self) { _ in
                                Image(systemName: "star.fill").font(.caption2).foregroundStyle(Color.orange)
                            }
                        }
                        .accessibilityLabel("별점 \(item.rating)")
                    }
                    HStack(spacing: 6) {
                        if let cal = calendars.first(where: { $0.id == item.calendarId }) {
                            Circle().fill(cal.displayColor).frame(width: 7, height: 7)
                            Text(cal.name).font(.caption).foregroundStyle(Theme.secondaryText).lineLimit(1)
                        }
                        if let raw = item.startAt, let date = APIDateParser.parse(raw) {
                            Text(Self.dateFormatter.string(from: date)).font(.caption).foregroundStyle(Theme.secondaryText)
                        }
                    }
                    if let note = item.ratingNote, !note.isEmpty {
                        Text(note).font(.footnote).foregroundStyle(Theme.secondaryText).lineLimit(2)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }
}
