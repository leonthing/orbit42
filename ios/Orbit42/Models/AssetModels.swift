import SwiftUI

// MARK: - 시간 자산 설정 (GET/PUT /api/v1/time-asset/settings)

/// 수입 설정 — 월급/시급/프리랜서와 금액, 서버가 계산한 시급 환산값 + 버킷 분류 설정.
struct TimeAssetSettings: Decodable {
    /// "monthly" | "hourly" | "freelance" | nil(미설정)
    let incomeType: String?
    /// freelance 면 null — 월별 수입 기록으로 실효 시급을 계산한다.
    let amount: Int?
    /// 프리랜서 월별 수입 기록 (최신순 12개, freelance 가 아니어도 내려올 수 있음)
    let incomeEntries: [IncomeEntry]?
    let hourlyValueKrw: Int?
    /// 월 근로시간 기준 (주휴 포함 209시간)
    let monthlyWorkHours: Int?
    /// 하루 수면 시간 (0~14, 0.5 단위 — 구 서버 응답에는 없을 수 있음)
    let sleepHoursPerDay: Double?
    /// 용도(purpose) → 버킷 유효 매핑 (기본값 + 사용자 오버라이드)
    let bucketMap: [String: String]?
    /// 분류 설정 화면용 메타 — 용도 한국어 라벨과 기본 버킷
    let purposes: [PurposeMeta]?
    /// 버킷 선택지 (수입/투자/소비/생활 + 색)
    let bucketOptions: [BucketOptionMeta]?
    /// 주간 목표 (미설정이면 null)
    let weeklyEarnGoalKrw: Int?
    let weeklyInvestGoalHours: Double?
}

struct PurposeMeta: Decodable, Identifiable {
    let key: String
    let label: String
    let defaultBucket: String

    var id: String { key }
}

struct BucketOptionMeta: Decodable, Identifiable {
    let key: String
    let label: String
    let color: String

    var id: String { key }

    var swiftUIColor: Color {
        Color(hexString: color) ?? Theme.accent
    }
}

struct UpdateTimeAssetSettingsRequest: Encodable {
    var incomeType: String?
    var amount: Int?
    /// 용도 → 버킷 전체 맵 (서버가 기본값과 같은 항목은 알아서 정리)
    var bucketMap: [String: String]?
    /// 하루 수면 시간 (0~14, 0.5 단위) — 단독 전송 가능
    var sleepHoursPerDay: Double?
}

// MARK: - 월별 수입 기록 (PUT/DELETE /api/v1/time-asset/income-entries)

/// 프리랜서 월별 수입 한 건 — settings 의 incomeEntries, summary 의 freelance.months 공용.
struct IncomeEntry: Decodable, Identifiable {
    /// "YYYY-MM"
    let month: String
    let amountKrw: Int

    var id: String { month }
}

/// `PUT /api/v1/time-asset/income-entries`
struct UpsertIncomeEntryRequest: Encodable {
    let month: String
    let amountKrw: Int
}

/// PUT/DELETE 공통 응답 — `{"entries":[...최신순]}`
struct IncomeEntriesResponse: Decodable {
    let entries: [IncomeEntry]
}

// MARK: - 시간 자산 요약 (GET /api/v1/time-asset/summary)

/// 내 1시간의 하루/주/월/연 환산 금액.
struct TimeAssetConversions: Decodable {
    let day: Int
    let week: Int
    let month: Int
    let year: Int
}

/// 이번 주 시간 사용 버킷 (수입/투자/소비/생활).
struct TimeAssetBucket: Decodable, Identifiable {
    let key: String
    let label: String
    let description: String
    /// "#6366f1" 형태 hex — 서버가 색을 내려준다.
    let color: String
    let hours: Double
    let valueKrw: Int?
    /// 기록된 시간 중 이 버킷의 비율 (0...1)
    let ratio: Double

    var id: String { key }

    var swiftUIColor: Color {
        Color(hexString: color) ?? Theme.accent
    }
}

/// 주별 추이 한 칸 — 버킷 key → 시간.
struct TimeAssetTrendWeek: Decodable, Identifiable {
    let weekStart: String
    let hoursByBucket: [String: Double]

    var id: String { weekStart }

    var totalHours: Double {
        hoursByBucket.values.reduce(0, +)
    }
}

/// 타임슬롯으로 실제 판매(거래)된 시간 집계.
struct TimeAssetTraded: Decodable {
    let totalBookings: Int
    let totalHours: Double
    let totalKrw: Int
    let impliedHourlyKrw: Int?
    /// 판매 단가가 내 기준 시급의 몇 배인지
    let vsIncomeRatio: Double?
}

/// 프리랜서 실효 시급 계산 근거 — 최근 수입 기록과 같은 기간의 '수입' 시간.
struct TimeAssetFreelance: Decodable {
    let months: [IncomeEntry]
    let totalKrw: Int
    let earnHours: Double
    /// 수입 시간이 1시간 미만이면 null (아직 계산 불가)
    let effectiveHourlyKrw: Int?
}

struct TimeAssetSummary: Decodable {
    /// "monthly" | "hourly" | "freelance" | nil(미설정)
    let incomeType: String?
    /// freelance 면 실효 시급(계산값) — 수입 시간이 부족하면 null.
    let hourlyValueKrw: Int?
    /// incomeType == "freelance" 일 때의 계산 근거 (그 외에는 null)
    let freelance: TimeAssetFreelance?
    let conversions: TimeAssetConversions?
    let weekStart: String
    let buckets: [TimeAssetBucket]
    let scheduledHours: Double
    /// 수면을 뺀 나머지 미기록 시간 (구 응답에서는 수면 포함 전체 미기록)
    let unrecordedHours: Double
    /// 설정된 하루 수면 시간 (구 서버 응답에는 없음)
    let sleepHoursPerDay: Double?
    /// 주간 수면 시간 = sleepHoursPerDay × 7 (구 서버 응답에는 없음)
    let sleepHoursPerWeek: Double?
    /// 과거 → 현재 순 4주
    let trend: [TimeAssetTrendWeek]
    let traded: TimeAssetTraded
    let messages: [String]
    /// 행동 추천 카드 (구 서버 응답에는 없음)
    let actions: [TimeAssetAction]?
    /// 지난주 리포트 (구 서버 응답에는 없음)
    let report: TimeAssetWeeklyReport?
    /// 올해 남은 시간 자산 (구 서버 응답에는 없음)
    let yearRemaining: TimeAssetYearRemaining?
    /// 주간 목표 + 이번 주 진행률 — 목표 미설정이면 null
    let goals: TimeAssetGoals?
    /// 시간 비즈니스 — 실제 번 돈 + 이번 주 판매 퍼널 (구 서버 응답에는 없음)
    let business: TimeAssetBusiness?
}

/// 실수입(거래+수동 기록)과 판매 퍼널.
struct TimeAssetBusiness: Decodable {
    let monthLabel: String
    let monthBookedKrw: Int
    let monthManualKrw: Int
    let monthTotalKrw: Int
    let earnTrend: [MonthEarn]
    /// 주·월·년 보기 (1.8.0 서버부터) — 없으면 월 보기만
    let periods: Periods?
    /// 급여 적립 (1.8.0 서버부터)
    let salary: Salary?
    let funnel: TimeAssetFunnel?

    /// 월 급여 ÷ 그 달 전체 시간으로 24시간 쌓인다. monthlyKrw 가 nil 이면 미설정·프리랜서
    struct Salary: Decodable {
        let monthlyKrw: Int?
        let status: String
        let asOf: String

        /// asOf 뒤로 지금까지 더 쌓인 금액(이번 기간 실시간 표시용, 한국 시간 달 길이 기준)
        func accruedSinceAsOf(now: Date) -> Double {
            guard let monthlyKrw, let from = AssetFormat.parseISO(asOf) else { return 0 }
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = TimeZone(identifier: "Asia/Seoul")!
            let days = cal.range(of: .day, in: .month, for: now)?.count ?? 30
            let seconds = max(0, now.timeIntervalSince(from))
            return Double(monthlyKrw) * seconds / Double(days * 86_400)
        }
    }

    struct Periods: Decodable {
        let week: PeriodStat
        let month: PeriodStat
        let year: PeriodStat

        func stat(_ period: EarnPeriod) -> PeriodStat {
            switch period {
            case .week: week
            case .month: month
            case .year: year
            }
        }
    }

    /// key: 주 "YYYY-MM-DD"(월요일) · 월 "YYYY-MM" · 년 "YYYY"(막대는 "YYYY-MM")
    struct PeriodStat: Decodable {
        let current: String
        let bookedKrw: Int
        let manualKrw: Int
        let salaryKrw: Int
        let totalKrw: Int
        let trend: [Bar]

        struct Bar: Decodable, Identifiable {
            let key: String
            let krw: Int
            let bookedKrw: Int
            let manualKrw: Int
            let salaryKrw: Int
            /// 진행 중인 기간만 — 기간이 끝날 때 쌓일 급여 전체
            var salaryExpectedKrw: Int? = nil
            var id: String { key }
            /// 막대 외곽선 높이에 쓸 금액 — 예약·기록 + 예상 급여 전체 (진행 중이 아니면 지금 금액)
            var expectedKrw: Int {
                guard let salaryExpectedKrw else { return krw }
                return bookedKrw + manualKrw + max(salaryExpectedKrw, salaryKrw)
            }
        }
    }

    /// 화면에 그릴 한 보기 — 서버에 periods 가 없으면(옛 서버) 월 칸으로 만든다
    func view(_ period: EarnPeriod) -> PeriodStat {
        if let periods { return periods.stat(period) }
        return PeriodStat(
            current: monthLabel, bookedKrw: monthBookedKrw, manualKrw: monthManualKrw,
            salaryKrw: 0, totalKrw: monthTotalKrw,
            trend: earnTrend.map {
                PeriodStat.Bar(key: $0.month, krw: $0.krw, bookedKrw: 0, manualKrw: $0.krw, salaryKrw: 0)
            })
    }

    struct MonthEarn: Decodable, Identifiable {
        let month: String
        let krw: Int
        var id: String { month }
        /// "7월"
        var shortLabel: String {
            month.split(separator: "-").last.map { "\(Int($0) ?? 0)월" } ?? month
        }
    }
}

/// 리포트 '번 돈' 카드 보기 (1.8.0)
enum EarnPeriod: String, CaseIterable, Identifiable {
    case week, month, year
    var id: String { rawValue }
    var label: String {
        switch self {
        case .week: "주"
        case .month: "월"
        case .year: "년"
        }
    }
    var title: String {
        switch self {
        case .week: "이번 주 시간으로 번 돈"
        case .month: "이번 달 시간으로 번 돈"
        case .year: "올해 시간으로 번 돈"
        }
    }
    /// 막대 아래 글자 — 주 "10/27", 월·년 "7월"
    func barLabel(_ key: String) -> String {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        switch self {
        case .week where parts.count == 3: return "\(parts[1])/\(parts[2])"
        default: return parts.count >= 2 ? "\(parts[1])월" : key
        }
    }
}

struct TimeAssetFunnel: Decodable {
    let openHours: Double
    let bookedHours: Double
    let bookedKrw: Int
    let unsoldValueKrw: Int
}

/// 지난주(완결된 주) 리포트 — 전주 대비 변화 포함.
struct TimeAssetWeeklyReport: Decodable {
    let weekStart: String
    let earnedKrw: Int?
    let investHours: Double
    let spendHours: Double
    let scheduledHours: Double
    let lostHours: Double
    let deltaEarnedKrw: Int?
    let deltaInvestHours: Double
    let deltaLostHours: Double
}

/// 올해 남은 시간 자산 — 12/31까지, 수면 제외 기준.
struct TimeAssetYearRemaining: Decodable {
    let year: Int
    let remainingAwakeHours: Int
    let remainingValueKrw: Int?
    /// 올해가 얼마나 지났는지 (0~1)
    let progressRatio: Double
}

/// 주간 목표와 이번 주 진행률.
struct TimeAssetGoals: Decodable {
    let earnKrw: Int?
    let investHours: Double?
    let progressEarnKrw: Int
    let progressInvestHours: Double
}

/// 진단 → 행동 연결 카드. target: "slots" | "calendar" | "profile" | "asset-settings"
struct TimeAssetAction: Decodable, Identifiable {
    let key: String
    let title: String
    let body: String
    let ctaLabel: String
    let target: String

    var id: String { key }

    var systemImage: String {
        switch key {
        case "create-slot": return "clock.badge.checkmark"
        case "share-profile": return "square.and.arrow.up"
        case "invest-time": return "chart.line.uptrend.xyaxis"
        case "set-wage": return "wonsign.circle"
        case "record-income": return "plus.circle"
        default: return "sparkles"
        }
    }
}

// MARK: - 포맷 헬퍼

/// 자산 탭 공용 숫자 포맷 — ₩ 통화(ko_KR)와 시간 표기.
enum AssetFormat {
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoPlain = ISO8601DateFormatter()
    static func parseISO(_ s: String) -> Date? {
        isoFractional.date(from: s) ?? isoPlain.date(from: s)
    }

    private static let wonFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    private static let groupFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    private static let weekLabelInput: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()

    private static let weekLabelOutput: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M/d"
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        return formatter
    }()

    /// 1234567 → "₩1,234,567"
    static func won(_ value: Int) -> String {
        wonFormatter.string(from: NSNumber(value: value)) ?? "₩\(value)"
    }

    /// 1234567 → "1,234,567" (통화 기호 없이 천 단위 콤마)
    static func grouped(_ value: Int) -> String {
        groupFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// 39.8 → "39.8", 40.0 → "40"
    static func hours(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%.1f", value)
    }

    /// 0.398 → "40%"
    static func percent(_ ratio: Double) -> String {
        "\(Int((ratio * 100).rounded()))%"
    }

    /// "2026-07" → "2026년 7월". 파싱 실패 시 원문 그대로.
    static func monthLabel(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let monthNumber = Int(parts[1])
        else { return month }
        return "\(year)년 \(monthNumber)월"
    }

    /// ISO 주 시작일 → "7/20" 형태 라벨. 파싱 실패 시 원문 앞 10자.
    /// 서버는 주 시작을 한국 월요일 0시의 UTC 로 준다("2026-10-11T15:00:00Z" = 10/12 월) — 앞 10자를 자르면
    /// 하루 전 날짜(UTC)가 되므로, 시각까지 읽어 이 기기 시간대로 바꾼다.
    static func weekStartDate(_ isoString: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: isoString) { return d }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: isoString) { return d }
        return weekLabelInput.date(from: String(isoString.prefix(10)))
    }

    static func weekLabel(_ isoString: String) -> String {
        guard let date = weekStartDate(isoString) else { return String(isoString.prefix(10)) }
        return weekLabelOutput.string(from: date)
    }

    /// "10/12–10/18" (주 시작 ~ 6일 뒤)
    static func weekRangeLabel(_ isoString: String) -> String {
        guard let start = weekStartDate(isoString),
              let end = Calendar.current.date(byAdding: .day, value: 6, to: start) else { return weekLabel(isoString) }
        return "\(weekLabelOutput.string(from: start))–\(weekLabelOutput.string(from: end))"
    }
}
