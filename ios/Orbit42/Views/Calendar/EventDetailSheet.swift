import SwiftUI

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
