import SwiftUI

// MARK: - 반복 규칙 (1.5.1)

/// 앱이 만드는 반복 — 안 함 / 매일 / 매주(요일 여러 개) / 매월(같은 날) / 매년.
/// 서버·구글과 같은 RFC 5545 RRULE 문자열로 주고받는다.
@MainActor
struct RepeatRule: Equatable {
    enum Freq: String, CaseIterable, Identifiable {
        case none, daily, weekly, monthly, yearly
        var id: String { rawValue }
        var label: String {
            switch self {
            case .none: "안 함"
            case .daily: "매일"
            case .weekly: "매주"
            case .monthly: "매월"
            case .yearly: "매년"
            }
        }
    }

    enum End: Equatable {
        case forever
        case until(Date)
        case count(Int)
    }

    var freq: Freq = .none
    /// 매주 — Calendar weekday (1 = 일 … 7 = 토)
    var weekdays: Set<Int> = []
    var end: End = .forever
    /// 매년일 때만 — 기념일(n주년 표시, 2월 29일은 평년 2월 28일)
    var anniversary = false

    var isRepeating: Bool { freq != .none }

    private static let codes = [1: "SU", 2: "MO", 3: "TU", 4: "WE", 5: "TH", 6: "FR", 7: "SA"]

    /// RRULE 본문 ("RRULE:" 없이). 반복 안 함이면 nil.
    func rrule(start: Date, allDay: Bool) -> String? {
        var parts: [String]
        switch freq {
        case .none: return nil
        case .daily: parts = ["FREQ=DAILY"]
        case .weekly:
            let cal = CalendarViewModel.calendar
            let days = weekdays.isEmpty ? [cal.component(.weekday, from: start)] : weekdays.sorted()
            parts = ["FREQ=WEEKLY", "BYDAY=" + days.compactMap { Self.codes[$0] }.joined(separator: ",")]
        case .monthly: parts = ["FREQ=MONTHLY"]
        case .yearly: parts = ["FREQ=YEARLY"]
        }
        switch end {
        case .forever: break
        case .count(let n): parts.append("COUNT=\(max(1, n))")
        case .until(let date): parts.append("UNTIL=" + Self.untilString(date, allDay: allDay))
        }
        return parts.joined(separator: ";")
    }

    /// 그날(한국 시간)이 끝날 때까지 — 종일은 날짜, 시간 일정은 UTC 시각(구글 규칙)
    private static func untilString(_ date: Date, allDay: Bool) -> String {
        let cal = CalendarViewModel.calendar
        let day = cal.startOfDay(for: date)
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        if allDay {
            f.timeZone = cal.timeZone
            f.dateFormat = "yyyyMMdd"
            return f.string(from: day)
        }
        let endOfDay = cal.date(byAdding: .second, value: 86_399, to: day) ?? day
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        return f.string(from: endOfDay)
    }

    /// 서버가 준 RRULE → 화면 값. 앱이 못 만드는 규칙(격주 등)이면 nil — 수정 화면은 반복 칸을 잠근다.
    init?(rrule raw: String?, isAnniversary: Bool) {
        guard let raw, !raw.isEmpty else { return nil }
        var fields: [String: String] = [:]
        for part in raw.replacingOccurrences(of: "RRULE:", with: "").split(separator: ";") {
            let kv = part.split(separator: "=", maxSplits: 1).map(String.init)
            if kv.count == 2 { fields[kv[0].uppercased()] = kv[1].uppercased() }
        }
        let known: Set<String> = ["FREQ", "BYDAY", "COUNT", "UNTIL", "INTERVAL", "WKST"]
        guard fields.keys.allSatisfy(known.contains), (fields["INTERVAL"] ?? "1") == "1" else { return nil }
        switch fields["FREQ"] {
        case "DAILY": freq = .daily
        case "WEEKLY": freq = .weekly
        case "MONTHLY": freq = .monthly
        case "YEARLY": freq = .yearly
        default: return nil
        }
        if let byDay = fields["BYDAY"] {
            guard freq == .weekly else { return nil }
            let reverse = Dictionary(uniqueKeysWithValues: Self.codes.map { ($1, $0) })
            let days = byDay.split(separator: ",").map { reverse[String($0)] }
            guard days.allSatisfy({ $0 != nil }) else { return nil }
            weekdays = Set(days.compactMap { $0 })
        }
        if let count = fields["COUNT"], let n = Int(count) {
            end = .count(n)
        } else if let until = fields["UNTIL"], let date = Self.parseUntil(until) {
            end = .until(date)
        }
        anniversary = freq == .yearly && isAnniversary
    }

    nonisolated init() {}

    private static func parseUntil(_ v: String) -> Date? {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        if v.count == 8 {
            f.timeZone = CalendarViewModel.calendar.timeZone
            f.dateFormat = "yyyyMMdd"
        } else {
            f.timeZone = TimeZone(identifier: "UTC")
            f.dateFormat = "yyyyMMdd'T'HHmmss"
        }
        return f.date(from: v.replacingOccurrences(of: "Z", with: ""))
    }

    /// 상세 화면 한 줄 — "매주 월·수 · 6회"
    func summary(start: Date) -> String {
        let cal = CalendarViewModel.calendar
        var text: String
        switch freq {
        case .none: return "반복 안 함"
        case .daily: text = "매일"
        case .weekly:
            let names = ["", "일", "월", "화", "수", "목", "금", "토"]
            let days = weekdays.isEmpty ? [cal.component(.weekday, from: start)] : weekdays.sorted { ($0 + 5) % 7 < ($1 + 5) % 7 }
            text = "매주 " + days.map { names[$0] }.joined(separator: "·")
        case .monthly: text = "매월 \(cal.component(.day, from: start))일"
        case .yearly:
            text = "매년 \(cal.component(.month, from: start))월 \(cal.component(.day, from: start))일"
            if anniversary { text += " · 기념일" }
        }
        switch end {
        case .forever: break
        case .count(let n): text += " · \(n)회"
        case .until(let d): text += " · \(d.formatted(.dateTime.month().day().locale(Locale(identifier: "ko_KR"))))까지"
        }
        return text
    }
}

// MARK: - 반복 칸 (만들기·수정 공용)

struct RepeatSection: View {
    @Binding var rule: RepeatRule
    let start: Date
    /// 앱이 못 만드는 규칙이거나 '이 일정만' 범위라 바꿀 수 없을 때 — 이유 한 줄
    var lockedReason: String?

    private enum EndKind: String, CaseIterable, Identifiable {
        case forever, until, count
        var id: String { rawValue }
        var label: String {
            switch self {
            case .forever: "계속"
            case .until: "날짜까지"
            case .count: "횟수"
            }
        }
    }

    private var endKind: Binding<EndKind> {
        Binding {
            switch rule.end {
            case .forever: .forever
            case .until: .until
            case .count: .count
            }
        } set: { kind in
            switch kind {
            case .forever: rule.end = .forever
            case .until:
                let d = CalendarViewModel.calendar.date(byAdding: .month, value: 3, to: start) ?? start
                rule.end = .until(d)
            case .count: rule.end = .count(10)
            }
        }
    }

    var body: some View {
        Section {
            Picker("반복", selection: $rule.freq) {
                ForEach(RepeatRule.Freq.allCases) { Text($0.label).tag($0) }
            }
            .disabled(lockedReason != nil)
            .accessibilityIdentifier("repeat.freq")

            if rule.isRepeating, lockedReason == nil {
                if rule.freq == .weekly { weekdayRow }
                if rule.freq == .yearly {
                    Toggle("기념일", isOn: $rule.anniversary)
                        .tint(Theme.accent)
                        .accessibilityIdentifier("repeat.anniversary")
                }
                Picker("끝", selection: endKind) {
                    ForEach(EndKind.allCases) { Text($0.label).tag($0) }
                }
                .accessibilityIdentifier("repeat.end")
                switch rule.end {
                case .until(let date):
                    DatePicker(
                        "마지막 날",
                        selection: Binding { date } set: { rule.end = .until($0) },
                        in: start...,
                        displayedComponents: [.date]
                    )
                case .count(let n):
                    Stepper(value: Binding { n } set: { rule.end = .count($0) }, in: 2...365) {
                        Text("\(n)회")
                    }
                case .forever:
                    EmptyView()
                }
            }
        } footer: {
            if let lockedReason {
                Text(lockedReason).foregroundStyle(Theme.secondaryText)
            } else if rule.freq == .monthly, CalendarViewModel.calendar.component(.day, from: start) > 28 {
                Text("그 날짜가 없는 달은 건너뛰어요.").foregroundStyle(Theme.secondaryText)
            } else if rule.anniversary {
                Text("하루 보기·달력·상세에 몇 주년인지 보여요. 2월 29일은 평년에 2월 28일로 와요.")
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .listRowBackground(Theme.surface)
        .onChange(of: rule.freq) { _, freq in
            if freq == .weekly, rule.weekdays.isEmpty {
                rule.weekdays = [CalendarViewModel.calendar.component(.weekday, from: start)]
            }
            if freq != .yearly { rule.anniversary = false }
        }
    }

    private var weekdayRow: some View {
        let order = [2, 3, 4, 5, 6, 7, 1]
        let names = ["", "일", "월", "화", "수", "목", "금", "토"]
        return HStack(spacing: 6) {
            ForEach(order, id: \.self) { day in
                let on = rule.weekdays.contains(day)
                Button {
                    if on { if rule.weekdays.count > 1 { rule.weekdays.remove(day) } } else { rule.weekdays.insert(day) }
                } label: {
                    Text(names[day])
                        .font(.subheadline.weight(on ? .semibold : .regular))
                        .frame(maxWidth: .infinity, minHeight: 34)
                        .foregroundStyle(on ? Color.white : Theme.primaryText)
                        .background(Circle().fill(on ? Theme.accent : Theme.fill(0.06)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(names[day])요일")
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - 고치기·지우기 범위

enum RecurrenceScope: String {
    case this, following, all
}

/// 반복 회차를 고치거나 지울 때 범위 묻기 — Orbit42: 이 일정만/이후 모두/모두, 구글: 이 일정만/모두
struct RecurrenceScopeDialog: ViewModifier {
    let title: String
    @Binding var isPresented: Bool
    let isGoogle: Bool
    /// 반복 규칙을 바꾼 수정은 '이 일정만'을 고를 수 없다
    var allowThis = true
    var destructive = false
    let onPick: (RecurrenceScope) -> Void

    func body(content: Content) -> some View {
        content.confirmationDialog(title, isPresented: $isPresented, titleVisibility: .visible) {
            if allowThis {
                Button("이 일정만", role: destructive ? .destructive : nil) { onPick(.this) }
            }
            if !isGoogle {
                Button("이후 모두", role: destructive ? .destructive : nil) { onPick(.following) }
            }
            Button("모두", role: destructive ? .destructive : nil) { onPick(.all) }
            Button("취소", role: .cancel) {}
        } message: {
            if isGoogle {
                Text(allowThis ? "이후 모두는 구글 캘린더 앱에서 해 주세요." : "반복 규칙을 바꾸면 모든 회차에 적용돼요. 이후 모두는 구글 캘린더 앱에서 해 주세요.")
            } else if !allowThis {
                Text("반복 규칙을 바꾸면 이 일정만은 고를 수 없어요.")
            }
        }
    }
}

extension View {
    func recurrenceScopeDialog(
        _ title: String,
        isPresented: Binding<Bool>,
        isGoogle: Bool,
        allowThis: Bool = true,
        destructive: Bool = false,
        onPick: @escaping (RecurrenceScope) -> Void
    ) -> some View {
        modifier(RecurrenceScopeDialog(title: title, isPresented: isPresented, isGoogle: isGoogle, allowThis: allowThis, destructive: destructive, onPick: onPick))
    }
}

/// GET /api/v1/calendar/events/{id}/series
struct SeriesInfo: Decodable {
    let rrule: String?
    let isAnniversary: Bool
    /// 구글만 — '모두'로 시간을 바꾸면 구글이 원래대로 돌리는 회차 수, 참석자 수
    let modifiedCount: Int?
    let cancelledCount: Int?
    let attendeeCount: Int?
}

/// 기념일 n주년 표시 — 하루 보기·달력·상세 공용
struct AnniversaryBadge: View {
    let years: Int
    var compact = false

    var body: some View {
        Text("\(years)주년")
            .font((compact ? Font.caption2 : Font.caption).weight(.semibold))
            .foregroundStyle(Theme.accent)
            .padding(.horizontal, compact ? 4 : 6)
            .padding(.vertical, compact ? 1 : 2)
            .background(Theme.accent.opacity(0.12), in: Capsule())
            .accessibilityLabel("\(years)주년")
    }
}
