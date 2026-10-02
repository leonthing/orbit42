import SwiftUI

// MARK: - 만났어요

/// 캘린더에 없던 만남(커피챗·우연한 만남)을 직접 남긴다.
struct LogMeetingSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(PeopleStore.self) private var store

    let person: Contact
    var onSaved: () -> Void = {}

    @State private var title = ""
    @State private var date = Date()
    @State private var minutes = 60
    @State private var isSaving = false

    private let durations = [30, 60, 90, 120]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        ContactAvatar(person: person, size: 36)
                        Text("\(person.name)님과 만났어요")
                            .font(.headline)
                            .foregroundStyle(Theme.primaryText)
                    }
                }
                .listRowBackground(Theme.surface)

                Section {
                    TextField("무엇을 했나요? (커피챗, 점심…)", text: $title)
                    DatePicker("언제", selection: $date, in: ...Date().addingTimeInterval(86_400))
                    Picker("얼마나", selection: $minutes) {
                        ForEach(durations, id: \.self) { m in
                            Text(m < 60 ? "\(m)분" : m % 60 == 0 ? "\(m / 60)시간" : "\(m / 60)시간 \(m % 60)분").tag(m)
                        }
                    }
                    .pickerStyle(.segmented)
                } footer: {
                    Text("함께한 시간과 궤도 거리에 반영돼요.")
                }
                .listRowBackground(Theme.surface)

                if let message = store.actionMessage {
                    Section {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("만남 기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") {
                        Task {
                            isSaving = true
                            let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
                            let ok = await store.logMeeting(
                                person.id, title: trimmed.isEmpty ? nil : trimmed, at: date, minutes: minutes
                            )
                            isSaving = false
                            if ok {
                                onSaved()
                                dismiss()
                            }
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { store.actionMessage = nil }
        .onDisappear { store.actionMessage = nil }
    }
}

// MARK: - 사람 추가 / 편집

struct ContactEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(PeopleStore.self) private var store

    /// nil 이면 새로 추가
    let person: Contact?
    var onSaved: () -> Void = {}

    @State private var name = ""
    @State private var email = ""
    @State private var company = ""
    @State private var role = ""
    @State private var memo = ""
    @State private var isSaving = false

    init(person: Contact?, onSaved: @escaping () -> Void = {}) {
        self.person = person
        self.onSaved = onSaved
        _name = State(initialValue: person?.name ?? "")
        _email = State(initialValue: person?.email ?? "")
        _company = State(initialValue: person?.company ?? "")
        _role = State(initialValue: person?.role ?? "")
        _memo = State(initialValue: person?.memo ?? "")
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("이름", text: $name)
                    if person == nil {
                        TextField("이메일 (선택)", text: $email)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                } footer: {
                    if person == nil {
                        Text("이메일을 넣으면 캘린더 일정의 참석자와 같은 사람으로 이어져요. 상대에게는 아무것도 보내지 않아요.")
                    }
                }
                .listRowBackground(Theme.surface)

                Section {
                    TextField("회사 (선택)", text: $company)
                    TextField("직함 (선택)", text: $role)
                }
                .listRowBackground(Theme.surface)

                Section {
                    TextField("메모 — 어떻게 알게 됐는지, 다음에 나눌 이야기", text: $memo, axis: .vertical)
                        .lineLimit(3...8)
                } footer: {
                    Text("메모는 나만 볼 수 있어요.")
                }
                .listRowBackground(Theme.surface)

                if let message = store.actionMessage {
                    Section {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                    .listRowBackground(Theme.surface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle(person == nil ? "사람 추가" : "정보 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("취소") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("저장") { Task { await save() } }
                        .disabled(!canSave)
                }
            }
        }
        .onAppear { store.actionMessage = nil }
        .onDisappear { store.actionMessage = nil }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        func clean(_ s: String) -> String? {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        let ok: Bool
        if let person {
            ok = await store.update(person.id, ContactPatch(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                company: clean(company) ?? "",
                role: clean(role) ?? "",
                memo: clean(memo) ?? ""
            ))
        } else {
            ok = await store.add(AddContactRequest(
                name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                email: clean(email),
                company: clean(company),
                role: clean(role),
                memo: clean(memo)
            ))
        }
        if ok {
            onSaved()
            dismiss()
        }
    }
}

// MARK: - 일정 잡기 (참석자 미리 채움)

extension Contact {
    /// 일정 추가 시트에 미리 넣을 참석자 — 회원은 계정으로, 아니면 이메일로 초대.
    var pendingParticipant: PendingParticipant? {
        if let member {
            return PendingParticipant(target: .user(
                username: member.username, displayName: member.displayName, avatarUrl: member.avatarUrl
            ))
        }
        if let email { return PendingParticipant(target: .email(email)) }
        return nil
    }
}

/// 이 사람과의 일정 추가 — 기존 일정 추가 시트에 제목·참석자를 채워 연다.
struct ScheduleWithContactSheet: View {
    @Environment(PeopleStore.self) private var store
    let person: Contact
    @State private var calendarViewModel = CalendarViewModel()

    var body: some View {
        AddEventSheet(
            viewModel: calendarViewModel,
            defaultDate: Date(),
            initialTitle: "\(person.name) 미팅",
            initialParticipants: person.pendingParticipant.map { [$0] } ?? []
        )
        .onDisappear {
            Task { await store.resync() }
        }
    }
}
