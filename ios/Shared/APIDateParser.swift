import Foundation

// MARK: - 유연한 날짜 파싱 (API v1 캘린더 계약)

/// 서버가 내려주는 `startAt`/`endAt` 을 파싱한다.
/// ISO8601(소수점 초 포함/미포함) → 날짜만("2026-07-26") 순서로 시도한다.
enum APIDateParser {
    private static let isoWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// 타임존 오프셋이 없는 "yyyy-MM-dd'T'HH:mm:ss" — 로컬 시각으로 해석
    private static let localDateTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        formatter.timeZone = .current
        return formatter
    }()

    /// "2026-07-26" 처럼 날짜만 올 때 — 로컬 자정으로 해석
    private static let dateOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = .current
        return formatter
    }()

    static func isDateOnly(_ raw: String) -> Bool {
        raw.count == 10 && !raw.contains("T")
    }

    static func parse(_ raw: String) -> Date? {
        if let date = isoWithFractionalSeconds.date(from: raw) { return date }
        if let date = iso.date(from: raw) { return date }
        if let date = localDateTime.date(from: raw) { return date }
        if let date = dateOnly.date(from: raw) { return date }
        return nil
    }

    /// POST 용 인코딩 — 시간 있는 이벤트는 로컬 오프셋 포함 ISO8601 ("2026-07-26T09:00:00+09:00")
    static func encodeDateTime(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = .current
        return formatter.string(from: date)
    }

    /// POST 용 인코딩 — 종일 이벤트는 서버 출력과 같은 날짜만 형태 ("2026-07-26")
    static func encodeDateOnly(_ date: Date) -> String {
        dateOnly.string(from: date)
    }
}
