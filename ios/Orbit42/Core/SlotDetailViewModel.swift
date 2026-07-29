import Foundation
import Observation

// MARK: - 요일별 근무시간 편집 상태

/// 근무시간 에디터의 한 요일. 요일당 첫 구간만 편집하고, 나머지 구간은 그대로 보존한다.
struct DayHoursEdit: Identifiable {
    let key: String        // "sun" ~ "sat" (서버 workingHours 키)
    let label: String      // "일" ~ "토"
    var enabled: Bool
    var start: Date        // 시각만 의미 있음 (hourAndMinute DatePicker 용)
    var end: Date
    /// 첫 구간 외의 기존 구간들 — 앱에서는 편집하지 않고 저장 시 그대로 유지한다.
    var extraIntervals: [WorkingInterval]

    var id: String { key }
}

// MARK: - 슬롯 상세 뷰모델

/// 타임슬롯 상세 편집 화면 상태 관리.
/// 로드(`GET /slots/{id}`), 변경분만 모은 PATCH, 시간 창 추가/삭제, 예약 가능 시간 미리보기.
@MainActor
@Observable
final class SlotDetailViewModel {
    let slotId: String

    /// nil 이면 아직 최초 로딩 전.
    private(set) var detail: SlotDetail?
    private(set) var isLoading = false
    /// 최초 로딩 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 저장/삭제 결과 안내 (alert 로 표시)
    var actionMessage: String?
    private(set) var isSaving = false

    // 예약 가능 시간 미리보기 / 시간 창
    private(set) var availability: SlotAvailabilityResponse?
    private(set) var isLoadingAvailability = false
    private(set) var availabilityError: String?
    private(set) var deletingWindowIds: Set<String> = []
    private(set) var isAddingWindow = false

    // MARK: 편집 필드 (뷰가 직접 바인딩)

    var title = ""
    var descriptionText = ""
    var slotType = "1on1"
    var durationMin = 60
    var capacity = 1
    var autoApprove = false
    /// 원 단위 숫자 문자열. 전송 시 `priceCents = 원 * 100`.
    var priceWonText = ""
    var locations: [String] = []
    var newLocationText = ""
    var mode = "auto"
    var slotIntervalMin = 30
    var minNoticeHours = 24
    var maxAdvanceDays = 90
    var bufferMin = 0
    var days: [DayHoursEdit] = SlotDetailViewModel.defaultDays()
    var validFromEnabled = false
    var validFromDate = Date()
    var validUntilEnabled = false
    var validUntilDate = Date()

    /// 다중 구간이 있는 요일이 하나라도 있으면 각주("여러 구간은 웹에서...")를 띄운다.
    var hasMultiIntervalDay: Bool {
        days.contains { !$0.extraIntervals.isEmpty }
    }

    private let api: APIClient

    init(slotId: String, api: APIClient = .shared) {
        self.slotId = slotId
        self.api = api
    }

    // MARK: - 로딩

    func load() async {
        if isLoading { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: SlotDetailResponse = try await api.get("/api/v1/slots/\(slotId)")
            detail = response.slot
            populate(from: response.slot)
            await loadAvailability()
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "슬롯 정보를 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    func loadAvailability() async {
        if isLoadingAvailability { return }
        isLoadingAvailability = true
        availabilityError = nil
        defer { isLoadingAvailability = false }

        do {
            let response: SlotAvailabilityResponse = try await api.get("/api/v1/slots/\(slotId)/availability")
            availability = response
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            availabilityError = apiError.errorDescription
        } catch {
            availabilityError = "예약 가능 시간을 불러오지 못했어요."
        }
    }

    // MARK: - 저장 (변경분만 PATCH)

    /// 변경된 필드만 모아 PATCH 한다. 성공하면 true.
    func save() async -> Bool {
        guard let original = detail, !isSaving else { return false }
        guard let patch = buildPatch(from: original) else { return false } // 검증 실패 (actionMessage 설정됨)
        if patch.isEmpty {
            actionMessage = "변경된 내용이 없어요"
            return false
        }

        isSaving = true
        defer { isSaving = false }

        do {
            let response: SlotDetailResponse = try await api.patch("/api/v1/slots/\(slotId)", body: patch)
            detail = response.slot
            populate(from: response.slot)
            actionMessage = "저장했어요"
            await loadAvailability()
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            return false
        } catch {
            actionMessage = "저장하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }

    // MARK: - 위치

    func addLocation() {
        let trimmed = newLocationText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !locations.contains(trimmed) else {
            newLocationText = ""
            return
        }
        locations.append(trimmed)
        newLocationText = ""
    }

    // MARK: - 시간 창 (manual 슬롯)

    func addWindow(startAt: Date) async -> Bool {
        guard !isAddingWindow else { return false }
        isAddingWindow = true
        defer { isAddingWindow = false }

        do {
            let _: OkResponse = try await api.post(
                "/api/v1/slots/\(slotId)/availability",
                body: CreateAvailabilityRequest(startAt: APIDateParser.encodeDateTime(startAt), capacity: nil)
            )
            await loadAvailability()
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            return false
        } catch {
            actionMessage = "시간 창을 추가하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }

    func deleteWindow(_ window: AvailabilityWindow) async {
        guard !deletingWindowIds.contains(window.id) else { return }
        deletingWindowIds.insert(window.id)
        defer { deletingWindowIds.remove(window.id) }

        do {
            let _: OkResponse = try await api.delete("/api/v1/slots/\(slotId)/availability/\(window.id)")
            await loadAvailability()
        } catch is CancellationError {
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            return
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
        } catch {
            actionMessage = "시간 창을 삭제하지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 편집 상태 <-> 서버 형식 변환

    /// 서버 상세를 편집 필드로 반영한다.
    private func populate(from slot: SlotDetail) {
        title = slot.title
        descriptionText = slot.description ?? ""
        slotType = slot.slotType
        durationMin = slot.durationMin
        capacity = min(max(slot.capacity, 1), 20)
        autoApprove = slot.autoApprove
        priceWonText = slot.priceCents > 0 ? "\(slot.priceCents / 100)" : ""
        locations = slot.locations
        mode = slot.mode
        slotIntervalMin = slot.slotIntervalMin
        minNoticeHours = slot.minNoticeHours
        maxAdvanceDays = slot.maxAdvanceDays
        bufferMin = slot.bufferMin

        days = Self.defaultDays().map { day in
            var day = day
            let intervals = slot.workingHours[day.key] ?? []
            day.enabled = !intervals.isEmpty
            if let first = intervals.first {
                day.start = Self.timeDate(first.start) ?? day.start
                day.end = Self.timeDate(first.end) ?? day.end
            }
            day.extraIntervals = Array(intervals.dropFirst())
            return day
        }

        let from = slot.validFrom.flatMap(APIDateParser.parse)
        validFromEnabled = from != nil
        validFromDate = from ?? Date()
        let until = slot.validUntil.flatMap(APIDateParser.parse)
        validUntilEnabled = until != nil
        validUntilDate = until ?? Date().addingTimeInterval(60 * 60 * 24 * 30)
    }

    /// 편집 필드와 원본을 비교해 변경분만 담은 PATCH 를 만든다.
    /// 검증에 실패하면 `actionMessage` 를 설정하고 nil 을 돌려준다.
    private func buildPatch(from original: SlotDetail) -> SlotPatchRequest? {
        var patch = SlotPatchRequest()

        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else {
            actionMessage = "제목을 입력해 주세요"
            return nil
        }
        if trimmedTitle != original.title { patch.title = .value(trimmedTitle) }

        let trimmedDescription = descriptionText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedDescription != (original.description ?? "") {
            patch.description = trimmedDescription.isEmpty ? .null : .value(trimmedDescription)
        }

        if durationMin != original.durationMin { patch.durationMin = .value(durationMin) }
        if capacity != original.capacity { patch.capacity = .value(capacity) }
        if slotType != original.slotType { patch.slotType = .value(slotType) }
        if autoApprove != original.autoApprove { patch.autoApprove = .value(autoApprove) }

        // 경매 슬롯의 가격은 웹에서만 관리 — 앱에서는 건드리지 않는다.
        if !original.isAuction {
            let won = Int(priceWonText.filter(\.isNumber)) ?? 0
            let cents = won * 100
            if cents != original.priceCents { patch.priceCents = .value(cents) }
        }

        let cleanedLocations = locations
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if cleanedLocations != original.locations { patch.locations = .value(cleanedLocations) }

        if mode != original.mode { patch.mode = .value(mode) }

        // auto 전용 설정은 편집 화면에 보이는 auto 모드일 때만 비교/전송한다.
        if mode == "auto" {
            if slotIntervalMin != original.slotIntervalMin { patch.slotIntervalMin = .value(slotIntervalMin) }
            if minNoticeHours != original.minNoticeHours { patch.minNoticeHours = .value(minNoticeHours) }
            if maxAdvanceDays != original.maxAdvanceDays { patch.maxAdvanceDays = .value(maxAdvanceDays) }
            if bufferMin != original.bufferMin { patch.bufferMin = .value(bufferMin) }

            for day in days where day.enabled {
                if Self.timeString(day.start) >= Self.timeString(day.end) {
                    actionMessage = "\(day.label)요일 근무시간은 시작이 종료보다 빨라야 해요"
                    return nil
                }
            }
            let built = builtWorkingHours()
            if built != original.workingHours { patch.workingHours = .value(built) }
        }

        if validFromEnabled && validUntilEnabled && validFromDate >= validUntilDate {
            actionMessage = "판매 종료가 시작보다 늦어야 해요"
            return nil
        }

        let originalFrom = original.validFrom.flatMap(APIDateParser.parse)
        if validFromEnabled {
            if originalFrom == nil || abs(validFromDate.timeIntervalSince(originalFrom!)) >= 60 {
                patch.validFrom = .value(APIDateParser.encodeDateTime(validFromDate))
            }
        } else if originalFrom != nil {
            patch.validFrom = .null
        }

        let originalUntil = original.validUntil.flatMap(APIDateParser.parse)
        if validUntilEnabled {
            if originalUntil == nil || abs(validUntilDate.timeIntervalSince(originalUntil!)) >= 60 {
                patch.validUntil = .value(APIDateParser.encodeDateTime(validUntilDate))
            }
        } else if originalUntil != nil {
            patch.validUntil = .null
        }

        return patch
    }

    /// on 인 요일만 서버 형식으로. 첫 구간은 편집값, 나머지 구간은 원본 그대로 보존.
    private func builtWorkingHours() -> [String: [WorkingInterval]] {
        var result: [String: [WorkingInterval]] = [:]
        for day in days where day.enabled {
            var intervals = [WorkingInterval(start: Self.timeString(day.start), end: Self.timeString(day.end))]
            intervals.append(contentsOf: day.extraIntervals)
            result[day.key] = intervals
        }
        return result
    }

    // MARK: - 시각(HH:mm) 변환

    private static let hhmmFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        formatter.timeZone = .current
        return formatter
    }()

    static func timeDate(_ string: String) -> Date? {
        hhmmFormatter.date(from: string)
    }

    static func timeString(_ date: Date) -> String {
        hhmmFormatter.string(from: date)
    }

    /// 기본 상태 (off, 10:00~18:00). 나열 순서는 설정한 주 시작 요일을 따른다.
    /// 저장 페이로드(`builtWorkingHours`)는 요일 키 딕셔너리라 순서와 무관하다.
    private static func defaultDays() -> [DayHoursEdit] {
        let keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        let defaultStart = timeDate("10:00") ?? Date()
        let defaultEnd = timeDate("18:00") ?? Date()
        let days = zip(keys, WeekStart.absoluteSymbols).map { key, label in
            DayHoursEdit(key: key, label: label, enabled: false, start: defaultStart, end: defaultEnd, extraIntervals: [])
        }
        return AppSettings.shared.weekStart.rotated(days)
    }
}
