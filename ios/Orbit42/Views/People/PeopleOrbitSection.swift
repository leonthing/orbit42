import SwiftUI

/// 오르빗 탭 맨 위 — 나를 중심으로 요즘 만나는 사람들.
/// 궤도 그림 → (캘린더에서 사람 찾기 안내 | 제안) → 사람별 관계 카드 → 보관함.
struct PeopleOrbitSection: View {
    @Environment(PeopleStore.self) private var store
    @Environment(AuthViewModel.self) private var auth

    @State private var quickPerson: Contact?
    @State private var logPerson: Contact?
    @State private var addingPerson = false
    @State private var showAllCards = false
    @State private var enableNote: String?

    private let initialCardCount = 8

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("나를 중심으로, 요즘 만나는 사람들")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
                .padding(.top, 6)

            ContactOrbitView(
                people: store.people,
                me: auth.user,
                onTapPerson: { quickPerson = $0 },
                onAdd: { addingPerson = true }
            )

            if !store.importEnabled, store.data != nil {
                importCard
            } else if !store.suggestions.isEmpty {
                suggestionsCard
            }

            if let enableNote {
                Text(enableNote)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }

            Color.clear.frame(height: 0).id("relationship-cards")

            let cards = showAllCards ? store.people : Array(store.people.prefix(initialCardCount))
            ForEach(cards) { person in
                NavigationLink {
                    ContactDetailView(personId: person.id, initial: person)
                } label: {
                    RelationshipCard(person: person) { logPerson = person }
                }
                .buttonStyle(.plain)
            }
            if store.people.count > initialCardCount {
                Button {
                    withAnimation { showAllCards.toggle() }
                } label: {
                    Text(showAllCards ? "접기" : "\(store.people.count - initialCardCount)명 더 보기")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.plain)
            }

            if !store.archived.isEmpty {
                archivedSection
            }
        }
        .sheet(item: $quickPerson) { person in
            ContactQuickSheet(personId: person.id, initial: person)
        }
        #if DEBUG
        // 스크린샷용: DEMO_PEOPLE=quick 이면 첫 사람의 빠른 시트를 연다.
        .onChange(of: store.people.first?.id) { _, id in
            guard id != nil, quickPerson == nil,
                  ProcessInfo.processInfo.environment["DEMO_PEOPLE"] == "quick" else { return }
            quickPerson = store.people.first
        }
        #endif
        .sheet(item: $logPerson) { person in
            LogMeetingSheet(person: person)
        }
        .sheet(isPresented: $addingPerson) {
            ContactEditorSheet(person: nil)
        }
    }

    // MARK: - 캘린더에서 사람 찾기 (켜기 전)

    private var importCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "person.2.circle")
                    .font(.title3)
                    .foregroundStyle(Theme.accent)
                Text("캘린더 참석자로 관계 지도 만들기")
                    .font(.headline)
                    .foregroundStyle(Theme.primaryText)
            }
            Text("구글·기기 캘린더 일정에 함께 있던 사람의 이름과 이메일만 읽어, 자주 만난 사람을 제안해 드려요. 상대에게는 아무것도 보내지 않고, 언제든 끌 수 있어요.")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                Task { enableNote = await store.enableImport() }
            } label: {
                HStack {
                    if store.isEnabling {
                        ProgressView().tint(.white)
                    }
                    Text(store.isEnabling ? "찾는 중이에요" : "캘린더에서 찾아보기")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(store.isEnabling)
        }
        .peopleCard()
    }

    // MARK: - 제안

    private var suggestionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("캘린더에서 찾은 사람 \(store.suggestions.count)명")
                        .font(.headline)
                        .foregroundStyle(Theme.primaryText)
                    Text("궤도에 넣을 사람만 골라주세요")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                Button("모두 추가") {
                    Task { await store.resolve(store.suggestions.map(\.id), accept: true) }
                }
                .font(.subheadline.weight(.semibold))
            }

            VStack(spacing: 0) {
                ForEach(store.suggestions.prefix(6)) { person in
                    suggestionRow(person)
                    if person.id != store.suggestions.prefix(6).last?.id {
                        Divider().overlay(Theme.fill(0.06)).padding(.leading, 48)
                    }
                }
            }
        }
        .peopleCard()
    }

    private func suggestionRow(_ person: Contact) -> some View {
        HStack(spacing: 12) {
            ContactAvatar(person: person, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(person.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Text(suggestionDetail(person))
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Button {
                Task { await store.resolve([person.id], accept: false) }
            } label: {
                Image(systemName: "xmark")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(width: 32, height: 32)
                    .background(Theme.fill(0.05), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(person.name) 제안 넘기기")
            Button {
                Task { await store.resolve([person.id], accept: true) }
            } label: {
                Image(systemName: "plus")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(person.displayColor)
                    .frame(width: 32, height: 32)
                    .background(person.displayColor.opacity(0.14), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(person.name) 궤도에 추가")
        }
        .padding(.vertical, 8)
    }

    private func suggestionDetail(_ person: Contact) -> String {
        var parts: [String] = []
        if person.meetingsTotal > 0 { parts.append("\(person.meetingsTotal)번 만남") }
        if person.daysSince != nil { parts.append("마지막 \(ContactFormat.daysSince(person.daysSince))") }
        if parts.isEmpty, let next = person.nextMeetingDate { parts.append("\(ContactFormat.short(next)) 예정") }
        if let email = person.email { parts.append(email) }
        return parts.joined(separator: " · ")
    }

    // MARK: - 보관함

    private var archivedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("보관한 사람")
                    .font(.headline)
                    .foregroundStyle(Theme.primaryText)
                Text("궤도에서는 빠졌지만 함께한 기록은 그대로 있어요")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
            VStack(spacing: 0) {
                ForEach(store.archived) { person in
                    NavigationLink {
                        ContactDetailView(personId: person.id, initial: person)
                    } label: {
                        HStack(spacing: 12) {
                            ContactAvatar(person: person, size: 36).opacity(0.6)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(person.name)
                                    .foregroundStyle(Theme.primaryText)
                                Text(person.archivedDate.map { "\(ContactFormat.short($0)) 보관" } ?? "보관함")
                                    .font(.caption)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(Theme.secondaryText)
                        }
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if person.id != store.archived.last?.id {
                        Divider().overlay(Theme.fill(0.06)).padding(.leading, 48)
                    }
                }
            }
            .peopleCard(padding: 12)
        }
        .padding(.top, 8)
    }
}

// MARK: - 관계 카드

/// 한 사람과의 관계 요약 — 마지막 만남 / 함께한 시간 / 최근 90일 / 다음 일정.
struct RelationshipCard: View {
    let person: Contact
    let onLog: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ContactAvatar(person: person, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(person.name)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Theme.primaryText)
                        .lineLimit(1)
                    Text(person.subtitle)
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
                Spacer()
                Button(action: onLog) {
                    Image(systemName: "plus")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(person.displayColor)
                        .frame(width: 36, height: 36)
                        .background(person.displayColor.opacity(0.13), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(person.name)님과 만남 기록")
            }

            HStack(spacing: 0) {
                ContactMetric(title: "마지막 만남", value: ContactFormat.daysSince(person.daysSince))
                Divider().frame(height: 28)
                ContactMetric(title: "함께한 시간", value: ContactFormat.hours(person.hoursTogether))
                Divider().frame(height: 28)
                ContactMetric(title: "최근 90일", value: "\(person.meetings90)번")
                Divider().frame(height: 28)
                ContactMetric(title: "다음 일정", value: ContactFormat.short(person.nextMeetingDate))
            }

            if let title = person.nextMeetingTitle, person.nextMeetingAt != nil {
                Label(title, systemImage: "calendar")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            } else if let title = person.lastMeetingTitle {
                Label(title, systemImage: "clock.arrow.circlepath")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            }
        }
        .contentShape(Rectangle())
        .peopleCard()
    }
}
