import SwiftUI

// MARK: - 모델 (GET /api/v1/users/{username}/calendars)

struct ProfileCalendarsResponse: Decodable, Sendable {
    let year: Int
    let month: Int
    let calendars: [ProfileCalendar]
}

/// 프로필에 카드로 그릴 캘린더 — 이번 달 "일정 있는 날"만 온다 (제목은 비공개).
struct ProfileCalendar: Decodable, Identifiable, Sendable {
    let id: String
    let name: String
    let color: String
    let purpose: String
    let visibility: String
    let source: String
    let isDefault: Bool
    let goalTitle: String?
    let goalTargetHours: Double?
    let goalDeadline: String?
    let activeDays: [Int]
    let eventCount: Int

    var displayColor: Color { Color(hexString: color) ?? Theme.accent }
    var isPublic: Bool { visibility != "private" }

    var visibilityLabel: String {
        switch visibility {
        case "public": return "전체 공개"
        case "followers": return "팔로워 공개"
        default: return "비공개"
        }
    }
}

// MARK: - 섹션

/// 프로필의 캘린더 카드 — 미니 월 그리드로 "이 사람이 이 캘린더를 얼마나 쓰는지"를 보여준다.
/// 내 프로필이면 전체, 타인 프로필이면 공개 범위에 맞는 것만 서버가 걸러 준다.
struct CalendarCardsSection: View {
    let username: String
    /// 내 프로필이면 "관리" 링크를 띄운다.
    let isMe: Bool

    @State private var response: ProfileCalendarsResponse?

    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        return formatter
    }()

    var body: some View {
        if let response, !response.calendars.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(isMe ? "내 캘린더" : "캘린더")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.secondaryText)
                    Spacer()
                    if isMe {
                        NavigationLink {
                            CalendarSettingsView()
                        } label: {
                            Text("관리")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.accent)
                        }
                        .buttonStyle(.plain)
                    }
                }

                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
                    spacing: 10
                ) {
                    ForEach(response.calendars) { calendar in
                        card(calendar, year: response.year, month: response.month)
                    }
                }
            }
            .task(id: username) { await load() }
        } else {
            Color.clear
                .frame(height: 0)
                .task(id: username) { await load() }
        }
    }

    private func load() async {
        if let result: ProfileCalendarsResponse = try? await APIClient.shared.get(
            "/api/v1/users/\(username)/calendars"
        ) {
            response = result
        }
    }

    // MARK: - 카드

    private func card(_ calendar: ProfileCalendar, year: Int, month: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle()
                    .fill(calendar.displayColor)
                    .frame(width: 8, height: 8)
                Text(calendar.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Spacer(minLength: 0)
                if !calendar.isPublic {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.secondaryText)
                }
            }

            if let goal = calendar.goalTitle, !goal.isEmpty {
                Text(goal)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(calendar.displayColor)
                    .lineLimit(1)
            }

            miniMonth(calendar: calendar, year: year, month: month)

            HStack(spacing: 4) {
                Text("이번 달 \(calendar.eventCount)개")
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                Spacer(minLength: 0)
                Text(calendar.visibilityLabel)
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    /// 이번 달 그리드 — 일정 있는 날만 캘린더 색으로 채운다.
    private func miniMonth(calendar: ProfileCalendar, year: Int, month: Int) -> some View {
        let cal = Calendar(identifier: .gregorian)
        let firstDay = cal.date(from: DateComponents(year: year, month: month, day: 1)) ?? Date()
        let dayCount = cal.range(of: .day, in: .month, for: firstDay)?.count ?? 30
        let leading = cal.component(.weekday, from: firstDay) - 1
        let active = Set(calendar.activeDays)

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7),
            spacing: 3
        ) {
            ForEach(0..<leading, id: \.self) { _ in
                Circle().fill(.clear).frame(height: 8)
            }
            ForEach(1...dayCount, id: \.self) { day in
                Circle()
                    .fill(active.contains(day)
                          ? calendar.displayColor
                          : Theme.fill(0.08))
                    .frame(height: 8)
            }
        }
    }
}
