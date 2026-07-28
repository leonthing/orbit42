import CoreLocation
import MapKit
import SwiftUI

/// 일정 위치 입력 섹션 — 자유 텍스트 + 애플 지도 주소 자동완성.
/// 자동완성 항목을 고르면 좌표까지 채워지고("지도에 위치 지정됨"),
/// "강남"처럼 그냥 타이핑만 하면 텍스트만 저장된다 (좌표 없음).
struct EventLocationSection: View {
    @Binding var locationText: String
    @Binding var locationLat: Double?
    @Binding var locationLng: Double?
    /// 이동시간(분) — nil 이면 없음
    @Binding var travelMin: Int?

    private static let travelOptions: [Int?] = [nil, 15, 30, 45, 60, 90, 120]

    private static func travelLabel(_ value: Int?) -> String {
        guard let value else { return "없음" }
        if value >= 60 {
            let hours = value / 60
            let minutes = value % 60
            return minutes == 0 ? "\(hours)시간" : "\(hours)시간 \(minutes)분"
        }
        return "\(value)분"
    }

    @State private var search = LocationSearchModel()
    @State private var isResolving = false
    /// 자동완성으로 확정된 텍스트 — 이후 사용자가 텍스트를 고치면 좌표를 해제한다.
    @State private var pickedText: String?
    @FocusState private var isFocused: Bool

    var body: some View {
        Section {
            HStack(spacing: 8) {
                Image(systemName: locationLat != nil ? "mappin.circle.fill" : "mappin.circle")
                    .foregroundStyle(locationLat != nil ? Theme.accent : Theme.secondaryText)
                TextField("위치 (예: 강남 또는 주소 검색)", text: $locationText)
                    .focused($isFocused)
                    .autocorrectionDisabled()
                    .foregroundStyle(Theme.primaryText)
                if isResolving {
                    ProgressView().tint(Theme.secondaryText)
                } else if !locationText.isEmpty {
                    Button {
                        locationText = ""
                        locationLat = nil
                        locationLng = nil
                        pickedText = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .buttonStyle(.borderless)
                }
            }
            .onChange(of: locationText) { _, newValue in
                // 자동완성으로 채운 텍스트를 수정하면 좌표는 더 이상 유효하지 않다.
                if let pickedText, newValue != pickedText {
                    locationLat = nil
                    locationLng = nil
                    self.pickedText = nil
                }
                search.update(query: newValue)
            }

            Picker("이동시간", selection: $travelMin) {
                ForEach(Self.travelOptions, id: \.self) { option in
                    Text(Self.travelLabel(option)).tag(option)
                }
            }
            .tint(Theme.secondaryText)

            if isFocused {
                ForEach(search.suggestions, id: \.self) { suggestion in
                    Button {
                        pick(suggestion)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(suggestion.title)
                                .font(.subheadline)
                                .foregroundStyle(Theme.primaryText)
                            if !suggestion.subtitle.isEmpty {
                                Text(suggestion.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                    }
                }
            }
        } header: {
            Text("위치")
        } footer: {
            if travelMin != nil {
                Text("이동시간만큼 일정 시작 전이 예약 가능 시간에서 함께 막혀요.")
            } else if locationLat != nil {
                Text("지도에 위치가 지정됐어요. 일정 상세에서 지도로 표시돼요.")
            } else if !locationText.isEmpty {
                Text("대략적인 위치로 저장돼요. 검색 결과를 고르면 지도에 표시할 수 있어요.")
            }
        }
        .listRowBackground(Theme.surface)
    }

    private func pick(_ suggestion: MKLocalSearchCompletion) {
        isResolving = true
        Task {
            defer { isResolving = false }
            let request = MKLocalSearch.Request(completion: suggestion)
            let item = try? await MKLocalSearch(request: request).start().mapItems.first
            let text = suggestion.subtitle.isEmpty
                ? suggestion.title
                : "\(suggestion.title) · \(suggestion.subtitle)"
            locationText = text
            pickedText = text
            if let coordinate = item?.placemark.coordinate {
                locationLat = coordinate.latitude
                locationLng = coordinate.longitude
            }
            search.clear()
            isFocused = false
        }
    }
}

// MARK: - 자동완성 모델

/// MKLocalSearchCompleter 래퍼 — 300ms 디바운스 없이 완성기 자체 스로틀에 맡긴다.
/// 첫 검색 시 위치 권한을 요청해, 허용되면 내 주변 결과를 우선 보여준다.
@MainActor
@Observable
final class LocationSearchModel: NSObject, MKLocalSearchCompleterDelegate, CLLocationManagerDelegate {
    private(set) var suggestions: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()
    private let locationManager = CLLocationManager()
    private var didRequestLocation = false

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
        locationManager.delegate = self
    }

    func update(query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty {
            suggestions = []
        } else {
            requestLocationIfNeeded()
            completer.queryFragment = trimmed
        }
    }

    /// 첫 검색에서 한 번만 — 권한 요청 + 현재 위치로 검색 지역 바이어스.
    private func requestLocationIfNeeded() {
        guard !didRequestLocation else { return }
        didRequestLocation = true
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            locationManager.requestLocation()
        default:
            break
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            if status == .authorizedWhenInUse || status == .authorizedAlways {
                self.locationManager.requestLocation()
            }
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let coordinate = locations.first?.coordinate else { return }
        Task { @MainActor in
            self.completer.region = MKCoordinateRegion(
                center: coordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
            )
        }
    }

    nonisolated func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {}

    func clear() {
        suggestions = []
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let results = Array(completer.results.prefix(5))
        Task { @MainActor in
            self.suggestions = results
        }
    }

    nonisolated func completer(
        _ completer: MKLocalSearchCompleter,
        didFailWithError error: Error
    ) {
        Task { @MainActor in
            self.suggestions = []
        }
    }
}
