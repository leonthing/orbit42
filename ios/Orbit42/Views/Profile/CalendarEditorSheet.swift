import SwiftUI

/// 캘린더 생성/편집 시트.
/// - 생성: `POST /api/v1/calendars` (+ Google 연결 시 "Google 캘린더로도 만들기" 토글)
/// - 편집: `PATCH /api/v1/calendars/{id}` — 바뀐 필드만 전송
struct CalendarEditorSheet: View {
    enum Mode {
        case create
        case edit(CalendarInfo)
    }

    @Environment(\.dismiss) private var dismiss

    let mode: Mode
    let viewModel: CalendarSettingsViewModel

    @State private var name: String
    @State private var purpose: CalendarPurpose
    @State private var colorHex: String
    @State private var visibility: CalendarVisibility
    @State private var linkGoogle = false
    /// 시간당 단가 입력 (콤마 포맷, 편집 모드 전용 — 서버 POST 는 단가를 받지 않음)
    @State private var rateText = ""
    // 목표 캘린더
    @State private var goalTitle: String
    @State private var goalHoursText: String
    @State private var hasDeadline: Bool
    @State private var goalDeadline: Date
    private let initialGoalTitle: String
    private let initialGoalHours: Double?
    private let initialGoalDeadline: String?
    /// onAppear 시점 단가 — 바뀌었을 때만 PATCH 에 담는다
    @State private var initialRate: Int?
    /// 생성 모드에서 미리 고른 "함께 쓸 사람" — 저장 후 초대한다
    @State private var pendingInvites: [SearchUser] = []
    @State private var inviteRole = "editor"
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(mode: Mode, viewModel: CalendarSettingsViewModel) {
        self.mode = mode
        self.viewModel = viewModel
        let existing: CalendarInfo?
        switch mode {
        case .create:
            _name = State(initialValue: "")
            _purpose = State(initialValue: .personal)
            _colorHex = State(initialValue: CalendarPalette.hexes[0])
            _visibility = State(initialValue: .private)
            existing = nil
        case .edit(let calendar):
            _name = State(initialValue: calendar.name)
            _purpose = State(initialValue: CalendarPurpose(rawValue: calendar.purpose ?? "") ?? .other)
            _colorHex = State(initialValue: calendar.color)
            _visibility = State(initialValue: CalendarVisibility(rawValue: calendar.visibility ?? "") ?? .private)
            existing = calendar
        }

        // 목표 프리필
        let title = existing?.goalTitle ?? ""
        let hours = existing?.goalTargetHours
        let deadline = existing?.goalDeadline
        initialGoalTitle = title
        initialGoalHours = hours
        initialGoalDeadline = deadline
        _goalTitle = State(initialValue: title)
        _goalHoursText = State(initialValue: hours.map { $0 == $0.rounded() ? String(Int($0)) : String($0) } ?? "")
        _hasDeadline = State(initialValue: deadline != nil)
        _goalDeadline = State(
            initialValue: deadline.flatMap { Self.dateFormatter.date(from: $0) }
                ?? Calendar.current.date(byAdding: .month, value: 3, to: Date())
                ?? Date()
        )
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private var original: CalendarInfo? {
        if case .edit(let calendar) = mode { return calendar }
        return nil
    }

    private var isCreate: Bool { original == nil }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("이름") {
                    TextField("캘린더 이름", text: $name)
                        .foregroundStyle(Theme.primaryText)
                }
                .listRowBackground(Theme.surface)

                Section {
                    Picker("용도", selection: $purpose) {
                        ForEach(CalendarPurpose.allCases) { purpose in
                            Text(purpose.label).tag(purpose)
                        }
                    }
                }
                .listRowBackground(Theme.surface)

                Section("색상") {
                    colorPalette
                }
                .listRowBackground(Theme.surface)

                Section {
                    Picker("공개범위", selection: $visibility) {
                        ForEach(CalendarVisibility.allCases) { visibility in
                            Text(visibility.label).tag(visibility)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("공개범위")
                } footer: {
                    Text("공개범위에 따라 다른 사람이 내 일정의 바쁨 여부를 볼 수 있어요")
                        .foregroundStyle(Theme.secondaryText)
                }
                .listRowBackground(Theme.surface)

                goalSection

                shareSection

                if !isCreate {
                    Section {
                        HStack {
                            TextField("예: 50,000", text: $rateText)
                                .keyboardType(.numberPad)
                                .foregroundStyle(Theme.primaryText)
                                .onChange(of: rateText) { _, newValue in
                                    rateText = Self.formatRateInput(newValue)
                                }
                            Text("원")
                                .foregroundStyle(Theme.secondaryText)
                        }
                    } header: {
                        Text("시간당 단가(선택)")
                    } footer: {
                        Text("이 캘린더의 '수입' 시간은 기준 시급 대신 이 단가로 계산돼요. 비워두면 기준 시급을 써요.")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)
                }

                if isCreate, viewModel.googleConnected {
                    Section {
                        Toggle("Google 캘린더로도 만들기", isOn: $linkGoogle)
                            .tint(Theme.accent)
                            // Google 캘린더는 orbit42 공유 대상이 아니라 고른 사람을 비운다
                            .onChange(of: linkGoogle) { _, isOn in
                                if isOn { pendingInvites = [] }
                            }
                    } footer: {
                        Text("연결된 Google 계정에 같은 이름의 캘린더를 함께 만들어요")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(isCreate ? "새 캘린더" : "캘린더 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSaving {
                        ProgressView()
                            .tint(Theme.accent)
                    } else {
                        Button("저장") { save() }
                            .fontWeight(.semibold)
                            .disabled(!canSave)
                    }
                }
            }
            .interactiveDismissDisabled(isSaving)
            .onAppear {
                if let original, let rate = viewModel.hourlyRates[original.id] {
                    rateText = AssetFormat.grouped(rate)
                    initialRate = rate
                }
            }
        }
    }

    // MARK: - 생성 직후 초대

    /// 캘린더가 만들어진 뒤에야 멤버를 넣을 수 있으므로 여기서 몰아서 초대한다.
    /// 캘린더 자체는 이미 만들어졌으니 초대가 실패해도 되돌리지 않고 알리기만 한다.
    private func inviteSelected(to calendar: CalendarInfo?) async {
        guard !linkGoogle, !pendingInvites.isEmpty else { return }
        guard let calendar else {
            viewModel.actionMessage = "캘린더는 만들었어요. 함께 쓸 사람은 캘린더 편집에서 추가해 주세요."
            return
        }
        var failed: [String] = []
        for user in pendingInvites {
            do {
                let _: CalendarMembersResponse = try await APIClient.shared.post(
                    "/api/v1/calendars/\(calendar.id)/members",
                    body: AddMemberRequest(username: user.username, role: inviteRole)
                )
            } catch {
                failed.append(user.preferredName)
            }
        }
        if !failed.isEmpty {
            viewModel.actionMessage = "\(failed.joined(separator: ", "))님은 초대하지 못했어요. 캘린더 편집에서 다시 시도해 주세요."
        }
    }

    // MARK: - 시간당 단가

    /// 입력값 (콤마 제거, 빈칸·0 은 nil = 단가 해제)
    private var rateValue: Int? {
        let value = Int(rateText.replacingOccurrences(of: ",", with: "")) ?? 0
        return value > 0 ? value : nil
    }

    /// 숫자만 남기고 천 단위 콤마를 다시 찍는다.
    private static func formatRateInput(_ raw: String) -> String {
        let digits = raw.filter(\.isNumber)
        guard let value = Int(digits.prefix(12)) else { return "" }
        return value > 0 ? AssetFormat.grouped(value) : ""
    }

    // MARK: - 색상 팔레트

    private var colorPalette: some View {
        HStack(spacing: 10) {
            ForEach(CalendarPalette.hexes, id: \.self) { hex in
                Button {
                    colorHex = hex
                } label: {
                    ZStack {
                        Circle()
                            .fill(Color(hexString: hex) ?? Theme.accent)
                            .frame(width: 30, height: 30)
                        if colorHex.lowercased() == hex.lowercased() {
                            Image(systemName: "checkmark")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Theme.primaryText)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("색상 \(hex)")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    // MARK: - 함께 쓰기 (공유)

    @ViewBuilder
    private var shareSection: some View {
        if isCreate {
            // Google 캘린더로 만들면 orbit42 안의 공유 대상이 아니므로 숨긴다.
            if !linkGoogle {
                CalendarInvitePicker(selected: $pendingInvites, role: $inviteRole)
            }
        } else if let original, original.isNative {
            Section {
                NavigationLink {
                    CalendarShareView(calendar: original)
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "person.2")
                            .foregroundStyle(Theme.accent)
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("함께 쓰기")
                                .foregroundStyle(Theme.primaryText)
                            Text(original.isSharedWithMe
                                 ? "공유받은 캘린더예요"
                                 : "친구·가족과 같이 기록하기")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                }
            } footer: {
                Text("초대한 사람도 이 캘린더에 일정을 기록할 수 있어요. 가족 일정, 커플 기록, 팀 프로젝트에 좋아요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
    }

    // MARK: - 목표

    private var goalSection: some View {
        Section {
            TextField("목표 (예: 토익 900점, 앱 출시)", text: $goalTitle)
                .foregroundStyle(Theme.primaryText)

            if !goalTitle.trimmingCharacters(in: .whitespaces).isEmpty {
                HStack {
                    Text("목표 시간")
                        .foregroundStyle(Theme.primaryText)
                    Spacer()
                    TextField("예: 200", text: $goalHoursText)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 100)
                        .foregroundStyle(Theme.primaryText)
                    Text("시간")
                        .foregroundStyle(Theme.secondaryText)
                }

                Toggle("기한 정하기", isOn: $hasDeadline)
                    .tint(Theme.accent)
                if hasDeadline {
                    DatePicker("기한", selection: $goalDeadline, displayedComponents: .date)
                }
            }
        } header: {
            Text("목표")
        } footer: {
            Text(goalTitle.trimmingCharacters(in: .whitespaces).isEmpty
                 ? "목표를 정하면 이 캘린더에 쌓이는 시간이 목표 달성률로 계산돼요. 학습·사이드 프로젝트·운동 캘린더에 좋아요."
                 : "이 캘린더의 일정 시간이 목표를 향해 쌓여요. 달성하면 캘린더를 아카이브할 수 있어요.")
                .foregroundStyle(Theme.secondaryText)
        }
        .listRowBackground(Theme.surface)
    }

    private var goalHoursValue: Double? {
        let digits = goalHoursText.filter { $0.isNumber || $0 == "." }
        guard let value = Double(digits), value > 0 else { return nil }
        return value
    }

    private var goalDeadlineString: String? {
        hasDeadline ? Self.dateFormatter.string(from: goalDeadline) : nil
    }

    // MARK: - 저장

    private func save() {
        errorMessage = nil
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                if let original {
                    var request = UpdateCalendarRequest()
                    if trimmedName != original.name {
                        request.name = trimmedName
                    }
                    if purpose.rawValue != original.purpose {
                        request.purpose = purpose.rawValue
                    }
                    if colorHex.lowercased() != original.color.lowercased() {
                        request.color = colorHex
                    }
                    if visibility.rawValue != (original.visibility ?? "private") {
                        request.visibility = visibility.rawValue
                    }
                    if rateValue != initialRate {
                        // 값 입력 → 설정, 지움 → 명시적 null 로 해제
                        request.hourlyRateKrw = rateValue.map(PatchValue.value) ?? .null
                    }
                    let trimmedGoal = goalTitle.trimmingCharacters(in: .whitespaces)
                    if trimmedGoal != initialGoalTitle {
                        request.goalTitle = trimmedGoal.isEmpty ? .null : .value(trimmedGoal)
                    }
                    if goalHoursValue != initialGoalHours {
                        request.goalTargetHours = goalHoursValue.map(PatchValue.value) ?? .null
                    }
                    if goalDeadlineString != initialGoalDeadline {
                        request.goalDeadline = goalDeadlineString.map(PatchValue.value) ?? .null
                    }
                    if request.isEmpty {
                        dismiss()
                        return
                    }
                    try await viewModel.update(id: original.id, request: request)
                } else {
                    let created = try await viewModel.create(
                        CreateCalendarRequest(
                            name: trimmedName,
                            purpose: purpose.rawValue,
                            color: colorHex,
                            visibility: visibility.rawValue,
                            linkGoogle: linkGoogle,
                            goalTitle: goalTitle.trimmingCharacters(in: .whitespaces).isEmpty
                                ? nil : goalTitle.trimmingCharacters(in: .whitespaces),
                            goalTargetHours: goalHoursValue,
                            goalDeadline: goalDeadlineString
                        )
                    )
                    await inviteSelected(to: created)
                }
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "캘린더를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    CalendarEditorSheet(mode: .create, viewModel: CalendarSettingsViewModel())
        .tint(Theme.accent)
}
