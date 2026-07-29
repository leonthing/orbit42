import Foundation
import Observation

// MARK: - 요일별 편집 상태

/// 근무시간 화면의 한 요일. 요일당 1구간 (API v1 work-hours 계약).
struct WorkDayEdit: Identifiable {
    let key: String        // "sun" ~ "sat" (서버 workHours 키)
    let label: String      // "일" ~ "토"
    var enabled: Bool
    var start: Date        // 시각만 의미 있음 (hourAndMinute DatePicker 용)
    var end: Date

    var id: String { key }
}

// MARK: - 근무시간 뷰모델

/// 프로필 탭 > 근무시간 화면 상태 관리.
/// `GET /api/v1/work-hours` 로 로드하고, 켠 요일만 담아 `PUT` 으로 전체 교체한다.
@MainActor
@Observable
final class WorkHoursViewModel {
    /// 최초 로딩 성공 여부 — true 면 편집 폼을 보여준다.
    private(set) var isLoaded = false
    private(set) var isLoading = false
    /// 최초 로딩 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 저장 실패/검증 안내 (alert 로 표시)
    var actionMessage: String?
    private(set) var isSaving = false

    /// 일~토 편집 상태 (뷰가 직접 바인딩)
    var days: [WorkDayEdit] = WorkHoursViewModel.defaultDays()

    private let api: APIClient

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - 로딩

    func load() async {
        if isLoading { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: WorkHoursResponse = try await api.get("/api/v1/work-hours")
            days = Self.defaultDays().map { day in
                var day = day
                if let range = response.workHours[day.key] {
                    day.enabled = true
                    day.start = Self.timeDate(range.start) ?? day.start
                    day.end = Self.timeDate(range.end) ?? day.end
                }
                return day
            }
            isLoaded = true
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "근무시간을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 저장

    /// 켠 요일만 모아 PUT 한다. 성공하면 true (뷰가 pop 으로 피드백).
    func save() async -> Bool {
        guard isLoaded, !isSaving else { return false }

        for day in days where day.enabled {
            if Self.timeString(day.start) >= Self.timeString(day.end) {
                actionMessage = "\(day.label)요일 근무시간은 시작이 종료보다 빨라야 해요"
                return false
            }
        }

        var workHours: [String: WorkHourRange] = [:]
        for day in days where day.enabled {
            workHours[day.key] = WorkHourRange(
                start: Self.timeString(day.start),
                end: Self.timeString(day.end)
            )
        }

        isSaving = true
        defer { isSaving = false }

        do {
            let response: WorkHoursResponse = try await api.put(
                "/api/v1/work-hours",
                body: WorkHoursPutRequest(workHours: workHours)
            )
            // 서버가 정규화했을 수 있으니 응답으로 되반영해 둔다 (pop 전 상태 일관성)
            days = Self.defaultDays().map { day in
                var day = day
                if let range = response.workHours[day.key] {
                    day.enabled = true
                    day.start = Self.timeDate(range.start) ?? day.start
                    day.end = Self.timeDate(range.end) ?? day.end
                }
                return day
            }
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            return false
        } catch {
            actionMessage = "근무시간을 저장하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }

    // MARK: - 시각(HH:mm) 변환

    private static let hhmmFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = .current
        return formatter
    }()

    private static func timeDate(_ string: String) -> Date? {
        hhmmFormatter.date(from: string)
    }

    private static func timeString(_ date: Date) -> String {
        hhmmFormatter.string(from: date)
    }

    /// 기본 상태 (off, 09:00~18:00). 나열 순서는 설정한 주 시작 요일을 따른다.
    /// 저장 페이로드는 요일 키 딕셔너리라 순서와 무관하다.
    private static func defaultDays() -> [WorkDayEdit] {
        let keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        let defaultStart = timeDate("09:00") ?? Date()
        let defaultEnd = timeDate("18:00") ?? Date()
        let days = zip(keys, WeekStart.absoluteSymbols).map { key, label in
            WorkDayEdit(key: key, label: label, enabled: false, start: defaultStart, end: defaultEnd)
        }
        return AppSettings.shared.weekStart.rotated(days)
    }
}
