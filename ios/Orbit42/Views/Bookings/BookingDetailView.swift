import SwiftUI

/// 예약을 보는 입장 — 받은 예약(host) / 내가 한 예약(guest).
enum BookingRole {
    case host
    case guest
}

/// `navigationDestination(item:)` 로 상세를 push 하기 위한 대상.
struct BookingDetailTarget: Identifiable, Hashable {
    let id: String
    let role: BookingRole
}

/// 예약 상세 — 목록(받은 예약/내가 한 예약) 카드를 탭하면 push 된다.
/// 목록 뷰모델을 그대로 들고 id 로 매번 다시 찾아 표시하므로,
/// 여기서 수락/거절/취소하면 목록 새로고침 결과가 이 화면에도 바로 반영된다.
struct BookingDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AuthViewModel.self) private var auth

    let viewModel: BookingsViewModel
    let bookingId: String
    /// 이 예약을 어느 쪽 입장에서 보는지 (받은 예약 / 내가 한 예약)
    let role: BookingRole

    @State private var showingCancelConfirm = false
    @State private var showingReschedule = false

    private var hostBooking: HostBooking? {
        guard role == .host else { return nil }
        return viewModel.data?.host.first { $0.id == bookingId }
    }

    private var guestBooking: GuestBooking? {
        guard role == .guest else { return nil }
        return viewModel.data?.guest.first { $0.id == bookingId }
    }

    private var isActing: Bool { viewModel.actingIds.contains(bookingId) }

    /// 목록이 로드된 상태에서 이 예약이 사라졌으면 false.
    private var stillExists: Bool { viewModel.data == nil || detail != nil }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if let detail {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        summaryCard(detail)
                        if let proposal = detail.reschedule {
                            rescheduleBanner(proposal, detail: detail)
                        }
                        counterpartCard(detail)
                        if let location = detail.location, !location.isEmpty {
                            infoCard(title: "장소", icon: "mappin.and.ellipse") {
                                Text(location)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.primaryText)
                            }
                        }
                        if !detail.menus.isEmpty {
                            menusCard(detail.menus)
                        }
                        if let message = detail.message, !message.isEmpty {
                            infoCard(title: "메모", icon: "text.bubble") {
                                Text(message)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.primaryText)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        slotLink(detail)
                        actions(detail)
                    }
                    .padding(16)
                    .readableWidth()
                }
                .refreshable { await viewModel.load(force: true) }
            } else {
                // 목록에서 사라진 예약(삭제 등) — 잠깐 비었다가 닫힌다.
                ProgressView().tint(Theme.accent)
            }
        }
        .navigationTitle("예약 상세")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "이 예약을 취소할까요?",
            isPresented: $showingCancelConfirm,
            titleVisibility: .visible
        ) {
            Button("예약 취소", role: .destructive) {
                Task { await viewModel.act(.cancelMine, on: bookingId) }
            }
            Button("돌아가기", role: .cancel) {}
        } message: {
            Text(detail.map { "\($0.title) · \($0.dayText) \($0.timeRangeText)" } ?? "")
        }
        .sheet(isPresented: $showingReschedule) {
            if let detail {
                RescheduleSheet(
                    viewModel: viewModel,
                    bookingId: bookingId,
                    role: role,
                    currentStart: detail.start,
                    hostUsername: detail.slotUsername,
                    slotSlug: detail.slotSlug
                )
            }
        }
        // 삭제 등으로 목록에서 빠지면 상세도 닫는다.
        .onChange(of: stillExists) { _, exists in
            if !exists { dismiss() }
        }
    }

    // MARK: - 카드

    private func summaryCard(_ detail: Detail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                Text(detail.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                Spacer(minLength: 0)
                Text(detail.statusText)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(detail.statusColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(detail.statusColor.opacity(0.15), in: Capsule())
            }

            Divider().overlay(Theme.fill(0.08))

            HStack(spacing: 8) {
                Image(systemName: "calendar")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                Text(detail.dayText)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
            }
            HStack(spacing: 8) {
                Image(systemName: "clock")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                Text(detail.timeRangeText)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                Text(detail.durationText)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    /// 대기 중인 시간 변경 제안 — 내가 보낸 것이면 대기 안내, 받은 것이면 수락/거절.
    private func rescheduleBanner(
        _ proposal: BookingReschedule,
        detail: Detail
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                proposal.byMe ? "변경 제안을 보냈어요" : "상대가 시간 변경을 제안했어요",
                systemImage: "clock.arrow.circlepath"
            )
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.accent)

            HStack(spacing: 8) {
                Text(BookingDateFormatter.dateTime.string(from: detail.start))
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .strikethrough()
                Image(systemName: "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                Text(proposal.whenText)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
            }

            if let note = proposal.note, !note.isEmpty {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if proposal.byMe {
                Text("상대가 수락하면 예약과 캘린더가 함께 옮겨져요.")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            } else {
                HStack(spacing: 8) {
                    actionButton("수락", prominent: true) {
                        Task {
                            await viewModel.respondToReschedule(
                                bookingId: bookingId, accept: true
                            )
                        }
                    }
                    actionButton("거절", prominent: false) {
                        Task {
                            await viewModel.respondToReschedule(
                                bookingId: bookingId, accept: false
                            )
                        }
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Theme.accent.opacity(0.35), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func counterpartCard(_ detail: Detail) -> some View {
        let content = HStack(spacing: 10) {
            Image(systemName: "person.crop.circle")
                .font(.title3)
                .foregroundStyle(Theme.accent)
            VStack(alignment: .leading, spacing: 2) {
                Text(detail.counterpartLabel)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                Text(detail.counterpartName)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
            }
            Spacer(minLength: 0)
            if detail.counterpartUsername != nil {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))

        if let username = detail.counterpartUsername {
            NavigationLink { PersonProfileView(username: username) } label: { content }
                .buttonStyle(.plain)
        } else {
            content
        }
    }

    private func menusCard(_ menus: [BookingMenu]) -> some View {
        infoCard(title: "선택한 메뉴", icon: "fork.knife") {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(menus.enumerated()), id: \.offset) { _, menu in
                    HStack {
                        Text(menu.name)
                            .font(.subheadline)
                            .foregroundStyle(Theme.primaryText)
                        Spacer(minLength: 8)
                        Text(DiscoverFormat.priceText(cents: menu.priceCents))
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                if menus.count > 1 {
                    Divider().overlay(Theme.fill(0.08))
                    HStack {
                        Text("합계")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        Spacer()
                        Text(DiscoverFormat.priceText(
                            cents: menus.reduce(0) { $0 + $1.priceCents }
                        ))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func slotLink(_ detail: Detail) -> some View {
        if let username = detail.slotUsername, let slug = detail.slotSlug {
            NavigationLink {
                SlotBookingView(username: username, slug: slug)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "clock.badge.checkmark")
                        .font(.footnote)
                    Text("타임슬롯 보기")
                        .font(.subheadline.weight(.medium))
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Theme.secondaryText)
                }
                .foregroundStyle(Theme.accent)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
        }
    }

    private func infoCard<Content: View>(
        title: String,
        icon: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            content()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: - 액션

    /// 시간 변경을 걸 수 있는 예약인지 — 아직 안 지났고 진행 중인 것만.
    private func canReschedule(_ detail: Detail) -> Bool {
        (detail.status == .pending || detail.status == .confirmed)
            && detail.start > Date()
    }

    @ViewBuilder
    private func actions(_ detail: Detail) -> some View {
        VStack(spacing: 8) {
            if canReschedule(detail) {
                // 이미 대기 중인 제안이 있으면 새 제안이 그걸 덮어쓴다.
                let hasProposal = detail.reschedule != nil
                actionButton(
                    hasProposal
                        ? "다른 시간 제안"
                        : (role == .host ? "시간 변경 제안" : "시간 변경"),
                    prominent: false,
                    tint: Theme.accent
                ) {
                    showingReschedule = true
                }
            }
            if role == .host {
                if detail.status == .pending {
                    HStack(spacing: 8) {
                        actionButton("수락", prominent: true) {
                            Task { await viewModel.act(.confirm, on: bookingId) }
                        }
                        actionButton("거절", prominent: false) {
                            Task { await viewModel.act(.cancel, on: bookingId) }
                        }
                    }
                } else if detail.status == .confirmed, detail.end < Date() {
                    actionButton("완료 처리", prominent: true) {
                        Task { await viewModel.act(.complete, on: bookingId) }
                    }
                } else if detail.status == .confirmed {
                    actionButton("예약 취소", prominent: false) {
                        Task { await viewModel.act(.cancel, on: bookingId) }
                    }
                }
            } else if detail.status == .pending || detail.status == .confirmed {
                actionButton("예약 취소", prominent: false) {
                    showingCancelConfirm = true
                }
            }
        }
        .padding(.top, 2)
    }

    /// - Parameter tint: 보조 버튼의 글자색. 기본은 파괴적 동작(취소/거절)을 뜻하는 빨강.
    private func actionButton(
        _ title: String,
        prominent: Bool,
        tint: Color? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(prominent ? Color.white : (tint ?? Color.red.opacity(0.9)))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    prominent ? AnyShapeStyle(Theme.accent) : AnyShapeStyle(Theme.fill(0.08)),
                    in: Capsule()
                )
        }
        .buttonStyle(.plain)
        .disabled(isActing)
        .opacity(isActing ? 0.5 : 1)
    }

    // MARK: - 표시 모델 (host/guest 공통)

    private struct Detail {
        let title: String
        let status: BookingStatus?
        let statusText: String
        let statusColor: Color
        let start: Date
        let end: Date
        let counterpartLabel: String
        let counterpartName: String
        let counterpartUsername: String?
        let location: String?
        let message: String?
        let menus: [BookingMenu]
        let slotUsername: String?
        let slotSlug: String?
        let reschedule: BookingReschedule?

        var dayText: String { DiscoverFormat.dayHeader.string(from: start) }

        var timeRangeText: String {
            let from = BookingDateFormatter.time.string(from: start)
            let to = BookingDateFormatter.time.string(from: end)
            return "\(from) – \(to)"
        }

        var durationText: String {
            let minutes = max(0, Int(end.timeIntervalSince(start) / 60))
            if minutes >= 60 {
                let hours = minutes / 60
                let rest = minutes % 60
                return rest == 0 ? "(\(hours)시간)" : "(\(hours)시간 \(rest)분)"
            }
            return "(\(minutes)분)"
        }
    }

    private var detail: Detail? {
        if let booking = hostBooking {
            return Detail(
                title: booking.slotTitle,
                status: booking.status,
                statusText: booking.badgeText,
                statusColor: booking.badgeColor,
                start: booking.scheduledAt,
                end: booking.scheduledEndAt,
                counterpartLabel: "게스트",
                counterpartName: booking.guestName,
                counterpartUsername: booking.guestUsername,
                location: booking.locationDetail,
                message: booking.message,
                menus: booking.menus,
                // 받은 예약의 슬롯은 내 슬롯이다.
                slotUsername: auth.user?.username,
                slotSlug: booking.slotSlug,
                reschedule: booking.reschedule
            )
        }
        if let booking = guestBooking {
            return Detail(
                title: booking.slotTitle,
                status: booking.status,
                statusText: booking.badgeText,
                statusColor: booking.badgeColor,
                start: booking.scheduledAt,
                end: booking.scheduledEndAt,
                counterpartLabel: "호스트",
                counterpartName: booking.hostName,
                counterpartUsername: booking.hostUsername,
                location: booking.locationDetail,
                message: booking.message,
                menus: booking.menus,
                slotUsername: booking.hostUsername,
                slotSlug: booking.slotSlug,
                reschedule: booking.reschedule
            )
        }
        return nil
    }
}
