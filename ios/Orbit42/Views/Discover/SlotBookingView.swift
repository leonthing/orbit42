import SwiftUI

/// 타인 슬롯 예약 화면 — 슬롯 정보 + 장소 선택 + 날짜별 예약 가능 시간 + 예약 확인 시트.
struct SlotBookingView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: SlotBookingViewModel
    /// 예약 확인 시트에 올라간 옵션
    @State private var confirmingOption: BookingOption?

    init(username: String, slug: String) {
        _viewModel = State(initialValue: SlotBookingViewModel(username: username, slug: slug))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("예약")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $confirmingOption) { option in
            BookingConfirmSheet(viewModel: viewModel, option: option)
                .presentationDetents([.medium])
        }
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
        .task {
            await viewModel.load()
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let status = viewModel.bookedStatus {
            successView(confirmed: status == "confirmed")
        } else if let data = viewModel.data {
            loaded(data)
        } else if viewModel.isLoading {
            VStack(spacing: 12) {
                ProgressView()
                    .tint(Theme.accent)
                Text("슬롯 정보를 불러오는 중이에요")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let message = viewModel.errorMessage {
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
        } else {
            Color.clear
        }
    }

    private func loaded(_ data: SlotBookingResponse) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                slotInfo(data.slot)

                if data.slot.isMine {
                    noteCard(
                        icon: "person.crop.circle.badge.checkmark",
                        text: "내가 연 슬롯이에요. 예약 현황은 예약 탭에서 확인해요."
                    )
                } else if let notice = data.auctionNotice {
                    noteCard(icon: "hammer", text: notice)
                } else {
                    if data.slot.locations.count > 1 {
                        locationPicker(data.slot.locations)
                    }
                    optionsSection(data)
                }
            }
            .padding(16)
        }
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    // MARK: - 슬롯 정보

    private func slotInfo(_ slot: BookableSlot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(slot.title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)

            HStack(spacing: 6) {
                Image(systemName: "person.circle")
                    .font(.footnote)
                Text(slot.hostDisplayName)
                Text("@\(slot.hostUsername)")
                    .foregroundStyle(Theme.accent)
            }
            .font(.footnote)
            .foregroundStyle(Theme.secondaryText)

            HStack(spacing: 8) {
                infoBadge(icon: "clock", text: slot.durationText)
                infoBadge(
                    icon: slot.priceCents == 0 && !slot.isAuction ? "gift" : "wonsign.circle",
                    text: slot.isAuction ? "경매" : slot.priceText
                )
                if slot.autoApprove {
                    infoBadge(icon: "bolt", text: "자동 확정")
                }
            }

            if let description = slot.description, !description.isEmpty {
                Text(description)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func infoBadge(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(text)
        }
        .font(.caption.weight(.medium))
        .foregroundStyle(.white.opacity(0.85))
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.white.opacity(0.08), in: Capsule())
    }

    private func noteCard(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(Theme.accent)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - 장소 선택

    private func locationPicker(_ locations: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("장소")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            Menu {
                ForEach(locations, id: \.self) { location in
                    Button {
                        Task { await viewModel.selectLocation(location) }
                    } label: {
                        if location == viewModel.selectedLocation {
                            Label(location, systemImage: "checkmark")
                        } else {
                            Text(location)
                        }
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.footnote)
                        .foregroundStyle(Theme.accent)
                    Text(viewModel.selectedLocation ?? locations[0])
                        .font(.subheadline)
                        .foregroundStyle(.white)
                    Spacer(minLength: 0)
                    if viewModel.isReloadingOptions {
                        ProgressView()
                            .controlSize(.small)
                            .tint(Theme.accent)
                    } else {
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 12)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            }
            .disabled(viewModel.isReloadingOptions)
        }
    }

    // MARK: - 예약 가능 시간

    @ViewBuilder
    private func optionsSection(_ data: SlotBookingResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("예약 가능 시간")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)

            if data.options.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.system(size: 28, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text("지금은 예약 가능한 시간이 없어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                    Text("나중에 다시 확인해보세요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            } else {
                BookingMiniCalendar(viewModel: viewModel)

                if let dayText = viewModel.selectedDayText {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(dayText)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 76), spacing: 8)],
                            alignment: .leading,
                            spacing: 8
                        ) {
                            ForEach(viewModel.optionsForSelectedDay) { option in
                                timeChip(option)
                            }
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
        .opacity(viewModel.isReloadingOptions ? 0.4 : 1)
    }

    private func timeChip(_ option: BookingOption) -> some View {
        Button {
            confirmingOption = option
        } label: {
            VStack(spacing: 2) {
                Text(option.timeText)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                if option.remaining > 1 {
                    Text("\(option.remaining)자리")
                        .font(.caption2)
                        .foregroundStyle(Theme.secondaryText)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Theme.accent.opacity(0.4), lineWidth: 1)
            )
        }
        .disabled(viewModel.isReloadingOptions)
    }

    // MARK: - 성공 화면

    private func successView(confirmed: Bool) -> some View {
        VStack(spacing: 16) {
            Image(systemName: confirmed ? "checkmark.circle.fill" : "clock.badge.checkmark")
                .font(.system(size: 56, weight: .light))
                .foregroundStyle(confirmed ? Color.green : Color.orange)
            Text(confirmed ? "예약이 확정됐어요" : "예약을 요청했어요")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.white)
            Text(
                confirmed
                    ? "예약 탭 > 내가 한 예약에서 확인할 수 있어요"
                    : "호스트 승인을 기다려요\n예약 탭 > 내가 한 예약에서 확인할 수 있어요"
            )
            .font(.subheadline)
            .multilineTextAlignment(.center)
            .foregroundStyle(Theme.secondaryText)

            Button {
                dismiss()
            } label: {
                Text("확인")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 40)
                    .padding(.vertical, 12)
                    .background(Theme.accent, in: Capsule())
            }
            .padding(.top, 8)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationBarBackButtonHidden(true)
    }
}

// MARK: - 미니 월 캘린더

/// 옵션이 존재하는 날짜만 선택할 수 있는 미니 월 캘린더.
/// 월 이동은 옵션이 존재하는 달 범위 안에서만 가능하다.
private struct BookingMiniCalendar: View {
    let viewModel: SlotBookingViewModel

    /// 헤더가 일요일 시작이므로 로케일과 무관하게 firstWeekday 를 일요일로 고정.
    private static let gridCalendar: Calendar = {
        var calendar = Calendar.current
        calendar.firstWeekday = 1
        return calendar
    }()

    private var calendar: Calendar { Self.gridCalendar }

    var body: some View {
        VStack(spacing: 8) {
            monthHeader
            weekdayHeader
            monthGrid
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - 월 헤더

    private var monthHeader: some View {
        HStack {
            Button {
                withAnimation { viewModel.showPreviousMonth() }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(viewModel.canShowPreviousMonth ? Theme.accent : Theme.secondaryText.opacity(0.4))
                    .frame(width: 40, height: 40)
            }
            .disabled(!viewModel.canShowPreviousMonth)
            .accessibilityLabel("이전 달")

            Spacer()

            Text(Self.monthTitleFormatter.string(from: viewModel.displayedMonth))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)

            Spacer()

            Button {
                withAnimation { viewModel.showNextMonth() }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(viewModel.canShowNextMonth ? Theme.accent : Theme.secondaryText.opacity(0.4))
                    .frame(width: 40, height: 40)
            }
            .disabled(!viewModel.canShowNextMonth)
            .accessibilityLabel("다음 달")
        }
        .padding(.horizontal, 4)
    }

    // MARK: - 요일 헤더 (일요일 시작)

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(Array(Self.weekdaySymbols.enumerated()), id: \.offset) { index, symbol in
                Text(symbol)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(weekdayColor(at: index))
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 4)
    }

    private func weekdayColor(at index: Int) -> Color {
        switch index {
        case 0: return Color(red: 0.94, green: 0.45, blue: 0.45)   // 일
        case 6: return Color(red: 0.45, green: 0.62, blue: 0.94)   // 토
        default: return Theme.secondaryText
        }
    }

    // MARK: - 월 그리드

    private var monthGrid: some View {
        let availableDays = viewModel.availableDays
        let selectedDay = viewModel.selectedDay
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 2) {
            ForEach(Array(monthDays.enumerated()), id: \.offset) { _, day in
                if let day {
                    dayCell(
                        day,
                        isAvailable: availableDays.contains(day),
                        isSelected: selectedDay.map { calendar.isDate(day, inSameDayAs: $0) } ?? false
                    )
                } else {
                    Color.clear.frame(height: 40)
                }
            }
        }
        .padding(.horizontal, 4)
    }

    private func dayCell(_ day: Date, isAvailable: Bool, isSelected: Bool) -> some View {
        Button {
            viewModel.selectDay(day)
        } label: {
            VStack(spacing: 2) {
                Text("\(calendar.component(.day, from: day))")
                    .font(.callout.weight(isSelected ? .semibold : .regular))
                    .foregroundStyle(isAvailable ? .white : Theme.secondaryText.opacity(0.45))
                    .frame(width: 32, height: 32)
                    .background {
                        if isSelected {
                            Circle().fill(Theme.accent)
                        }
                    }

                Circle()
                    .fill(isAvailable && !isSelected ? Theme.accent : .clear)
                    .frame(width: 4.5, height: 4.5)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 40)
        }
        .buttonStyle(.plain)
        .disabled(!isAvailable)
    }

    /// 표시 중인 달의 셀 배열 — 앞뒤를 nil 로 패딩해 7의 배수를 맞춘다.
    private var monthDays: [Date?] {
        let first = viewModel.displayedMonth
        guard let range = calendar.range(of: .day, in: .month, for: first) else { return [] }
        let leading = (calendar.component(.weekday, from: first) - calendar.firstWeekday + 7) % 7
        var days: [Date?] = Array(repeating: nil, count: leading)
        for offset in 0..<range.count {
            days.append(calendar.date(byAdding: .day, value: offset, to: first))
        }
        while days.count % 7 != 0 { days.append(nil) }
        return days
    }

    /// "2026년 7월"
    private static let monthTitleFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        formatter.timeZone = .current
        return formatter
    }()

    private static let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]
}

// MARK: - 예약 확인 시트

/// 선택한 시간 + 메시지(선택) + "예약하기".
private struct BookingConfirmSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: SlotBookingViewModel
    let option: BookingOption

    @State private var message = ""
    /// 예약 실패 안내 — 시트 위에서는 부모의 alert 가 뜨지 못하므로 인라인으로 보여준다.
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        if let slot = viewModel.data?.slot {
                            Text(slot.title)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.white)
                        }
                        Label(
                            DiscoverFormat.dateTime.string(from: option.startAt),
                            systemImage: "calendar"
                        )
                        .font(.footnote)
                        .foregroundStyle(Theme.accent)
                        if let location = viewModel.selectedLocation {
                            Label(location, systemImage: "mappin.and.ellipse")
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Theme.surface)

                Section {
                    TextField("메시지 (선택)", text: $message, axis: .vertical)
                        .lineLimit(3...6)
                        .foregroundStyle(.white)
                } footer: {
                    Text("호스트에게 전할 말을 남길 수 있어요")
                        .foregroundStyle(Theme.secondaryText)
                }
                .listRowBackground(Theme.surface)

                if let errorText {
                    Section {
                        Text(errorText)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    Button {
                        book()
                    } label: {
                        if viewModel.isBooking {
                            ProgressView()
                                .tint(Theme.accent)
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("예약하기")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Theme.accent)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(viewModel.isBooking)
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("예약 확인")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(viewModel.isBooking)
                }
            }
            .interactiveDismissDisabled(viewModel.isBooking)
        }
        .preferredColorScheme(.dark)
    }

    private func book() {
        errorText = nil
        Task {
            if await viewModel.book(option: option, message: message) {
                dismiss()
            } else {
                errorText = viewModel.actionMessage ?? "예약하지 못했어요. 네트워크를 확인해 주세요."
                viewModel.actionMessage = nil
            }
        }
    }
}

#Preview {
    NavigationStack {
        SlotBookingView(username: "leo", slug: "coffee")
    }
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
