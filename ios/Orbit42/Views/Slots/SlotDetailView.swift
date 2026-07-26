import SwiftUI

// MARK: - 내비게이션 라우트

/// 슬롯 목록 → 상세 push 용 값. 로딩 전에도 제목을 표시하기 위해 title 을 함께 넘긴다.
struct SlotRoute: Hashable {
    let id: String
    let title: String
}

// MARK: - 타임슬롯 상세 편집

/// 타임슬롯 상세 편집 화면.
/// `GET /api/v1/slots/{id}` 로 로드하고, 변경 필드만 모아 `PATCH` 한다.
/// 하단에 예약 가능 시간 미리보기(`GET .../availability`)를 함께 보여준다.
struct SlotDetailView: View {
    let route: SlotRoute
    let listViewModel: SlotsViewModel

    @State private var viewModel: SlotDetailViewModel
    @State private var showingAddWindowSheet = false
    @State private var newWindowDate = Date()

    init(route: SlotRoute, listViewModel: SlotsViewModel) {
        self.route = route
        self.listViewModel = listViewModel
        _viewModel = State(initialValue: SlotDetailViewModel(slotId: route.id))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle(viewModel.detail?.title ?? route.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel.isSaving {
                    ProgressView()
                        .tint(Theme.accent)
                } else {
                    Button("저장") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .disabled(viewModel.detail == nil)
                }
            }
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
        .sheet(isPresented: $showingAddWindowSheet) {
            addWindowSheet
        }
        .task {
            await viewModel.load()
        }
    }

    private func save() async {
        if await viewModel.save(), let detail = viewModel.detail {
            listViewModel.applyUpdated(detail.asTimeSlot)
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if viewModel.detail != nil {
            editorForm
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
            Text("슬롯 정보를 불러오는 중이에요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
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
                Task { await viewModel.load() }
            } label: {
                Text("다시 시도")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
    }

    // MARK: - 편집 폼

    private var editorForm: some View {
        Form {
            basicSection
            priceSection
            locationSection
            modeSection
            if viewModel.mode == "auto" {
                autoSettingsSection
                workingHoursSection
            } else {
                windowsSection
            }
            validitySection
            previewSection
        }
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: 기본 정보

    private var basicSection: some View {
        Section("기본 정보") {
            TextField("제목", text: $viewModel.title)

            ZStack(alignment: .topLeading) {
                if viewModel.descriptionText.isEmpty {
                    Text("설명")
                        .foregroundStyle(Theme.secondaryText.opacity(0.6))
                        .padding(.top, 8)
                        .padding(.leading, 4)
                }
                TextEditor(text: $viewModel.descriptionText)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 76, maxHeight: 120)
            }

            Picker("슬롯 유형", selection: $viewModel.slotType) {
                Text("1:1").tag("1on1")
                Text("동행").tag("companion")
                Text("그룹").tag("group")
            }

            Picker("소요시간", selection: $viewModel.durationMin) {
                ForEach(optionList([15, 30, 45, 60, 90, 120], current: viewModel.durationMin), id: \.self) { minutes in
                    Text("\(minutes)분").tag(minutes)
                }
            }

            Stepper("정원 \(viewModel.capacity)명", value: $viewModel.capacity, in: 1...20)

            Toggle("자동 승인", isOn: $viewModel.autoApprove)
                .tint(Theme.accent)
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: 가격

    private var priceSection: some View {
        Section {
            if viewModel.detail?.isAuction == true {
                Label("경매 슬롯의 가격 설정은 웹에서 관리해요", systemImage: "lock")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
            } else {
                HStack {
                    TextField("0", text: $viewModel.priceWonText)
                        .keyboardType(.numberPad)
                        .onChange(of: viewModel.priceWonText) { _, newValue in
                            let filtered = newValue.filter(\.isNumber)
                            if filtered != newValue { viewModel.priceWonText = filtered }
                        }
                    Text("원")
                        .foregroundStyle(Theme.secondaryText)
                }
            }
        } header: {
            Text("가격")
        } footer: {
            if viewModel.detail?.isAuction != true {
                Text("0원이면 무료로 열려요")
            }
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: 위치

    private var locationSection: some View {
        Section {
            ForEach(viewModel.locations.indices, id: \.self) { index in
                Text(viewModel.locations[index])
            }
            .onDelete { offsets in
                viewModel.locations.remove(atOffsets: offsets)
            }

            HStack {
                TextField("위치 추가 (예: 강남역, 온라인)", text: $viewModel.newLocationText)
                    .onSubmit { viewModel.addLocation() }
                Button {
                    viewModel.addLocation()
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Theme.accent)
                }
                .buttonStyle(.borderless)
                .disabled(viewModel.newLocationText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityLabel("위치 추가")
            }
        } header: {
            Text("위치")
        } footer: {
            if !viewModel.locations.isEmpty {
                Text("왼쪽으로 밀면 삭제할 수 있어요")
            }
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: 예약 방식

    private var modeSection: some View {
        Section("예약 방식") {
            Picker("방식", selection: $viewModel.mode) {
                Text("자동(캘린더 기반)").tag("auto")
                Text("수동(직접 시간 등록)").tag("manual")
            }
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: 자동 모드 설정

    private var autoSettingsSection: some View {
        Section("자동 예약 설정") {
            Picker("시간 간격", selection: $viewModel.slotIntervalMin) {
                ForEach(optionList([15, 30, 60], current: viewModel.slotIntervalMin), id: \.self) { minutes in
                    Text("\(minutes)분").tag(minutes)
                }
            }
            Picker("최소 통지", selection: $viewModel.minNoticeHours) {
                ForEach(optionList([1, 3, 6, 12, 24, 48], current: viewModel.minNoticeHours), id: \.self) { hours in
                    Text("\(hours)시간 전").tag(hours)
                }
            }
            Picker("최대 예약 가능", selection: $viewModel.maxAdvanceDays) {
                ForEach(optionList([7, 14, 30, 60, 90], current: viewModel.maxAdvanceDays), id: \.self) { advanceDays in
                    Text("\(advanceDays)일 후까지").tag(advanceDays)
                }
            }
            Picker("이동 버퍼", selection: $viewModel.bufferMin) {
                ForEach(optionList([0, 10, 15, 30], current: viewModel.bufferMin), id: \.self) { minutes in
                    Text(minutes == 0 ? "없음" : "\(minutes)분").tag(minutes)
                }
            }
        }
        .listRowBackground(Theme.surface)
    }

    private var workingHoursSection: some View {
        Section {
            ForEach($viewModel.days) { $day in
                VStack(spacing: 8) {
                    Toggle("\(day.label)요일", isOn: $day.enabled)
                        .tint(Theme.accent)
                    if day.enabled {
                        HStack(spacing: 16) {
                            DatePicker("시작", selection: $day.start, displayedComponents: .hourAndMinute)
                                .font(.subheadline)
                            DatePicker("종료", selection: $day.end, displayedComponents: .hourAndMinute)
                                .font(.subheadline)
                        }
                        .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
        } header: {
            Text("요일별 근무시간")
        } footer: {
            if viewModel.hasMultiIntervalDay {
                Text("여러 구간이 설정된 요일은 첫 구간만 편집할 수 있어요. 여러 구간은 웹에서 편집할 수 있어요")
            }
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: 수동 모드 — 시간 창

    private var windowsSection: some View {
        Section {
            if let windows = viewModel.availability?.windows, !windows.isEmpty {
                ForEach(windows) { window in
                    HStack {
                        Text(window.displayText)
                            .font(.subheadline)
                        Spacer()
                        Text("\(window.bookedCount)/\(window.capacity) 예약")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .opacity(viewModel.deletingWindowIds.contains(window.id) ? 0.4 : 1)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await viewModel.deleteWindow(window) }
                        } label: {
                            Label("삭제", systemImage: "trash")
                        }
                    }
                }
            } else if viewModel.isLoadingAvailability {
                ProgressView()
                    .tint(Theme.accent)
                    .frame(maxWidth: .infinity)
            } else {
                Text("등록된 시간 창이 없어요")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
            }

            Button {
                newWindowDate = defaultNewWindowDate()
                showingAddWindowSheet = true
            } label: {
                Label("시간 추가", systemImage: "plus")
                    .foregroundStyle(Theme.accent)
            }
        } header: {
            Text("시간 창")
        } footer: {
            Text("게스트가 예약할 수 있는 시각을 직접 등록해요")
        }
        .listRowBackground(Theme.surface)
    }

    private var addWindowSheet: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                VStack {
                    DatePicker(
                        "시작 시각",
                        selection: $newWindowDate,
                        in: Date()...,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .datePickerStyle(.graphical)
                    .tint(Theme.accent)
                    .padding(.horizontal, 16)
                    Spacer()
                }
            }
            .navigationTitle("시간 창 추가")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("취소") {
                        showingAddWindowSheet = false
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.isAddingWindow {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Button("추가") {
                            Task {
                                if await viewModel.addWindow(startAt: newWindowDate) {
                                    showingAddWindowSheet = false
                                }
                            }
                        }
                        .fontWeight(.semibold)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func defaultNewWindowDate() -> Date {
        // 다음 정시로 스냅
        let calendar = Foundation.Calendar.current
        let nextHour = Date().addingTimeInterval(3600)
        var components = calendar.dateComponents([.year, .month, .day, .hour], from: nextHour)
        components.minute = 0
        return calendar.date(from: components) ?? nextHour
    }

    // MARK: 판매 기간

    private var validitySection: some View {
        Section {
            Toggle("판매 시작일 설정", isOn: $viewModel.validFromEnabled)
                .tint(Theme.accent)
            if viewModel.validFromEnabled {
                DatePicker("시작", selection: $viewModel.validFromDate, displayedComponents: [.date, .hourAndMinute])
            }
            Toggle("판매 종료일 설정", isOn: $viewModel.validUntilEnabled)
                .tint(Theme.accent)
            if viewModel.validUntilEnabled {
                DatePicker("종료", selection: $viewModel.validUntilDate, displayedComponents: [.date, .hourAndMinute])
            }
        } header: {
            Text("판매 기간")
        } footer: {
            Text("설정하지 않으면 기간 제한 없이 열려요")
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: 예약 가능 시간 미리보기

    private var previewSection: some View {
        Section {
            if viewModel.isLoadingAvailability {
                ProgressView()
                    .tint(Theme.accent)
                    .frame(maxWidth: .infinity)
            } else if let message = viewModel.availabilityError {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
            } else if let options = viewModel.availability?.options, !options.isEmpty {
                ForEach(Array(options.prefix(10))) { option in
                    HStack {
                        Text(option.displayText)
                            .font(.subheadline)
                        Spacer()
                        Text("\(option.remaining)자리")
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            } else {
                Text("지금 조건으로는 예약 가능한 시간이 없어요")
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
            }
        } header: {
            HStack {
                Text("예약 가능 시간 미리보기")
                Spacer()
                Button {
                    Task { await viewModel.loadAvailability() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                }
                .disabled(viewModel.isLoadingAvailability)
                .accessibilityLabel("예약 가능 시간 새로고침")
            }
        } footer: {
            Text("저장하면 바뀐 조건으로 다시 계산돼요")
        }
        .listRowBackground(Theme.surface)
    }

    // MARK: - 헬퍼

    /// 현재 값이 프리셋 목록에 없으면 (서버가 임의 값을 내려준 경우) 목록에 끼워 넣는다.
    private func optionList(_ presets: [Int], current: Int) -> [Int] {
        presets.contains(current) ? presets : (presets + [current]).sorted()
    }
}

#Preview {
    NavigationStack {
        SlotDetailView(
            route: SlotRoute(id: "preview", title: "커피챗"),
            listViewModel: SlotsViewModel()
        )
    }
    .preferredColorScheme(.dark)
    .tint(Theme.accent)
}
