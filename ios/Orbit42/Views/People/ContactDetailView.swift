import SwiftUI

/// 한 사람의 자세한 화면 — 지표, 메모, 지난/다가오는 만남, 보관.
struct ContactDetailView: View {
    @Environment(PeopleStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let personId: String
    let initial: Contact

    @State private var detail: ContactDetailResponse?
    @State private var loadError: String?
    @State private var showingEditor = false
    @State private var showingLog = false
    @State private var showingSchedule = false
    @State private var confirmRemove = false

    private var person: Contact { detail?.person ?? store.person(id: personId) ?? initial }

    var body: some View {
        List {
            Section {
                header
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 4, trailing: 0))
                stats
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                quickActions
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
            }
            .listRowSeparator(.hidden)

            Section {
                Button {
                    showingEditor = true
                } label: {
                    if let memo = person.memo, !memo.isEmpty {
                        Text(memo)
                            .font(.subheadline)
                            .foregroundStyle(Theme.primaryText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Text("어떻게 알게 됐는지, 다음에 나눌 이야기를 남겨두세요")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
                .buttonStyle(.plain)
            } header: {
                sectionHeader("메모")
            }
            .listRowBackground(Theme.surface)

            if let upcoming = detail?.upcoming, !upcoming.isEmpty {
                Section {
                    ForEach(upcoming) { meetingRow($0) }
                } header: {
                    sectionHeader("다가오는 만남")
                }
                .listRowBackground(Theme.surface)
            }

            Section {
                if let past = detail?.past {
                    if past.isEmpty {
                        Text("아직 기록된 만남이 없어요")
                            .font(.subheadline)
                            .foregroundStyle(Theme.secondaryText)
                    }
                    ForEach(past) { meeting in
                        meetingRow(meeting)
                            .swipeActions {
                                if meeting.isManual {
                                    Button(role: .destructive) {
                                        Task {
                                            if await store.deleteMeeting(meeting.id) { await load() }
                                        }
                                    } label: {
                                        Label("삭제", systemImage: "trash")
                                    }
                                }
                            }
                    }
                } else if let loadError {
                    Text(loadError)
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                } else {
                    ProgressView().frame(maxWidth: .infinity)
                }
            } header: {
                sectionHeader("지난 만남")
            } footer: {
                if detail?.past.contains(where: \.isManual) == true {
                    Text("직접 남긴 만남은 왼쪽으로 밀어 지울 수 있어요.")
                }
            }
            .listRowBackground(Theme.surface)

            Section {
                if let email = person.email {
                    LabeledContent("이메일", value: email)
                }
                LabeledContent("처음 연결", value: ContactFormat.sourceLabel(person.source))
            }
            .listRowBackground(Theme.surface)

            Section {
                if person.status == "archived" {
                    Button("궤도로 되돌리기") {
                        Task { await setStatus("active") }
                    }
                } else {
                    Button("보관하기") {
                        Task { await setStatus("archived") }
                    }
                }
                Button("궤도에서 빼기", role: .destructive) {
                    confirmRemove = true
                }
            } footer: {
                Text("보관해도 함께한 기록은 그대로 남아요. 빼면 다시 제안하지 않아요.")
            }
            .listRowBackground(Theme.surface)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle(person.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("편집") { showingEditor = true }
            }
        }
        .confirmationDialog("\(person.name)님을 궤도에서 뺄까요?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("궤도에서 빼기", role: .destructive) {
                Task {
                    await setStatus("dismissed")
                    dismiss()
                }
            }
        } message: {
            Text("캘린더에서 다시 만나도 제안하지 않아요.")
        }
        .sheet(isPresented: $showingEditor) {
            ContactEditorSheet(person: person) { Task { await load() } }
        }
        .sheet(isPresented: $showingLog) {
            LogMeetingSheet(person: person) { Task { await load() } }
        }
        .sheet(isPresented: $showingSchedule, onDismiss: { Task { await load() } }) {
            ScheduleWithContactSheet(person: person)
        }
        .alert("알림", isPresented: Binding(
            get: { store.actionMessage != nil },
            set: { if !$0 { store.actionMessage = nil } }
        )) {
            Button("확인", role: .cancel) {}
        } message: {
            Text(store.actionMessage ?? "")
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            detail = try await store.detail(personId)
            loadError = nil
        } catch {
            loadError = (error as? APIError)?.errorDescription ?? "불러오지 못했어요."
        }
    }

    private func setStatus(_ status: String) async {
        if await store.update(personId, ContactPatch(status: status)) {
            await load()
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Theme.secondaryText)
            .textCase(nil)
    }

    // MARK: - 머리

    private var header: some View {
        VStack(spacing: 10) {
            ContactAvatar(person: person, size: 96)
                .shadow(color: person.displayColor.opacity(0.3), radius: 12, y: 4)
            Text(person.name)
                .font(.title.weight(.bold))
                .foregroundStyle(Theme.primaryText)
            Text(person.subtitle)
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
            if person.status == "archived" {
                Text("보관함")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Theme.fill(0.06), in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var stats: some View {
        HStack(spacing: 8) {
            statTile(symbol: "clock", title: "마지막", value: ContactFormat.daysSince(person.daysSince))
            statTile(symbol: "hourglass", title: "함께", value: ContactFormat.hours(person.hoursTogether))
            statTile(symbol: "person.2", title: "만남", value: "\(person.meetingsTotal)회")
        }
    }

    private func statTile(symbol: String, title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: symbol)
                .font(.caption)
                .foregroundStyle(person.displayColor)
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(Theme.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .peopleCard(padding: 12)
    }

    private var quickActions: some View {
        HStack(spacing: 8) {
            ContactActionTile(symbol: "hand.wave", title: "만났어요", tint: person.displayColor) {
                showingLog = true
            }
            ContactActionTile(symbol: "calendar.badge.plus", title: "일정 잡기", tint: Theme.accent) {
                showingSchedule = true
            }
            if let member = person.member {
                NavigationLink {
                    PersonProfileView(username: member.username)
                } label: {
                    VStack(spacing: 8) {
                        Image(systemName: "person.crop.circle")
                            .font(.title3)
                            .foregroundStyle(Theme.accent)
                        Text("프로필")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Theme.primaryText)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - 만남 행

    private func meetingRow(_ meeting: ContactMeeting) -> some View {
        HStack(spacing: 12) {
            Image(systemName: ContactFormat.meetingSourceIcon(meeting.source))
                .font(.footnote)
                .foregroundStyle(person.displayColor)
                .frame(width: 28, height: 28)
                .background(person.displayColor.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.title ?? "만남")
                    .font(.subheadline)
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Text(ContactFormat.full(meeting.startDate))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
            Spacer(minLength: 0)
        }
    }
}
