import PhotosUI
import SwiftUI
import UIKit

/// 자산 분류 선택지 — 서버 버킷 키와 라벨/색 (자산 탭 팔레트와 동일, 하드코딩).
private enum AssetBucketChoice: String, CaseIterable, Identifiable {
    case earn, invest, spend, life

    var id: String { rawValue }

    var label: String {
        switch self {
        case .earn: return "수입"
        case .invest: return "투자"
        case .spend: return "소비"
        case .life: return "생활"
        }
    }

    var color: Color {
        switch self {
        case .earn: return Color(hexString: "#6366f1") ?? Theme.accent
        case .invest: return Color(hexString: "#22c55e") ?? Theme.accent
        case .spend: return Color(hexString: "#f59e0b") ?? Theme.accent
        case .life: return Color(hexString: "#64748b") ?? Theme.accent
        }
    }
}

/// 이벤트 상세 시트 — 수정/삭제 진입점 + 이벤트 단위 자산 분류.
/// 수정: EditEventSheet(PATCH), 삭제: confirmationDialog → DELETE,
/// 자산 분류: PUT /api/v1/time-asset/event-bucket (선택 즉시 저장).
struct EventDetailSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: CalendarViewModel
    let event: CalendarEvent

    @State private var showingEdit = false
    @State private var showingDeleteConfirm = false
    @State private var isDeleting = false
    @State private var errorMessage: String?

    /// 현재 표시 중인 자산 분류 (nil = 기본, 캘린더 용도 따름)
    @State private var selectedBucket: String?
    @State private var isSavingBucket = false
    @State private var bucketErrorMessage: String?

    /// 일정별 실제 수익 기록 (nil = 자동 계산)
    @State private var earningKrw: Int?
    @State private var isSavingEarning = false
    @State private var showingEarningInput = false
    @State private var earningInputText = ""
    @State private var earningErrorMessage: String?

    /// 시간 로그 (사진 + 공개 범위)
    @State private var post: EventPost?
    @State private var didLoadPost = false
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var isUploadingPhotos = false
    @State private var isSavingPostVisibility = false
    @State private var postErrorMessage: String?

    /// 참석자 (태그/초대)
    @State private var participants: [EventParticipant]?
    @State private var showingAddParticipant = false
    @State private var participantErrorMessage: String?
    /// 초대받은 일정의 응답 진행 상태
    @State private var isResponding = false

    /// 완료 체크(투두) — 시트가 든 event 는 스냅샷이므로 표시는 이 상태로 한다.
    @State private var isCompleted: Bool
    @State private var isSavingCompletion = false
    @State private var completionErrorMessage: String?

    /// 완료 체크 초록 — 웹과 동일한 #22c55e
    private static let completedGreen = Color(hexString: "#22c55e") ?? .green

    init(viewModel: CalendarViewModel, event: CalendarEvent) {
        self.viewModel = viewModel
        self.event = event
        _selectedBucket = State(initialValue: event.bucketOverride)
        _earningKrw = State(initialValue: event.earningKrw)
        _isCompleted = State(initialValue: event.completed)
    }

    private var calendar: Calendar { CalendarViewModel.calendar }

    private var calendarInfo: CalendarInfo? {
        guard let calendarId = event.calendarId else { return nil }
        return viewModel.calendars.first { $0.id == calendarId }
    }

    var body: some View {
        NavigationStack {
            List {
                if event.isInvite {
                    inviteSections
                } else {
                Section {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(event.title)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.white)
                                .strikethrough(isCompleted)
                            if isCompleted {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.subheadline)
                                    .foregroundStyle(Self.completedGreen)
                                    .accessibilityLabel("완료됨")
                            }
                            if event.isGoogle {
                                Text("Google")
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(Theme.secondaryText)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.white.opacity(0.08), in: Capsule())
                            }
                        }

                        Label {
                            Text(dateTimeText)
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                        } icon: {
                            Image(systemName: "clock")
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                        }

                        if let calendarInfo {
                            Label {
                                Text(calendarInfo.name)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.secondaryText)
                            } icon: {
                                Circle()
                                    .fill(calendarInfo.displayColor)
                                    .frame(width: 10, height: 10)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Theme.surface)

                if let description = event.description, !description.isEmpty {
                    Section("메모") {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.85))
                    }
                    .listRowBackground(Theme.surface)
                }

                Section {
                    Menu {
                        Picker("자산 분류", selection: bucketSelection) {
                            Text("기본 (캘린더 용도)")
                                .tag(nil as String?)
                            ForEach(AssetBucketChoice.allCases) { choice in
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(choice.color)
                                        .frame(width: 8, height: 8)
                                    Text(choice.label)
                                }
                                .tag(choice.rawValue as String?)
                            }
                        }
                    } label: {
                        HStack {
                            Text("자산 분류")
                                .foregroundStyle(.white)
                            Spacer()
                            if isSavingBucket {
                                ProgressView()
                                    .tint(Theme.secondaryText)
                            } else {
                                HStack(spacing: 6) {
                                    if let choice = currentBucketChoice {
                                        Circle()
                                            .fill(choice.color)
                                            .frame(width: 8, height: 8)
                                        Text(choice.label)
                                    } else {
                                        Text("기본 (캘린더 용도)")
                                    }
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.caption2)
                                }
                                .font(.subheadline)
                                .foregroundStyle(Theme.secondaryText)
                            }
                        }
                    }
                    .disabled(isSavingBucket || isDeleting)
                    .alert("분류를 저장하지 못했어요", isPresented: showBucketErrorAlert) {
                        Button("확인", role: .cancel) { bucketErrorMessage = nil }
                    } message: {
                        Text(bucketErrorMessage ?? "")
                    }
                } footer: {
                    Text("자산 탭 분석에서 이 일정만 다른 분류로 계산돼요.")
                }
                .listRowBackground(Theme.surface)

                earningSection

                timelogSection

                participantsSection

                Section {
                    Button {
                        toggleCompletion()
                    } label: {
                        HStack {
                            Label {
                                Text(isCompleted ? "완료 해제" : "완료로 표시")
                            } icon: {
                                Image(systemName: isCompleted ? "checkmark.circle.fill" : "checkmark.circle")
                                    .foregroundStyle(isCompleted ? Self.completedGreen : Theme.accent)
                            }
                            Spacer()
                            if isSavingCompletion {
                                ProgressView()
                                    .tint(Theme.secondaryText)
                            }
                        }
                    }
                    .disabled(isSavingCompletion || isDeleting)
                    .alert("완료 상태를 저장하지 못했어요", isPresented: showCompletionErrorAlert) {
                        Button("확인", role: .cancel) { completionErrorMessage = nil }
                    } message: {
                        Text(completionErrorMessage ?? "")
                    }

                    Button {
                        showingEdit = true
                    } label: {
                        Label("수정", systemImage: "pencil")
                    }
                    .disabled(isDeleting)

                    Button(role: .destructive) {
                        showingDeleteConfirm = true
                    } label: {
                        if isDeleting {
                            HStack {
                                Label("삭제", systemImage: "trash")
                                Spacer()
                                ProgressView()
                                    .tint(Theme.secondaryText)
                            }
                        } else {
                            Label("삭제", systemImage: "trash")
                        }
                    }
                    .disabled(isDeleting)
                }
                .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("일정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("닫기") { dismiss() }
                        .disabled(isDeleting)
                }
            }
            .confirmationDialog(
                "이 일정을 삭제할까요?",
                isPresented: $showingDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("삭제", role: .destructive) { deleteEvent() }
                Button("취소", role: .cancel) {}
            }
            .alert("삭제하지 못했어요", isPresented: showErrorAlert) {
                Button("확인", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(isPresented: $showingEdit) {
                EditEventSheet(viewModel: viewModel, event: event) {
                    // 수정 성공 → 상세 시트까지 닫는다 (표시 중인 이벤트가 낡은 상태이므로)
                    dismiss()
                }
                .preferredColorScheme(.dark)
            }
            .interactiveDismissDisabled(isDeleting)
        }
    }

    private var showErrorAlert: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private var showBucketErrorAlert: Binding<Bool> {
        Binding(
            get: { bucketErrorMessage != nil },
            set: { if !$0 { bucketErrorMessage = nil } }
        )
    }

    private var showCompletionErrorAlert: Binding<Bool> {
        Binding(
            get: { completionErrorMessage != nil },
            set: { if !$0 { completionErrorMessage = nil } }
        )
    }

    // MARK: - 완료 체크

    /// 시트 표시를 낙관적으로 뒤집고 저장한다. 뷰모델이 월 캐시를 함께 갱신하므로
    /// 목록 행도 즉시 반영되고, 실패하면 둘 다 원복된다.
    private func toggleCompletion() {
        guard !isSavingCompletion else { return }
        let newValue = !isCompleted
        isCompleted = newValue
        isSavingCompletion = true
        Task {
            defer { isSavingCompletion = false }
            do {
                try await viewModel.setCompletion(event, completed: newValue)
            } catch let apiError as APIError {
                isCompleted = !newValue
                completionErrorMessage = apiError.errorDescription
            } catch {
                isCompleted = !newValue
                completionErrorMessage = "완료 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 자산 분류

    private var currentBucketChoice: AssetBucketChoice? {
        selectedBucket.flatMap(AssetBucketChoice.init(rawValue:))
    }

    private var bucketSelection: Binding<String?> {
        Binding(
            get: { selectedBucket },
            set: { setBucket($0) }
        )
    }

    /// 선택 즉시 저장. 성공하면 표시를 유지하고(월 캐시는 뷰모델이 무효화·새로고침),
    /// 실패하면 이전 값으로 원복 후 alert 를 띄운다.
    private func setBucket(_ newValue: String?) {
        guard newValue != selectedBucket, !isSavingBucket else { return }
        let previous = selectedBucket
        selectedBucket = newValue
        isSavingBucket = true
        Task {
            defer { isSavingBucket = false }
            do {
                try await viewModel.setEventBucket(event, bucket: newValue)
            } catch let apiError as APIError {
                selectedBucket = previous
                bucketErrorMessage = apiError.errorDescription
            } catch {
                selectedBucket = previous
                bucketErrorMessage = "분류를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 수익 기록

    private var earningSection: some View {
        Section {
            Button {
                earningInputText = earningKrw.map(String.init) ?? ""
                showingEarningInput = true
            } label: {
                HStack {
                    Text("수익 기록")
                        .foregroundStyle(.white)
                    Spacer()
                    if isSavingEarning {
                        ProgressView()
                            .tint(Theme.secondaryText)
                    } else {
                        Text(earningValueText)
                            .font(.subheadline)
                            .foregroundStyle(earningKrw != nil ? Theme.accent : Theme.secondaryText)
                    }
                }
            }
            .disabled(isSavingEarning || isDeleting)
            .alert("이 일정으로 번 금액", isPresented: $showingEarningInput) {
                TextField("금액 (원)", text: $earningInputText)
                    .keyboardType(.numberPad)
                Button("저장") { saveEarning() }
                if earningKrw != nil {
                    Button("기록 해제", role: .destructive) { setEarning(nil) }
                }
                Button("취소", role: .cancel) {}
            } message: {
                Text("실제 번 금액을 기록하면 자산 탭 수입 계산에 시급 대신 이 금액이 쓰여요.")
            }
            .alert("수익을 저장하지 못했어요", isPresented: showEarningErrorAlert) {
                Button("확인", role: .cancel) { earningErrorMessage = nil }
            } message: {
                Text(earningErrorMessage ?? "")
            }
        } footer: {
            Text("수입으로 분류된 일정은 시급×시간으로 자동 계산돼요. 실제 금액이 다르면 직접 기록하세요.")
        }
        .listRowBackground(Theme.surface)
    }

    private var showEarningErrorAlert: Binding<Bool> {
        Binding(
            get: { earningErrorMessage != nil },
            set: { if !$0 { earningErrorMessage = nil } }
        )
    }

    private static let wonFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter
    }()

    /// 행 우측 표시 — 수동 기록 > 자동 환산 > 안내.
    private var earningValueText: String {
        if let earningKrw {
            return "₩\(Self.wonFormatter.string(from: NSNumber(value: earningKrw)) ?? "\(earningKrw)")"
        }
        if let auto = event.autoValueKrw {
            return "자동 ₩\(Self.wonFormatter.string(from: NSNumber(value: auto)) ?? "\(auto)")"
        }
        return "자동 (시급 기준)"
    }

    private func saveEarning() {
        let cleaned = earningInputText.replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespaces)
        guard let amount = Int(cleaned), amount >= 0 else {
            earningErrorMessage = "숫자만 입력해 주세요."
            return
        }
        setEarning(amount)
    }

    private func setEarning(_ amount: Int?) {
        guard !isSavingEarning else { return }
        let previous = earningKrw
        earningKrw = amount
        isSavingEarning = true
        Task {
            defer { isSavingEarning = false }
            do {
                try await viewModel.setEventEarning(event, amountKrw: amount)
            } catch let apiError as APIError {
                earningKrw = previous
                earningErrorMessage = apiError.errorDescription
            } catch {
                earningKrw = previous
                earningErrorMessage = "수익을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 시간 로그 (사진 + 공개 범위)

    private var timelogSection: some View {
        Section {
            if let post, !post.imageUrls.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(post.imageUrls, id: \.self) { url in
                            AsyncImage(url: URL(string: url)) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFill()
                                } else {
                                    ZStack {
                                        Color.white.opacity(0.05)
                                        ProgressView().tint(Theme.secondaryText)
                                    }
                                }
                            }
                            .frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .contextMenu {
                                Button(role: .destructive) {
                                    deletePhoto(url)
                                } label: {
                                    Label("사진 삭제", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
                .listRowSeparator(.hidden)
            }

            PhotosPicker(
                selection: $photoItems,
                maxSelectionCount: 10,
                matching: .images
            ) {
                HStack {
                    Label(post?.imageUrls.isEmpty == false ? "사진 추가" : "사진 붙이기",
                          systemImage: "photo.badge.plus")
                        .foregroundStyle(Theme.accent)
                    Spacer()
                    if isUploadingPhotos {
                        ProgressView().tint(Theme.secondaryText)
                    }
                }
            }
            .disabled(isUploadingPhotos)
            .onChange(of: photoItems) { _, newItems in
                if !newItems.isEmpty { uploadPhotos(newItems) }
            }

            if post != nil {
                Menu {
                    Picker("공개 범위", selection: visibilitySelection) {
                        ForEach(TimelogVisibility.allCases) { choice in
                            Label(choice.label, systemImage: choice.systemImage)
                                .tag(choice.rawValue)
                        }
                    }
                } label: {
                    HStack {
                        Text("공개 범위")
                            .foregroundStyle(.white)
                        Spacer()
                        if isSavingPostVisibility {
                            ProgressView().tint(Theme.secondaryText)
                        } else {
                            HStack(spacing: 6) {
                                let choice = TimelogVisibility(rawValue: post?.visibility ?? "") ?? .followers
                                Image(systemName: choice.systemImage)
                                    .font(.caption)
                                Text(choice.label)
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.caption2)
                            }
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                        }
                    }
                }
                .disabled(isSavingPostVisibility)
            }

            if let postErrorMessage {
                Text(postErrorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("시간 로그")
        } footer: {
            Text("사진을 붙이면 이 일정이 시간 기록이 돼요. 팔로워·전체 공개면 프로필의 시간 로그에 보여요.")
        }
        .listRowBackground(Theme.surface)
        .task {
            guard !didLoadPost else { return }
            didLoadPost = true
            if let response: EventPostResponse = try? await APIClient.shared.get(
                "/api/v1/calendar/events/\(event.id)/post"
            ) {
                post = response.post
            }
        }
    }

    /// 일정 스냅샷 — 포스트 생성/갱신 시 서버에 함께 보낸다.
    private var postSnapshotFields: [String: String] {
        [
            "title": event.title,
            "startAt": event.allDay
                ? APIDateParser.encodeDateOnly(event.startAt)
                : APIDateParser.encodeDateTime(event.startAt),
            "endAt": event.allDay
                ? APIDateParser.encodeDateOnly(event.endAt)
                : APIDateParser.encodeDateTime(event.endAt),
            "allDay": event.allDay ? "true" : "false",
        ]
    }

    private var visibilitySelection: Binding<String> {
        Binding(
            get: { post?.visibility ?? TimelogVisibility.followers.rawValue },
            set: { setPostVisibility($0) }
        )
    }

    private func uploadPhotos(_ items: [PhotosPickerItem]) {
        postErrorMessage = nil
        isUploadingPhotos = true
        Task {
            defer {
                isUploadingPhotos = false
                photoItems = []
            }
            for item in items {
                guard let raw = try? await item.loadTransferable(type: Data.self),
                      let jpeg = Self.resizedJPEG(from: raw)
                else { continue }
                do {
                    let response: EventPostResponse = try await APIClient.shared.upload(
                        "/api/v1/calendar/events/\(event.id)/post",
                        fileData: jpeg,
                        fieldName: "files",
                        fileName: "photo.jpg",
                        mimeType: "image/jpeg",
                        fields: postSnapshotFields
                    )
                    post = response.post
                } catch let apiError as APIError {
                    postErrorMessage = apiError.errorDescription
                    return
                } catch {
                    postErrorMessage = "사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요."
                    return
                }
            }
        }
    }

    private func setPostVisibility(_ newValue: String) {
        guard newValue != post?.visibility, !isSavingPostVisibility else { return }
        postErrorMessage = nil
        isSavingPostVisibility = true
        Task {
            defer { isSavingPostVisibility = false }
            do {
                let response: EventPostResponse = try await APIClient.shared.put(
                    "/api/v1/calendar/events/\(event.id)/post",
                    body: UpdateEventPostRequest(
                        title: event.title,
                        startAt: postSnapshotFields["startAt"] ?? "",
                        endAt: postSnapshotFields["endAt"],
                        allDay: event.allDay,
                        visibility: newValue
                    )
                )
                post = response.post
            } catch {
                postErrorMessage = "공개 범위를 저장하지 못했어요."
            }
        }
    }

    private func deletePhoto(_ url: String) {
        postErrorMessage = nil
        Task {
            var allowed = CharacterSet.urlQueryAllowed
            allowed.remove(charactersIn: "&=+?#/:")
            let encoded = url.addingPercentEncoding(withAllowedCharacters: allowed) ?? url
            do {
                let response: EventPostResponse = try await APIClient.shared.delete(
                    "/api/v1/calendar/events/\(event.id)/post?imageUrl=\(encoded)"
                )
                post = response.post
            } catch {
                postErrorMessage = "사진을 삭제하지 못했어요."
            }
        }
    }

    /// 긴 변 1600px, JPEG 85% (시간 로그는 프로필 그리드에도 쓰여 조금 크게).
    private static func resizedJPEG(from data: Data, maxDimension: CGFloat = 1600) -> Data? {
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

    // MARK: - 초대받은 일정 (수락/거절)

    @ViewBuilder
    private var inviteSections: some View {
        Section {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(event.title)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.white)
                    Text(event.inviteStatus == "accepted" ? "참여 중" : "초대")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Theme.accent.opacity(0.15), in: Capsule())
                }
                Label {
                    Text(dateTimeText)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                } icon: {
                    Image(systemName: "clock")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                }
                if let inviter = event.inviterName {
                    Label {
                        Text("\(inviter)님의 초대")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    } icon: {
                        Image(systemName: "person")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(Theme.surface)

        Section {
            if event.inviteStatus == "accepted" {
                Label("수락한 일정이에요", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Button(role: .destructive) {
                    respondToInvite("declined")
                } label: {
                    inviteButtonLabel("거절로 변경", systemImage: "xmark.circle")
                }
                .disabled(isResponding)
            } else {
                Button {
                    respondToInvite("accepted")
                } label: {
                    inviteButtonLabel("수락", systemImage: "checkmark.circle")
                }
                .disabled(isResponding)
                Button(role: .destructive) {
                    respondToInvite("declined")
                } label: {
                    inviteButtonLabel("거절", systemImage: "xmark.circle")
                }
                .disabled(isResponding)
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } footer: {
            Text("수락하면 캘린더에 계속 표시되고, 거절하면 목록에서 사라져요.")
        }
        .listRowBackground(Theme.surface)
    }

    private func inviteButtonLabel(_ title: String, systemImage: String) -> some View {
        HStack {
            Label(title, systemImage: systemImage)
            Spacer()
            if isResponding {
                ProgressView().tint(Theme.secondaryText)
            }
        }
    }

    private func respondToInvite(_ status: String) {
        guard let inviteId = event.inviteId, !isResponding else { return }
        errorMessage = nil
        isResponding = true
        Task {
            defer { isResponding = false }
            do {
                struct RespondRequest: Encodable { let status: String }
                let _: AckResponse = try await APIClient.shared.post(
                    "/api/v1/participations/\(inviteId)",
                    body: RespondRequest(status: status)
                )
                await viewModel.reloadMonth(around: event)
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "응답을 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 참석자 (태그/초대)

    private var participantsSection: some View {
        Section {
            if let participants, !participants.isEmpty {
                ForEach(participants) { participant in
                    HStack(spacing: 10) {
                        DiscoverAvatar(
                            url: participant.avatarUrl.flatMap(URL.init(string:)),
                            name: participant.label,
                            size: 30
                        )
                        Text(participant.label)
                            .font(.subheadline)
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Spacer()
                        Text(participant.statusLabel)
                            .font(.caption)
                            .foregroundStyle(
                                participant.status == "accepted"
                                    ? .green
                                    : participant.status == "declined"
                                        ? .orange
                                        : Theme.secondaryText
                            )
                    }
                    .contextMenu {
                        Button(role: .destructive) {
                            removeParticipant(participant)
                        } label: {
                            Label("초대 취소", systemImage: "trash")
                        }
                    }
                }
            }

            Button {
                showingAddParticipant = true
            } label: {
                Label("참석자 추가", systemImage: "person.badge.plus")
                    .foregroundStyle(Theme.accent)
            }

            if let participantErrorMessage {
                Text(participantErrorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("참석자")
        } footer: {
            Text("orbit42 사용자를 태그하거나 이메일로 초대할 수 있어요. 태그하면 상대 캘린더에도 이 일정이 보여요.")
        }
        .listRowBackground(Theme.surface)
        .task {
            if participants == nil,
               let response: ParticipantsResponse = try? await APIClient.shared.get(
                   "/api/v1/calendar/events/\(event.id)/participants"
               ) {
                participants = response.participants
            }
        }
        .sheet(isPresented: $showingAddParticipant) {
            ParticipantAddSheet(
                eventId: event.id,
                snapshot: participantSnapshot
            ) { updated in
                participants = updated
            }
            .preferredColorScheme(.dark)
        }
    }

    /// 참석자 추가/시간 로그 공용 일정 스냅샷.
    var participantSnapshot: (title: String, startAt: String, endAt: String?, allDay: Bool) {
        (
            title: event.title,
            startAt: event.allDay
                ? APIDateParser.encodeDateOnly(event.startAt)
                : APIDateParser.encodeDateTime(event.startAt),
            endAt: event.allDay
                ? APIDateParser.encodeDateOnly(event.endAt)
                : APIDateParser.encodeDateTime(event.endAt),
            allDay: event.allDay
        )
    }

    private func removeParticipant(_ participant: EventParticipant) {
        participantErrorMessage = nil
        Task {
            do {
                let response: ParticipantsResponse = try await APIClient.shared.delete(
                    "/api/v1/calendar/events/\(event.id)/participants?participantId=\(participant.id)"
                )
                participants = response.participants
            } catch {
                participantErrorMessage = "초대를 취소하지 못했어요."
            }
        }
    }

    // MARK: - 삭제

    private func deleteEvent() {
        isDeleting = true
        Task {
            defer { isDeleting = false }
            do {
                try await viewModel.deleteEvent(event)
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "일정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }

    // MARK: - 날짜/시간 표시

    private var dateTimeText: String {
        let start = event.startAt
        let end = event.effectiveEnd(calendar: calendar)
        if event.allDay {
            if calendar.isDate(start, inSameDayAs: end) {
                return "\(Self.dayFormatter.string(from: start)) · 종일"
            }
            return "\(Self.dayFormatter.string(from: start)) – \(Self.dayFormatter.string(from: end)) · 종일"
        }
        if calendar.isDate(start, inSameDayAs: event.endAt) {
            let startTime = Self.timeFormatter.string(from: start)
            let endTime = Self.timeFormatter.string(from: event.endAt)
            return "\(Self.dayFormatter.string(from: start)) · \(startTime) – \(endTime)"
        }
        return "\(Self.dayTimeFormatter.string(from: start)) – \(Self.dayTimeFormatter.string(from: event.endAt))"
    }

    /// "2026년 7월 26일 (일)"
    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월 d일 (E)"
        return formatter
    }()

    /// "오전 9:00"
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "a h:mm"
        return formatter
    }()

    /// "7월 26일 (일) 오전 9:00"
    private static let dayTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 (E) a h:mm"
        return formatter
    }()
}
