import PhotosUI
import SwiftUI
import UIKit

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

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: SlotDetailViewModel
    @State private var showingAddWindowSheet = false
    @State private var newWindowDate = Date()
    /// 미리보기 미니 캘린더에서 선택한 날 (자정 기준)
    @State private var previewDay: Date?
    /// 공유(OG) 이미지 — nil 이면 서버 값(detail.imageUrls) 사용
    @State private var shareImages: [String]?
    @State private var sharePhotoItems: [PhotosPickerItem] = []
    @State private var isUploadingShareImages = false
    @State private var shareImageError: String?
    /// 이 슬롯에 연결된 서비스(메뉴) id — nil 이면 서버 값 사용
    @State private var linkedMenuIds: Set<String>?
    @State private var allMenus: [ServiceMenu]?

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
            // 저장 성공 시 목록으로 복귀 — "저장했어요" alert 대신 pop이 피드백.
            viewModel.actionMessage = nil
            dismiss()
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
            servicesSection
            shareImagesSection
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

    // MARK: 서비스 (메뉴 연결)

    private var currentMenuIds: Set<String> {
        linkedMenuIds ?? Set(viewModel.detail?.menuIds ?? [])
    }

    private var servicesSection: some View {
        Section {
            if let allMenus {
                if allMenus.isEmpty {
                    NavigationLink {
                        ServicesView()
                    } label: {
                        Label("서비스 만들러 가기", systemImage: "plus.circle")
                            .foregroundStyle(Theme.accent)
                    }
                } else {
                    ForEach(allMenus) { menu in
                        Button {
                            toggleMenu(menu)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: currentMenuIds.contains(menu.id)
                                      ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(currentMenuIds.contains(menu.id)
                                                     ? Theme.accent : Theme.secondaryText)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(menu.name)
                                        .font(.subheadline)
                                        .foregroundStyle(Theme.primaryText)
                                    if let category = menu.category, !category.isEmpty {
                                        Text(category)
                                            .font(.caption2)
                                            .foregroundStyle(Theme.secondaryText)
                                    }
                                }
                                Spacer(minLength: 8)
                                Text(menu.priceText)
                                    .font(.subheadline.weight(.medium))
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                    }
                    NavigationLink {
                        ServicesView()
                    } label: {
                        Text("서비스 관리")
                            .font(.footnote)
                            .foregroundStyle(Theme.accent)
                    }
                }
            } else {
                HStack {
                    Spacer()
                    ProgressView().tint(Theme.secondaryText)
                    Spacer()
                }
            }
        } header: {
            Text("서비스")
        } footer: {
            Text("연결한 서비스는 예약 화면에서 함께 고를 수 있어요. 결제는 만나서 진행해요.")
        }
        .listRowBackground(Theme.surface)
        .task {
            if allMenus == nil,
               let response: MenusResponse = try? await APIClient.shared.get("/api/v1/menus") {
                allMenus = response.menus.filter(\.active)
            }
        }
    }

    private func toggleMenu(_ menu: ServiceMenu) {
        var next = currentMenuIds
        if next.contains(menu.id) { next.remove(menu.id) } else { next.insert(menu.id) }
        linkedMenuIds = next
        Task {
            struct MenuPatch: Encodable { let menuIds: [String] }
            let _: SlotDetailResponse? = try? await APIClient.shared.patch(
                "/api/v1/slots/\(route.id)",
                body: MenuPatch(menuIds: Array(next))
            )
        }
    }

    // MARK: 공유 이미지 (OG)

    private var currentShareImages: [String] {
        shareImages ?? viewModel.detail?.imageUrls ?? []
    }

    private var shareImagesSection: some View {
        Section {
            if !currentShareImages.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(currentShareImages, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFill()
                                } else {
                                    ZStack {
                                        Theme.fill(0.05)
                                        ProgressView().tint(Theme.secondaryText)
                                    }
                                }
                            }
                            .frame(width: 96, height: 60)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .contextMenu {
                                Button(role: .destructive) {
                                    deleteShareImage(url)
                                } label: {
                                    Label("삭제", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
                .listRowSeparator(.hidden)
            }

            PhotosPicker(
                selection: $sharePhotoItems,
                maxSelectionCount: 6,
                matching: .images
            ) {
                HStack {
                    Label(currentShareImages.isEmpty ? "이미지 추가" : "이미지 더 추가",
                          systemImage: "photo.badge.plus")
                        .foregroundStyle(Theme.accent)
                    Spacer()
                    if isUploadingShareImages {
                        ProgressView().tint(Theme.secondaryText)
                    }
                }
            }
            .disabled(isUploadingShareImages)
            .onChange(of: sharePhotoItems) { _, newItems in
                if !newItems.isEmpty { uploadShareImages(newItems) }
            }

            if let shareImageError {
                Text(shareImageError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("공유 이미지")
        } footer: {
            Text("링크를 공유할 때(카톡·문자 미리보기) 첫 번째 이미지가 헤더로 나와요. 예약 페이지에도 표시돼요.")
        }
        .listRowBackground(Theme.surface)
    }

    private func uploadShareImages(_ items: [PhotosPickerItem]) {
        shareImageError = nil
        isUploadingShareImages = true
        Task {
            defer {
                isUploadingShareImages = false
                sharePhotoItems = []
            }
            for item in items {
                guard let raw = try? await item.loadTransferable(type: Data.self),
                      let jpeg = Self.shareResizedJPEG(from: raw)
                else { continue }
                do {
                    let response: SlotImagesResponse = try await APIClient.shared.upload(
                        "/api/v1/slots/\(route.id)/images",
                        fileData: jpeg,
                        fieldName: "files",
                        fileName: "slot.jpg",
                        mimeType: "image/jpeg"
                    )
                    shareImages = response.imageUrls
                } catch let apiError as APIError {
                    shareImageError = apiError.errorDescription
                    return
                } catch {
                    shareImageError = "이미지를 올리지 못했어요. 잠시 후 다시 시도해 주세요."
                    return
                }
            }
        }
    }

    private func deleteShareImage(_ url: String) {
        shareImageError = nil
        Task {
            var allowed = CharacterSet.urlQueryAllowed
            allowed.remove(charactersIn: "&=+?#/:")
            let encoded = url.addingPercentEncoding(withAllowedCharacters: allowed) ?? url
            do {
                let response: SlotImagesResponse = try await APIClient.shared.delete(
                    "/api/v1/slots/\(route.id)/images?url=\(encoded)"
                )
                shareImages = response.imageUrls
            } catch {
                shareImageError = "이미지를 삭제하지 못했어요."
            }
        }
    }

    /// 긴 변 1600px, JPEG 85% — OG 헤더(1200×630)에 충분한 크기.
    private static func shareResizedJPEG(from data: Data, maxDimension: CGFloat = 1600) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longest = max(image.size.width, image.size.height)
        guard longest > maxDimension else { return image.jpegData(compressionQuality: 0.85) }
        let scale = maxDimension / longest
        let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
        return resized.jpegData(compressionQuality: 0.85)
    }

    // MARK: 예약 가능 시간 미리보기

    /// 옵션을 날짜(자정)별로 묶는다 — 미니 캘린더·시간 칩의 데이터 소스.
    private var previewOptionsByDay: [Date: [AvailabilityOption]] {
        guard let options = viewModel.availability?.options else { return [:] }
        let calendar = PreviewMiniCalendar.calendar
        var grouped: [Date: [AvailabilityOption]] = [:]
        for option in options {
            guard let date = APIDateParser.parse(option.startAt) else { continue }
            grouped[calendar.startOfDay(for: date), default: []].append(option)
        }
        return grouped
    }

    /// "7월 30일 (목)"
    private static let previewDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E)"
        return formatter
    }()

    /// "15:00"
    private static let previewTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

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
            } else if !previewOptionsByDay.isEmpty {
                let optionsByDay = previewOptionsByDay
                let availableDays = Set(optionsByDay.keys)
                // 선택이 없거나 옵션이 사라진 날이면 첫 가능일로 보정.
                let effectiveDay = previewDay.flatMap { availableDays.contains($0) ? $0 : nil }
                    ?? availableDays.min()

                PreviewMiniCalendar(
                    availableDays: availableDays,
                    selectedDay: Binding(
                        get: { effectiveDay },
                        set: { previewDay = $0 }
                    )
                )
                .listRowSeparator(.hidden)

                if let day = effectiveDay, let dayOptions = optionsByDay[day] {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(Self.previewDayFormatter.string(from: day))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 76), spacing: 8)],
                            alignment: .leading,
                            spacing: 8
                        ) {
                            ForEach(dayOptions) { option in
                                previewTimeChip(option)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.subheadline)
                            .foregroundStyle(.orange)
                        Text("지금 조건으로는 예약 가능한 시간이 없어요")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                    }
                    // 서버 진단 — 어느 설정이 막고 있는지 바로 알려준다.
                    if let reason = viewModel.availability?.emptyReason {
                        Text(reason)
                            .font(.footnote)
                            .foregroundStyle(Theme.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.vertical, 2)
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

    private func previewTimeChip(_ option: AvailabilityOption) -> some View {
        VStack(spacing: 2) {
            Text(
                APIDateParser.parse(option.startAt)
                    .map(Self.previewTimeFormatter.string(from:)) ?? option.startAt
            )
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Theme.primaryText)
            if option.remaining > 1 {
                Text("\(option.remaining)자리")
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Theme.fill(0.04), in: RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(Theme.accent.opacity(0.4), lineWidth: 1)
        )
    }

    // MARK: - 헬퍼

    /// 현재 값이 프리셋 목록에 없으면 (서버가 임의 값을 내려준 경우) 목록에 끼워 넣는다.
    private func optionList(_ presets: [Int], current: Int) -> [Int] {
        presets.contains(current) ? presets : (presets + [current]).sorted()
    }
}

// MARK: - 미리보기 미니 캘린더

/// 내 슬롯의 예약 가능일을 한 달 그리드로 보여준다 — 예약 화면(SlotBookingView)과
/// 같은 사용 방식: 가능일만 탭할 수 있고, 선택한 날의 시간이 아래 칩으로 나온다.
private struct PreviewMiniCalendar: View {
    let availableDays: Set<Date>
    @Binding var selectedDay: Date?

    @State private var month: Date

    /// ko_KR — 주 시작 요일은 설정을 따른다 (예약 화면과 동일)
    static var calendar: Calendar { AppSettings.shared.calendar }

    init(availableDays: Set<Date>, selectedDay: Binding<Date?>) {
        self.availableDays = availableDays
        self._selectedDay = selectedDay
        let calendar = Self.calendar
        let base = selectedDay.wrappedValue ?? availableDays.min() ?? Date()
        _month = State(
            initialValue: calendar.date(
                from: calendar.dateComponents([.year, .month], from: base)
            ) ?? base
        )
    }

    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월"
        return formatter
    }()


    var body: some View {
        VStack(spacing: 8) {
            monthHeader
            weekdayHeader
            monthGrid
        }
        .padding(.vertical, 4)
    }

    private var monthHeader: some View {
        HStack {
            Button {
                shiftMonth(-1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.borderless)
            Spacer()
            Text(Self.monthFormatter.string(from: month))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
            Spacer()
            Button {
                shiftMonth(1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.borderless)
        }
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(AppSettings.shared.weekStart.symbols, id: \.self) { symbol in
                Text(symbol)
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var monthGrid: some View {
        let calendar = Self.calendar
        let leading = calendar.leadingBlankDays(forMonthContaining: month)
        let dayCount = calendar.range(of: .day, in: .month, for: month)?.count ?? 30

        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7),
            spacing: 6
        ) {
            ForEach(0..<leading, id: \.self) { _ in
                Color.clear.frame(height: 34)
            }
            ForEach(1...dayCount, id: \.self) { day in
                let date = calendar.date(byAdding: .day, value: day - 1, to: month)!
                dayCell(day: day, date: date)
            }
        }
    }

    @ViewBuilder
    private func dayCell(day: Int, date: Date) -> some View {
        let isAvailable = availableDays.contains(date)
        let isSelected = selectedDay == date

        Button {
            selectedDay = date
        } label: {
            VStack(spacing: 3) {
                Text("\(day)")
                    .font(.subheadline.weight(isAvailable ? .semibold : .regular))
                    .foregroundStyle(
                        isSelected ? Color.white : (isAvailable ? Theme.primaryText : Theme.secondaryText.opacity(0.5))
                    )
                Circle()
                    .fill(isAvailable ? Theme.accent : .clear)
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 34)
            .background(
                isSelected ? Theme.accent.opacity(0.35) : .clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.borderless)
        .disabled(!isAvailable)
    }

    private func shiftMonth(_ delta: Int) {
        if let next = Self.calendar.date(byAdding: .month, value: delta, to: month) {
            month = next
        }
    }
}

#Preview {
    NavigationStack {
        SlotDetailView(
            route: SlotRoute(id: "preview", title: "커피챗"),
            listViewModel: SlotsViewModel()
        )
    }
    .tint(Theme.accent)
}
