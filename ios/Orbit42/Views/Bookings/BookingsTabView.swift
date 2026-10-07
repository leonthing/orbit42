import SwiftUI

/// 예약 탭 — 세그먼트 하나로 "받은 예약 · 내가 한 예약 · 예약 링크"를 오간다.
/// 예전엔 "예약 | 예약 링크" 아래에 "받은 | 내가 한"이 똑같은 모양으로 한 번 더 쌓여 헷갈렸다.
struct BookingsTabView: View {
    enum Section: String, CaseIterable, Identifiable {
        case received
        case sent
        case links

        var id: String { rawValue }
        var title: String {
            switch self {
            case .received: return "받은 예약"
            case .sent: return "내가 한 예약"
            case .links: return "예약 링크"
            }
        }

        /// 다른 화면이 보내는 구역 요청("bookings" | "links" | 이 enum 값)
        init?(request: String) {
            switch request {
            case "bookings", "received": self = .received
            case "sent", "guest": self = .sent
            case "links", "slots": self = .links
            default: return nil
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
        return .received
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
                    case .received, .sent:
                        // 같은 인스턴스를 유지해야 받은/내가 한 예약 사이를 오갈 때 다시 불러오지 않는다.
                        BookingsView(embedded: true, forcedSegment: section == .sent ? .guest : .host)
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
        guard let request, let requested = Section(request: request) else { return }
        section = requested
        router.bookingsSectionRequest = nil
    }
}
