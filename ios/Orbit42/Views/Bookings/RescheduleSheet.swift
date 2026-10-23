import SwiftUI

/// 예약 시간 변경 요청 시트.
///
/// 게스트는 ①호스트가 열어둔 가용 시간에서 바로 바꾸거나(대부분 호스트 확인 없이 반영),
/// ②그 밖의 시각을 호스트에게 제안할 수 있다(개선-29, 호스트가 수락해야 옮겨진다).
/// 열린 시간이 없으면 ②만 보인다.
/// 호스트는 자기 일정이라 아무 시각이나 고를 수 있지만, 게스트가 그 시간에
/// 올 수 있는지는 알 수 없으므로 "제안"이 되어 상대 수락을 기다린다.
struct RescheduleSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: BookingsViewModel
    let bookingId: String
    let role: BookingRole
    /// 현재 예약 시각 — 기본값·비교 표시용
    let currentStart: Date
    /// 게스트일 때 가용 시간을 불러올 대상 (호스트 username + 슬롯 slug)
    let hostUsername: String?
    let slotSlug: String?

    @State private var options: [BookingOption]?
    @State private var loadError: String?
    @State private var pickedOptionId: String?
    /// 호스트 자유 선택
    @State private var pickedDate: Date
    @State private var note = ""
    @State private var isSubmitting = false
    /// 게스트: 열린 시간에서 바꾸기 / 다른 시간 제안
    @State private var guestMode: GuestMode = .open

    enum GuestMode: Hashable { case open, propose }

    /// 게스트가 제안 화면을 보고 있는지 — 열린 시간이 없으면 늘 제안
    private var guestProposing: Bool {
        role == .guest && (guestMode == .propose || options?.isEmpty == true)
    }

    init(
        viewModel: BookingsViewModel,
        bookingId: String,
        role: BookingRole,
        currentStart: Date,
        hostUsername: String?,
        slotSlug: String?
    ) {
        self.viewModel = viewModel
        self.bookingId = bookingId
        self.role = role
        self.currentStart = currentStart
        self.hostUsername = hostUsername
        self.slotSlug = slotSlug
        // 기본값은 현재 시각 이후로 — 지난 시각이 기본으로 잡히면 바로 에러가 난다.
        _pickedDate = State(initialValue: max(currentStart, Date().addingTimeInterval(3600)))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Group {
                    switch role {
                    case .guest: guestContent
                    case .host: hostPicker
                    }
                }
            }
            .navigationTitle("시간 변경")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(role == .host || guestProposing ? "제안" : "변경") {
                        submit()
                    }
                    .font(.body.weight(.semibold))
                    .disabled(!canSubmit || isSubmitting)
                }
            }
            .task {
                if role == .guest { await loadOptions() }
            }
        }
    }

    // MARK: - 게스트: 열린 시간에서 바꾸기 / 다른 시간 제안

    @ViewBuilder
    private var guestContent: some View {
        VStack(spacing: 0) {
            if let options, !options.isEmpty {
                Picker("변경 방법", selection: $guestMode) {
                    Text("열린 시간에서 바꾸기").tag(GuestMode.open)
                    Text("다른 시간 제안").tag(GuestMode.propose)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 4)
            }
            if guestProposing {
                proposeForm(
                    footer: options?.isEmpty == true
                        ? "지금은 열린 시간이 없어요. 원하시는 시간을 제안해 보세요. 호스트가 수락하시면 예약과 캘린더가 함께 옮겨져요."
                        : "열린 시간 밖이라도 괜찮아요. 호스트가 수락하시면 예약과 캘린더가 함께 옮겨져요.",
                    noteHint: "\"그날은 출장이라 다음 주가 좋아요\" 처럼 한 줄 적어 주시면 호스트가 판단하기 쉬워요."
                )
            } else {
                guestPicker
            }
        }
    }

    @ViewBuilder
    private var guestPicker: some View {
        if let options {
            if options.isEmpty {
                emptyOptions
            } else {
                List {
                    Section {
                        currentRow
                    }
                    ForEach(groupedDays(options), id: \.day) { group in
                        Section {
                            ForEach(group.options) { option in
                                optionRow(option)
                            }
                        } header: {
                            Text(DiscoverFormat.dayHeader.string(from: group.day))
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.secondaryText)
                                .textCase(nil)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        } else if let loadError {
            VStack(spacing: 12) {
                Text(loadError)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.secondaryText)
                Button("다시 시도") { Task { await loadOptions() } }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
            }
            .padding(32)
        } else {
            ProgressView().tint(Theme.accent)
        }
    }

    private var emptyOptions: some View {
        VStack(spacing: 10) {
            Image(systemName: "calendar.badge.exclamationmark")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("옮길 수 있는 시간이 없어요")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.primaryText)
            Text("호스트가 새 시간을 열면 그때 변경할 수 있어요")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(32)
    }

    private var currentRow: some View {
        HStack {
            Text("지금 예약")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            Spacer()
            Text(BookingDateFormatter.dateTime.string(from: currentStart))
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.secondaryText)
        }
    }

    private func optionRow(_ option: BookingOption) -> some View {
        Button {
            pickedOptionId = option.id
        } label: {
            HStack {
                Text(option.timeText)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                Spacer()
                if pickedOptionId == option.id {
                    Image(systemName: "checkmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// 옵션을 날짜별로 묶는다 (기기 로컬 타임존 기준).
    private func groupedDays(_ options: [BookingOption]) -> [(day: Date, options: [BookingOption])] {
        let calendar = Calendar.current
        let grouped = Dictionary(grouping: options) { calendar.startOfDay(for: $0.startAt) }
        return grouped
            .map { (day: $0.key, options: $0.value.sorted { $0.startAt < $1.startAt }) }
            .sorted { $0.day < $1.day }
    }

    // MARK: - 호스트: 자유 선택 + 사유

    private var hostPicker: some View {
        proposeForm(
            footer: "게스트가 수락하면 예약과 캘린더가 함께 옮겨져요.",
            noteHint: "\"급한 회의가 잡혀서요\" 처럼 한 줄 적어두면 상대가 판단하기 쉬워요."
        )
    }

    /// 아무 시각이나 고르고 한 줄 사유를 붙이는 제안 화면 — 호스트 제안과 게스트 제안이 같이 쓴다.
    private func proposeForm(footer: String, noteHint: String) -> some View {
        Form {
            Section {
                currentRow
                DatePicker(
                    "새 시간",
                    selection: $pickedDate,
                    in: Date()...,
                    displayedComponents: [.date, .hourAndMinute]
                )
                .datePickerStyle(.compact)
            } footer: {
                Text(footer)
            }

            Section {
                TextField("변경 사유 (선택)", text: $note, axis: .vertical)
                    .lineLimit(2...4)
            } footer: {
                Text(noteHint)
            }
        }
        .scrollContentBackground(.hidden)
    }

    // MARK: - 제출

    private var canSubmit: Bool {
        switch role {
        case .guest: return guestProposing ? pickedDate > Date() : pickedOptionId != nil
        case .host: return pickedDate > Date()
        }
    }

    private func submit() {
        guard canSubmit else { return }
        isSubmitting = true
        Task {
            defer { isSubmitting = false }
            let ok: Bool
            switch role {
            case .guest where guestProposing:
                ok = await viewModel.requestReschedule(
                    bookingId: bookingId,
                    startAt: APIDateParser.encodeDateTime(pickedDate),
                    availabilityId: nil,
                    note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? nil
                        : note,
                    propose: true
                )
            case .guest:
                guard let picked = (options ?? []).first(where: { $0.id == pickedOptionId })
                else { return }
                ok = await viewModel.requestReschedule(
                    bookingId: bookingId,
                    // availabilityId 가 있으면 그쪽이 우선 — 수동 슬롯의 점유 행을 특정한다.
                    startAt: picked.availabilityId == nil ? picked.startAtRaw : nil,
                    availabilityId: picked.availabilityId,
                    note: nil
                )
            case .host:
                ok = await viewModel.requestReschedule(
                    bookingId: bookingId,
                    startAt: APIDateParser.encodeDateTime(pickedDate),
                    availabilityId: nil,
                    note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? nil
                        : note
                )
            }
            if ok { dismiss() }
        }
    }

    private func loadOptions() async {
        guard let hostUsername, let slotSlug else {
            loadError = "이 예약은 앱에서 시간을 고를 수 없어요."
            return
        }
        loadError = nil
        do {
            let response: SlotBookingResponse = try await APIClient.shared.get(
                "/api/v1/users/\(hostUsername)/slots/\(slotSlug)"
            )
            // 지금 잡혀 있는 시각은 후보에서 뺀다 (같은 시간으로 "변경"은 의미가 없다).
            options = response.options.filter {
                abs($0.startAt.timeIntervalSince(currentStart)) > 60
            }
        } catch {
            loadError = "가능한 시간을 불러오지 못했어요. 네트워크를 확인해 주세요."
        }
    }
}
