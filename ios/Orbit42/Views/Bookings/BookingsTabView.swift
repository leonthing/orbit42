import SwiftUI

/// 예약 탭 — 위쪽 세그먼트로 "예약"(받은·내가 한 예약)과 "예약 링크"(내가 연 슬롯)를 오간다.
/// 예약을 받는 도구와 받은 예약이 한 탭에 있어야 헷갈리지 않아서, 예약 링크를 캘린더 탭에서 옮겨 왔다.
struct BookingsTabView: View {
    enum Section: String, CaseIterable, Identifiable {
        case bookings
        case links

        var id: String { rawValue }
        var title: String {
            switch self {
            case .bookings: return "예약"
            case .links: return "예약 링크"
            }
        }
    }

    @Environment(TabRouter.self) private var router
    @State private var section: Section = BookingsTabView.initialSection
    /// 구역 전환에도 슬롯 목록 캐시가 유지되도록 여기서 소유한다.
    @State private var slotsViewModel = SlotsViewModel()
    /// 슬롯 상세 push 용 path — `SlotsContent` 의 DEMO_SLOT_ID 자동 진입에도 쓰인다.
    @State private var path = NavigationPath()

    /// DEBUG 스크린샷용: DEMO_TAB=slots 면 "예약 링크" 구역으로 연다.
    private static var initialSection: Section {
        #if DEBUG
        if ProcessInfo.processInfo.environment["DEMO_TAB"] == "slots" {
            return .links
        }
        #endif
        return .bookings
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    Picker("예약 보기", selection: $section) {
                        ForEach(Section.allCases) { s in
                            Text(s.title).tag(s)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 4)

                    switch section {
                    case .bookings:
                        BookingsView(embedded: true)
                    case .links:
                        SlotsContent(viewModel: slotsViewModel, path: $path)
                    }
                }
            }
            .navigationTitle("예약")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: router.bookingsSectionRequest) { _, request in
                applySectionRequest(request)
            }
            .onAppear { applySectionRequest(router.bookingsSectionRequest) }
        }
    }

    private func applySectionRequest(_ request: String?) {
        guard let request, let requested = Section(rawValue: request) else { return }
        section = requested
        router.bookingsSectionRequest = nil
    }
}
