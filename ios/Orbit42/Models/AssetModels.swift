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
    static func weekLabel(_ isoString: String) -> String {
        let dayPart = String(isoString.prefix(10))
        guard let date = weekLabelInput.date(from: dayPart) else { return dayPart }
        return weekLabelOutput.string(from: date)
    }
}
