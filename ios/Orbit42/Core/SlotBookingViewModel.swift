import Foundation
import Observation

/// 타인 슬롯 예약 화면 상태 관리.
/// 로드(`GET /api/v1/users/{username}/slots/{slug}`), 장소 변경 시 옵션 재조회,
/// 예약(`POST` 동일 경로).
@MainActor
@Observable
final class SlotBookingViewModel {
    let username: String
    let slug: String

    /// nil 이면 아직 최초 로딩 전.
    private(set) var data: SlotBookingResponse?
    private(set) var isLoading = false
    /// 최초 로딩 실패 메시지 (전체 화면 에러 상태용)
    private(set) var errorMessage: String?
    /// 예약 실패 안내 (alert 로 표시)
    var actionMessage: String?

    /// 선택된 장소 (locations 가 있을 때만 의미 있음)
    private(set) var selectedLocation: String?
    private(set) var isReloadingOptions = false
    private(set) var isBooking = false
    /// 예약 성공 시 서버 status ("confirmed" | "pending") — 성공 화면 전환용
    private(set) var bookedStatus: String?

    private let api: APIClient

    init(username: String, slug: String, api: APIClient = .shared) {
        self.username = username
        self.slug = slug
        self.api = api
    }

    /// 날짜별로 묶은 예약 옵션 — ("7월 30일 (목)", [옵션...]) 을 날짜순으로.
    var optionsByDay: [(dayText: String, options: [BookingOption])] {
        guard let options = data?.options, !options.isEmpty else { return [] }
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: options) { calendar.startOfDay(for: $0.startAt) }
        return grouped.keys.sorted().map { day in
            (
                dayText: DiscoverFormat.dayHeader.string(from: day),
                options: grouped[day]!.sorted { $0.startAt < $1.startAt }
            )
        }
    }

    // MARK: - 로딩

    func load(force: Bool = false) async {
        if !force, data != nil { return }
        if isLoading { return }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let response: SlotBookingResponse = try await api.get(path(location: selectedLocation))
            data = response
            // 장소가 여러 개면 첫 장소를 기본 선택으로 (초기 응답 옵션이 기본 장소 기준)
            if selectedLocation == nil, let first = response.slot.locations.first,
               response.slot.locations.count > 1 {
                selectedLocation = first
            }
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

    /// 장소 변경 → `?location=` 으로 옵션 재조회.
    func selectLocation(_ location: String) async {
        guard location != selectedLocation, !isReloadingOptions else { return }
        let previous = selectedLocation
        selectedLocation = location
        isReloadingOptions = true
        defer { isReloadingOptions = false }

        do {
            let response: SlotBookingResponse = try await api.get(path(location: location))
            data = response
        } catch is CancellationError {
            selectedLocation = previous
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            selectedLocation = previous
            return
        } catch let apiError as APIError {
            selectedLocation = previous
            actionMessage = apiError.errorDescription
        } catch {
            selectedLocation = previous
            actionMessage = "예약 가능 시간을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }

    // MARK: - 예약

    /// 예약 요청. 성공하면 `bookedStatus` 를 설정하고 true 를 돌려준다.
    func book(option: BookingOption, message: String) async -> Bool {
        guard !isBooking else { return false }
        isBooking = true
        defer { isBooking = false }

        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasLocations = !(data?.slot.locations.isEmpty ?? true)
        // 옵션에 availabilityId 가 있으면 그것을, 없으면 startAt 원문을 보낸다.
        let request = BookSlotRequest(
            startAt: option.availabilityId == nil ? option.startAtRaw : nil,
            availabilityId: option.availabilityId,
            message: trimmedMessage.isEmpty ? nil : trimmedMessage,
            location: hasLocations ? selectedLocation ?? data?.slot.locations.first : nil
        )

        do {
            let response: BookSlotResponse = try await api.post(
                "/api/v1/users/\(username)/slots/\(slug)",
                body: request
            )
            bookedStatus = response.status
            return true
        } catch is CancellationError {
            return false
        } catch let urlError as URLError where urlError.code == .cancelled {
            return false
        } catch let apiError as APIError {
            actionMessage = apiError.errorDescription
            return false
        } catch {
            actionMessage = "예약하지 못했어요. 네트워크를 확인해 주세요."
            return false
        }
    }

    // MARK: - 내부

    private func path(location: String?) -> String {
        let base = "/api/v1/users/\(username)/slots/\(slug)"
        guard let location, !location.isEmpty else { return base }
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=+?#")
        let encoded = location.addingPercentEncoding(withAllowedCharacters: allowed) ?? location
        return "\(base)?location=\(encoded)"
    }
}
