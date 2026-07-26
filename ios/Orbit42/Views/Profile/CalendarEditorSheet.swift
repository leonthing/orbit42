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
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(mode: Mode, viewModel: CalendarSettingsViewModel) {
        self.mode = mode
        self.viewModel = viewModel
        switch mode {
        case .create:
            _name = State(initialValue: "")
            _purpose = State(initialValue: .personal)
            _colorHex = State(initialValue: CalendarPalette.hexes[0])
            _visibility = State(initialValue: .private)
        case .edit(let calendar):
            _name = State(initialValue: calendar.name)
            _purpose = State(initialValue: CalendarPurpose(rawValue: calendar.purpose ?? "") ?? .other)
            _colorHex = State(initialValue: calendar.color)
            _visibility = State(initialValue: CalendarVisibility(rawValue: calendar.visibility ?? "") ?? .private)
        }
    }

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
                        .foregroundStyle(.white)
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

                if isCreate, viewModel.googleConnected {
                    Section {
                        Toggle("Google 캘린더로도 만들기", isOn: $linkGoogle)
                            .tint(Theme.accent)
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
        }
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
                                .foregroundStyle(.white)
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
                    if request.isEmpty {
                        dismiss()
                        return
                    }
                    try await viewModel.update(id: original.id, request: request)
                } else {
                    try await viewModel.create(
                        CreateCalendarRequest(
                            name: trimmedName,
                            purpose: purpose.rawValue,
                            color: colorHex,
                            visibility: visibility.rawValue,
                            linkGoogle: linkGoogle
                        )
                    )
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
        .preferredColorScheme(.dark)
        .tint(Theme.accent)
}
