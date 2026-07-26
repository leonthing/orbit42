import SwiftUI

/// 예약 탭 — 받은 예약(host) / 내가 한 예약(guest) 관리.
/// 수락·거절·완료 처리(host), 예약 취소(guest)를 지원한다.
struct BookingsView: View {
    @State private var viewModel = BookingsViewModel()
    /// "예약 취소" 확인 다이얼로그 대상 (guest)
    @State private var cancelTarget: GuestBooking?

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack(spacing: 0) {
                    segmentPicker
                    content
                }
            }
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
            .task {
                await viewModel.load()
            }
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
                if data.host.isEmpty {
                    emptyState(
                        icon: "tray",
                        title: "받은 예약이 없어요",
                        message: "타임슬롯을 공유하면 받은 예약이 이곳에 모여요"
                    )
                } else {
                    hostList(data.host)
                }
            case .guest:
                if data.guest.isEmpty {
                    emptyState(
                        icon: "calendar.badge.clock",
                        title: "예약한 일정이 없어요",
                        message: "다른 사람의 타임슬롯을 예약하면 이곳에 보여요"
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

    private func emptyState(icon: String, title: String, message: String) -> some View {
        ScrollView {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 44, weight: .light))
                    .foregroundStyle(Theme.accent)
                Text(title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                Text(message)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
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

    private func hostList(_ bookings: [HostBooking]) -> some View {
        let now = Date()
        let upcoming = bookings
            .filter { $0.scheduledAt >= now }
            .sorted { $0.scheduledAt < $1.scheduledAt }
        let past = bookings
            .filter { $0.scheduledAt < now }
            .sorted { $0.scheduledAt > $1.scheduledAt }
        let pendingCount = bookings.filter { $0.status == .pending }.count
        let upcomingCount = upcoming
            .filter { $0.status == .pending || $0.status == .confirmed }
            .count

        return List {
            hostStats(pendingCount: pendingCount, upcomingCount: upcomingCount)
                .bookingRowChrome()

            if !upcoming.isEmpty {
                Section {
                    ForEach(upcoming) { booking in
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
        let row = HostBookingRow(
            booking: booking,
            isActing: viewModel.actingIds.contains(booking.id),
            onAction: { action in
                Task { await viewModel.act(action, on: booking.id) }
            }
        )
        .bookingRowChrome()

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

    private func hostStats(pendingCount: Int, upcomingCount: Int) -> some View {
        HStack(spacing: 6) {
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
                            onCancel: { cancelTarget = booking }
                        )
                        .bookingRowChrome()
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
                            onCancel: {}
                        )
                        .bookingRowChrome()
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

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(booking.slotTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("\(booking.guestName) · \(booking.scheduledText)")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                StatusBadge(text: booking.badgeText, color: booking.badgeColor)
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

            if booking.status == .pending {
                HStack(spacing: 8) {
                    BookingActionButton(title: "수락", prominent: true, disabled: isActing) {
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
    }
}

// MARK: - 내가 한 예약 행

private struct GuestBookingRow: View {
    let booking: GuestBooking
    let isActing: Bool
    let canCancel: Bool
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(booking.slotTitle)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("\(booking.hostName) · \(booking.scheduledText)")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                StatusBadge(text: booking.badgeText, color: booking.badgeColor)
            }

            if let location = booking.locationDetail, !location.isEmpty {
                Label(location, systemImage: "mappin.and.ellipse")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
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
                    prominent ? AnyShapeStyle(Theme.accent) : AnyShapeStyle(Color.white.opacity(0.08)),
                    in: Capsule()
                )
        }
        .buttonStyle(.borderless)
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
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
            .background(Color.white.opacity(0.08), in: Capsule())
    }
}

#Preview {
    BookingsView()
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
