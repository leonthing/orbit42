import SwiftUI

/// 예약 탭 — 받은 예약(host) / 내가 한 예약(guest) 관리.
/// 수락·거절·완료 처리(host), 예약 취소(guest)를 지원한다.
struct BookingsView: View {
    @State private var viewModel = BookingsViewModel()
    /// "예약 취소" 확인 다이얼로그 대상 (guest)
    @State private var cancelTarget: GuestBooking?
    /// "목록에서 삭제" 확인 다이얼로그 대상 예약 id
    @State private var deleteTargetId: String?
    /// 카드 탭 → 상세로 push 할 대상
    @State private var detailTarget: BookingDetailTarget?
    /// 받은 시간 요청 — 수락할 시간 고르기 시트 / 거절 확인 대상
    @State private var acceptRequestTarget: ReceivedTimeRequest?
    @State private var declineRequestTarget: ReceivedTimeRequest?
    @Environment(TabRouter.self) private var router

    /// 프로필에서 push 할 때는 자체 NavigationStack 없이 쓴다 (중첩 방지).
    var embedded = false
    /// 예약 탭처럼 바깥에서 받은/내가 한 예약을 고르는 경우 — 자체 세그먼트를 숨기고 이 값을 따른다.
    var forcedSegment: BookingsViewModel.Segment? = nil

    var body: some View {
        if embedded {
            inner
        } else {
            NavigationStack { inner }
        }
    }

    private func applyBookingRequest(_ request: BookingDetailTarget?) {
        guard let request else { return }
        let mine: BookingsViewModel.Segment = request.role == .host ? .host : .guest
        // 예약 탭에 붙은 목록만 연다 (알림 화면에서 push 한 목록은 건드리지 않는다)
        guard let forcedSegment, forcedSegment == mine else { return }
        detailTarget = request
        router.bookingDetailRequest = nil
    }

    private var inner: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            VStack(spacing: 0) {
                if forcedSegment == nil {
                    segmentPicker
                }
                content
            }
        }
        .onAppear {
            if let forcedSegment { viewModel.segment = forcedSegment }
        }
        .onChange(of: forcedSegment) { _, new in
            if let new { viewModel.segment = new }
            applyBookingRequest(router.bookingDetailRequest)
        }
        // 일정 상세의 "예약에서 관리" — 내 구역(받은/내가 한) 인스턴스만 연다
        .onChange(of: router.bookingDetailRequest) { _, request in
            applyBookingRequest(request)
        }
        .onAppear { applyBookingRequest(router.bookingDetailRequest) }
        .navigationTitle("예약")
        .navigationBarTitleDisplayMode(.inline)
            .alert(
                "안내",
                isPresented: Binding(
                    get: { viewModel.actionMessage != nil },
                    set: { if !$0 { viewModel.actionMessage = nil } }
                )
            ) {
                Button("확인", role: .cancel) {}
            } message: {
                Text(viewModel.actionMessage ?? "")
            }
            .confirmationDialog(
                "이 예약을 취소할까요?",
                isPresented: Binding(
                    get: { cancelTarget != nil },
                    set: { if !$0 { cancelTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: cancelTarget
            ) { booking in
                Button("예약 취소", role: .destructive) {
                    Task { await viewModel.act(.cancelMine, on: booking.id) }
                }
                Button("돌아가기", role: .cancel) {}
            } message: { booking in
                Text("\(booking.slotTitle) · \(booking.scheduledText)")
            }
            .confirmationDialog(
                "이 예약을 목록에서 삭제할까요?",
                isPresented: Binding(
                    get: { deleteTargetId != nil },
                    set: { if !$0 { deleteTargetId = nil } }
                ),
                titleVisibility: .visible,
                presenting: deleteTargetId
            ) { bookingId in
                Button("삭제", role: .destructive) {
                    Task { await viewModel.deleteBooking(bookingId) }
                }
                Button("돌아가기", role: .cancel) {}
            } message: { _ in
                Text("내 목록에서만 사라지고 상대방의 기록은 유지돼요.")
            }
            .confirmationDialog(
                "이 시간 요청을 거절할까요?",
                isPresented: Binding(
                    get: { declineRequestTarget != nil },
                    set: { if !$0 { declineRequestTarget = nil } }
                ),
                titleVisibility: .visible,
                presenting: declineRequestTarget
            ) { request in
                Button("거절", role: .destructive) {
                    Task { await viewModel.declineTimeRequest(request.id) }
                }
                Button("돌아가기", role: .cancel) {}
            } message: { request in
                Text("\(request.requesterName)님에게 지금은 시간을 내기 어렵다는 알림이 가요.")
            }
            .sheet(item: $acceptRequestTarget) { request in
                AcceptTimeRequestSheet(request: request) { start in
                    await viewModel.acceptTimeRequest(request.id, startAt: start)
                }
            }
            .navigationDestination(item: $detailTarget) { target in
                BookingDetailView(
                    viewModel: viewModel,
                    bookingId: target.id,
                    role: target.role
                )
            }
            .task {
                await viewModel.load()
                #if DEBUG
                // 스크린샷용: DEMO_BOOKING_ID 로 받은 예약 상세를 바로 연다.
                if detailTarget == nil,
                   let demoId = ProcessInfo.processInfo.environment["DEMO_BOOKING_ID"] {
                    detailTarget = BookingDetailTarget(id: demoId, role: .host)
                }
                #endif
            }
    }

    // MARK: - 세그먼트

    private var segmentPicker: some View {
        Picker("예약 구분", selection: $viewModel.segment) {
            ForEach(BookingsViewModel.Segment.allCases) { segment in
                Text(segment.title).tag(segment)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let data = viewModel.data {
            switch viewModel.segment {
            case .host:
                if data.host.isEmpty, data.receivedTimeRequests.isEmpty {
                    emptyState(
                        icon: "tray",
                        title: "받은 예약이 없어요",
                        message: "예약 링크를 공유하면 받은 예약이 이곳에 모여요",
                        action: ("예약 링크 만들기", { router.openNewBookingLink() })
                    )
                } else {
                    hostList(data.host, timeRequests: data.receivedTimeRequests)
                }
            case .guest:
                if data.guest.isEmpty {
                    emptyState(
                        icon: "calendar.badge.clock",
                        title: "예약한 일정이 없어요",
                        message: "오르빗 탭에서 사람을 찾아 시간을 예약해보세요"
                    )
                } else {
                    guestList(data.guest)
                }
            }
        } else if viewModel.isLoading {
            loadingState
        } else if let message = viewModel.errorMessage {
            errorState(message)
        } else {
            Color.clear
        }
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(Theme.accent)
            Text("예약을 불러오는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
            Button {
                Task { await viewModel.load(force: true) }
            } label: {
                Text("다시 시도")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func emptyState(
        icon: String,
        title: String,
        message: String,
        action: (title: String, run: () -> Void)? = nil
    ) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Theme.accent)
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
                if let action {
                    Button(action: action.run) {
                        Text(action.title)
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 22)
                            .padding(.vertical, 11)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 80)
            .padding(.horizontal, 32)
        }
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    // MARK: - 받은 예약 (host)

    private func hostList(_ bookings: [HostBooking], timeRequests: [ReceivedTimeRequest]) -> some View {
        let now = Date()
        let upcoming = bookings
            .filter { $0.scheduledAt >= now }
            .sorted { $0.scheduledAt < $1.scheduledAt }
        let past = bookings
            .filter { $0.scheduledAt < now }
            .sorted { $0.scheduledAt > $1.scheduledAt }
        // 손이 필요한 것(승인·입금 확인)을 맨 위에 모은다.
        let needsAction = upcoming.filter { $0.status == .pending }
        let scheduled = upcoming.filter { $0.status != .pending }
        let pendingCount = bookings.filter { $0.status == .pending }.count
        let upcomingCount = upcoming
            .filter { $0.status == .pending || $0.status == .confirmed }
            .count

        return List {
            hostStats(requestCount: timeRequests.count, pendingCount: pendingCount, upcomingCount: upcomingCount)
                .bookingRowChrome()

            // 프로필로 받은 시간 요청 — 웹 받은 예약 화면처럼 맨 위에 (없으면 구역 자체가 없다)
            if !timeRequests.isEmpty {
                Section {
                    ForEach(timeRequests) { request in
                        TimeRequestRow(
                            request: request,
                            isActing: viewModel.actingIds.contains(request.id),
                            onAccept: { acceptRequestTarget = request },
                            onDecline: { declineRequestTarget = request }
                        )
                        .bookingRowChrome()
                    }
                } header: {
                    sectionHeader("시간 요청")
                }
            }

            if !needsAction.isEmpty {
                Section {
                    ForEach(needsAction) { booking in
                        hostRow(booking, isPast: false)
                    }
                } header: {
                    sectionHeader("승인·입금 확인 대기")
                }
            }

            if !scheduled.isEmpty {
                Section {
                    ForEach(scheduled) { booking in
                        hostRow(booking, isPast: false)
                    }
                } header: {
                    sectionHeader("예정된 예약")
                }
            }

            if !past.isEmpty {
                Section {
                    ForEach(past) { booking in
                        hostRow(booking, isPast: true)
                    }
                } header: {
                    sectionHeader("지난 예약")
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    @ViewBuilder
    private func hostRow(_ booking: HostBooking, isPast: Bool) -> some View {
        // 진행 중(대기/확정 + 미래) 예약은 삭제 불가 — 먼저 취소해야 한다.
        let deletable =
            isPast || booking.status == .canceled || booking.status == .completed
        let row = HostBookingRow(
            booking: booking,
            isActing: viewModel.actingIds.contains(booking.id),
            onAction: { action in
                Task { await viewModel.act(action, on: booking.id) }
            },
            onOpen: { detailTarget = BookingDetailTarget(id: booking.id, role: .host) }
        )
        .bookingRowChrome()
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if deletable {
                Button(role: .destructive) {
                    deleteTargetId = booking.id
                } label: {
                    Label("삭제", systemImage: "trash")
                }
            }
        }

        if isPast, booking.status == .confirmed {
            row.contextMenu {
                Button {
                    Task { await viewModel.act(.complete, on: booking.id) }
                } label: {
                    Label("완료 처리", systemImage: "checkmark.circle")
                }
            }
        } else {
            row
        }
    }

    /// 탭 배지(시간 요청 + 승인 대기)와 같은 셈이 보이게 — 시간 요청은 있을 때만
    private func hostStats(requestCount: Int, pendingCount: Int, upcomingCount: Int) -> some View {
        HStack(spacing: 6) {
            if requestCount > 0 {
                Text("시간 요청 \(requestCount)")
                    .foregroundStyle(.orange)
                Text("·")
                    .foregroundStyle(Theme.secondaryText)
            }
            Text("승인 대기 \(pendingCount)")
                .foregroundStyle(pendingCount > 0 ? .orange : Theme.secondaryText)
            Text("·")
                .foregroundStyle(Theme.secondaryText)
            Text("예정 \(upcomingCount)")
                .foregroundStyle(Theme.secondaryText)
        }
        .font(.caption.weight(.medium))
    }

    // MARK: - 내가 한 예약 (guest)

    private func guestList(_ bookings: [GuestBooking]) -> some View {
        let now = Date()
        let upcoming = bookings
            .filter { $0.scheduledAt >= now }
            .sorted { $0.scheduledAt < $1.scheduledAt }
        let past = bookings
            .filter { $0.scheduledAt < now }
            .sorted { $0.scheduledAt > $1.scheduledAt }

        return List {
            if !upcoming.isEmpty {
                Section {
                    ForEach(upcoming) { booking in
                        GuestBookingRow(
                            booking: booking,
                            isActing: viewModel.actingIds.contains(booking.id),
                            canCancel: booking.status == .pending || booking.status == .confirmed,
                            onCancel: { cancelTarget = booking },
                            onOpen: {
                                detailTarget = BookingDetailTarget(id: booking.id, role: .guest)
                            }
                        )
                        .bookingRowChrome()
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            if booking.status == .canceled || booking.status == .completed {
                                Button(role: .destructive) {
                                    deleteTargetId = booking.id
                                } label: {
                                    Label("삭제", systemImage: "trash")
                                }
                            }
                        }
                    }
                } header: {
                    sectionHeader("예정된 예약")
                }
            }

            if !past.isEmpty {
                Section {
                    ForEach(past) { booking in
                        GuestBookingRow(
                            booking: booking,
                            isActing: false,
                            canCancel: false,
                            onCancel: {},
                            onOpen: {
                                detailTarget = BookingDetailTarget(id: booking.id, role: .guest)
                            }
                        )
                        .bookingRowChrome()
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                deleteTargetId = booking.id
                            } label: {
                                Label("삭제", systemImage: "trash")
                            }
                        }
                    }
                } header: {
                    sectionHeader("지난 예약")
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    // MARK: - 섹션 헤더

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.secondaryText)
            .textCase(nil)
    }
}

// MARK: - 행 공통 스타일

private extension View {
    func bookingRowChrome() -> some View {
        self
            .listRowInsets(EdgeInsets(top: 5, leading: 16, bottom: 5, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
    }
}

// MARK: - 받은 예약 행

private struct HostBookingRow: View {
    let booking: HostBooking
    let isActing: Bool
    let onAction: (BookingAction) -> Void
    /// 카드 탭 → 예약 상세. 수락/거절 버튼은 자기 탭을 먼저 가져간다.
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(booking.slotTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    Text("\(booking.guestName) · \(booking.scheduledText)")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                StatusBadge(text: booking.badgeText, color: booking.badgeColor)
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .padding(.top, 3)
            }

            if let message = booking.message, !message.isEmpty {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(2)
            }

            if !booking.menus.isEmpty {
                Label("메뉴 \(booking.menus.count)개", systemImage: "fork.knife")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }

            if let payment = booking.payment {
                PaymentPill(payment: payment, priceCents: booking.priceCents)
            }

            if booking.status == .pending {
                HStack(spacing: 8) {
                    BookingActionButton(
                        title: booking.payment?.isAwaiting == true ? "입금 확인하고 확정" : "수락",
                        prominent: true,
                        disabled: isActing
                    ) {
                        onAction(.confirm)
                    }
                    BookingActionButton(title: "거절", prominent: false, disabled: isActing) {
                        onAction(.cancel)
                    }
                }
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .opacity(booking.status == .canceled ? 0.55 : 1)
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
    }
}

// MARK: - 받은 시간 요청 행

private struct TimeRequestRow: View {
    let request: ReceivedTimeRequest
    let isActing: Bool
    let onAccept: () -> Void
    let onDecline: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                DiscoverAvatar(
                    url: request.requester?.avatarUrl.flatMap(URL.init(string:)),
                    name: request.requesterName,
                    size: 32
                )
                VStack(alignment: .leading, spacing: 3) {
                    Text(request.requesterName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                    Text(detailLine)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                StatusBadge(text: "요청", color: Theme.accent)
            }

            Text(request.message)
                .font(.footnote)
                .foregroundStyle(Theme.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            if let preferred = request.preferredTimes, !preferred.isEmpty {
                Label("희망 시간: \(preferred)", systemImage: "clock")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }

            HStack(spacing: 8) {
                BookingActionButton(title: "시간 정해 수락", prominent: true, disabled: isActing, action: onAccept)
                BookingActionButton(title: "거절", prominent: false, disabled: isActing, action: onDecline)
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    /// "60분 · ₩30,000 제안 · 3시간 전"
    private var detailLine: String {
        var parts = ["\(request.durationMin)분"]
        if let cents = request.budgetCents, cents > 0 {
            parts.append("₩\((cents / 100).formatted()) 제안")
        }
        if let created = request.createdDate {
            parts.append(Self.relative.localizedString(for: created, relativeTo: Date()))
        }
        return parts.joined(separator: " · ")
    }

    private static let relative: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.unitsStyle = .full
        return f
    }()
}

/// 시간 요청 수락 — 시작 시각을 골라 확정 예약을 만든다(길이는 요청한 길이).
private struct AcceptTimeRequestSheet: View {
    let request: ReceivedTimeRequest
    let onAccept: (Date) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var start = AcceptTimeRequestSheet.defaultStart()
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("시작", selection: $start, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    LabeledContent("길이", value: "\(request.durationMin)분")
                } footer: {
                    Text("수락하면 이 시간으로 확정 예약이 생기고 \(request.requesterName)님에게 알림이 가요.")
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("시간 정해 수락")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("수락") {
                        isSaving = true
                        Task {
                            if await onAccept(start) { dismiss() }
                            isSaving = false
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.medium])
    }

    /// 다음 정시
    private static func defaultStart() -> Date {
        let cal = Calendar.current
        let next = Date().addingTimeInterval(3600)
        return cal.date(from: cal.dateComponents([.year, .month, .day, .hour], from: next)) ?? next
    }
}

// MARK: - 내가 한 예약 행

private struct GuestBookingRow: View {
    let booking: GuestBooking
    let isActing: Bool
    let canCancel: Bool
    let onCancel: () -> Void
    /// 카드 탭 → 예약 상세. 취소 버튼은 자기 탭을 먼저 가져간다.
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(booking.slotTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    Text("\(booking.hostName) · \(booking.scheduledText)")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                StatusBadge(text: booking.badgeText, color: booking.badgeColor)
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .padding(.top, 3)
            }

            if let location = booking.locationDetail, !location.isEmpty {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            }

            if let payment = booking.payment {
                PaymentPill(payment: payment, priceCents: booking.priceCents)
            }

            if canCancel {
                BookingActionButton(title: "예약 취소", prominent: false, disabled: isActing) {
                    onCancel()
                }
                .padding(.top, 2)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        .opacity(booking.status == .canceled ? 0.55 : 1)
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
    }
}

// MARK: - 액션 버튼

private struct BookingActionButton: View {
    let title: String
    let prominent: Bool
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(prominent ? Color.white : Color.red.opacity(0.9))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    prominent ? AnyShapeStyle(Theme.accent) : AnyShapeStyle(Theme.fill(0.08)),
                    in: Capsule()
                )
        }
        .buttonStyle(.borderless)
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }
}

// MARK: - 결제 상태

/// "입금 대기 · ₩50,000 · 10월 6일 (화) 23:00까지" / "입금 확인됨"
struct PaymentPill: View {
    let payment: BookingPayment
    let priceCents: Int

    var body: some View {
        let text: String = {
            if payment.isPaid { return "입금 확인됨 · \(PriceFormatter.won(priceCents))" }
            var parts = ["입금 대기", PriceFormatter.won(priceCents)]
            if let due = payment.dueText { parts.append(due) }
            return parts.joined(separator: " · ")
        }()
        Label(text, systemImage: payment.isPaid ? "checkmark.seal" : "banknote")
            .font(.caption.weight(.medium))
            .foregroundStyle(payment.isPaid ? Color.green : Color.orange)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((payment.isPaid ? Color.green : Color.orange).opacity(0.12), in: Capsule())
    }
}

// MARK: - 상태 뱃지

private struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.fill(0.08), in: Capsule())
    }
}

#Preview {
    BookingsView()
        .tint(Theme.accent)
}
