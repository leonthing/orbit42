import SwiftUI

/// 프로필 탭 > 이동시간 버퍼 — 자주 가는 장소별 이동시간 목록/편집/생성/삭제.
struct LocationBuffersView: View {
    @State private var viewModel = LocationBuffersViewModel()
    @State private var editingBuffer: LocationBuffer?
    @State private var showingCreate = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("이동시간 버퍼")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingCreate = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("장소 추가")
            }
        }
        .sheet(item: $editingBuffer) { buffer in
            LocationBufferEditorSheet(mode: .edit(buffer), viewModel: viewModel)
        }
        .sheet(isPresented: $showingCreate) {
            LocationBufferEditorSheet(mode: .create, viewModel: viewModel)
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
        .task { await viewModel.load() }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let buffers = viewModel.buffers {
            if buffers.isEmpty {
                emptyState
            } else {
                bufferList(buffers)
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
            Text("이동시간 버퍼를 불러오는 중이에요")
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
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "figure.walk")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("자주 가는 장소를 등록하면 예약 가능 시간을 계산할 때 이동시간이 반영돼요.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
            Button {
                showingCreate = true
            } label: {
                Text("장소 추가")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Theme.surface, in: Capsule())
            }
        }
        .padding(.horizontal, 32)
    }

    // MARK: - 목록

    private func bufferList(_ buffers: [LocationBuffer]) -> some View {
        List {
            Section {
                ForEach(buffers) { buffer in
                    Button {
                        editingBuffer = buffer
                    } label: {
                        LocationBufferRow(buffer: buffer)
                    }
                    .opacity(viewModel.deletingIds.contains(buffer.id) ? 0.4 : 1)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { await viewModel.delete(buffer) }
                        } label: {
                            Label("삭제", systemImage: "trash")
                        }
                    }
                }
            } footer: {
                Text("행을 누르면 이름·이동시간·별칭을 바꾸거나 삭제할 수 있어요.")
                    .foregroundStyle(Theme.secondaryText)
            }
            .listRowBackground(Theme.surface)
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.load(force: true)
        }
    }
}

// MARK: - 버퍼 행

private struct LocationBufferRow: View {
    let buffer: LocationBuffer

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 8) {
                    Text(buffer.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    Text("이동 \(buffer.bufferMin)분")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Theme.fill(0.08), in: Capsule())
                }
                if !buffer.aliases.isEmpty {
                    Text("별칭: \(buffer.aliases.joined(separator: ", "))")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText.opacity(0.6))
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

// MARK: - 생성/편집 시트

/// 이동시간 버퍼 생성/편집 시트.
/// - 생성: `POST /api/v1/location-buffers`
/// - 편집: `PATCH /api/v1/location-buffers/{id}` — 바뀐 필드만 전송
private struct LocationBufferEditorSheet: View {
    enum Mode {
        case create
        case edit(LocationBuffer)
    }

    @Environment(\.dismiss) private var dismiss

    let mode: Mode
    let viewModel: LocationBuffersViewModel

    @State private var name: String
    @State private var bufferMin: Int
    @State private var aliases: [String]
    @State private var newAliasText = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showingDeleteConfirm = false

    init(mode: Mode, viewModel: LocationBuffersViewModel) {
        self.mode = mode
        self.viewModel = viewModel
        switch mode {
        case .create:
            _name = State(initialValue: "")
            _bufferMin = State(initialValue: 30)
            _aliases = State(initialValue: [])
        case .edit(let buffer):
            _name = State(initialValue: buffer.name)
            _bufferMin = State(initialValue: min(max(buffer.bufferMin, 0), 180))
            _aliases = State(initialValue: buffer.aliases)
        }
    }

    private var original: LocationBuffer? {
        if case .edit(let buffer) = mode { return buffer }
        return nil
    }

    private var isCreate: Bool { original == nil }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("장소") {
                    TextField("장소 이름 (예: 강남 사무실)", text: $name)
                        .foregroundStyle(Theme.primaryText)
                }
                .listRowBackground(Theme.surface)

                Section {
                    Stepper("이동 \(bufferMin)분", value: $bufferMin, in: 0...180, step: 5)
                } header: {
                    Text("이동시간")
                } footer: {
                    Text("이 장소로 오가는 데 걸리는 시간이에요. 예약 가능 시간을 계산할 때 앞뒤로 비워 둬요.")
                        .foregroundStyle(Theme.secondaryText)
                }
                .listRowBackground(Theme.surface)

                Section {
                    ForEach(aliases.indices, id: \.self) { index in
                        HStack {
                            Text(aliases[index])
                            Spacer()
                            VisibleRemoveButton(accessibilityLabel: "\(aliases[index]) 별칭 빼기") {
                                aliases.remove(at: index)
                            }
                        }
                    }
                    .onDelete { offsets in
                        aliases.remove(atOffsets: offsets)
                    }

                    HStack {
                        TextField("별칭 추가 (예: 강남역)", text: $newAliasText)
                            .onSubmit { addAlias() }
                        Button {
                            addAlias()
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundStyle(Theme.accent)
                        }
                        .buttonStyle(.borderless)
                        .disabled(newAliasText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityLabel("별칭 추가")
                    }
                } header: {
                    Text("별칭")
                } footer: {
                    Text("일정 위치에 별칭이 들어 있어도 같은 장소로 인식해요")
                        .foregroundStyle(Theme.secondaryText)
                }
                .listRowBackground(Theme.surface)

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }

                // 목록에서 밀어야만 지울 수 있던 것을 편집 화면에도 (개선-26)
                if let original {
                    Section {
                        Button(role: .destructive) {
                            showingDeleteConfirm = true
                        } label: {
                            Label("이 장소 삭제", systemImage: "trash")
                        }
                        .disabled(isSaving)
                    }
                    .listRowBackground(Theme.surface)
                    .confirmationDialog(
                        "'\(original.name)' 장소를 삭제할까요?",
                        isPresented: $showingDeleteConfirm,
                        titleVisibility: .visible
                    ) {
                        Button("삭제", role: .destructive) {
                            Task {
                                await viewModel.delete(original)
                                dismiss()
                            }
                        }
                        Button("돌아가기", role: .cancel) {}
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(isCreate ? "새 장소" : "장소 편집")
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

    // MARK: - 별칭

    private func addAlias() {
        let trimmed = newAliasText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard !aliases.contains(trimmed) else {
            newAliasText = ""
            return
        }
        aliases.append(trimmed)
        newAliasText = ""
    }

    // MARK: - 저장

    private func save() {
        errorMessage = nil
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedAliases = aliases
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        isSaving = true
        Task {
            defer { isSaving = false }
            do {
                if let original {
                    var request = PatchLocationBufferRequest()
                    if trimmedName != original.name {
                        request.name = trimmedName
                    }
                    if bufferMin != original.bufferMin {
                        request.bufferMin = bufferMin
                    }
                    if cleanedAliases != original.aliases {
                        request.aliases = cleanedAliases
                    }
                    if request.isEmpty {
                        dismiss()
                        return
                    }
                    try await viewModel.update(id: original.id, request: request)
                } else {
                    try await viewModel.create(
                        CreateLocationBufferRequest(
                            name: trimmedName,
                            bufferMin: bufferMin,
                            aliases: cleanedAliases
                        )
                    )
                }
                dismiss()
            } catch let apiError as APIError {
                errorMessage = apiError.errorDescription
            } catch {
                errorMessage = "이동시간 버퍼를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
            }
        }
    }
}

#Preview {
    NavigationStack {
        LocationBuffersView()
    }
    .tint(Theme.accent)
}
