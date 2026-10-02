import SwiftUI

/// 캘린더 탭 맨 위의 "나의 오르빗" 한 줄 + 안부 넛지.
/// 달력을 밀어내지 않도록 얇게: 아바타 줄(접을 수 있음)과 넛지 한 건만.
struct CalendarOrbitStrip: View {
    @Environment(PeopleStore.self) private var store
    @Environment(AuthViewModel.self) private var auth
    @Environment(TabRouter.self) private var router

    @AppStorage("calendarOrbitStripCollapsed") private var collapsed = false
    @State private var quickPerson: Contact?
    @State private var logPerson: Contact?
    @State private var schedulePerson: Contact?
    @State private var requestPerson: Contact?

    private let stripCount = 6

    var body: some View {
        VStack(spacing: 0) {
            if !store.people.isEmpty {
                VStack(spacing: 6) {
                    if collapsed {
                        collapsedRow
                    } else {
                        strip
                    }
                    if !collapsed, let first = store.nudges.first {
                        nudgeCard(first.nudge, person: first.person)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 6)
            }
        }
        .task { await store.refresh() }
        .sheet(item: $quickPerson) { ContactQuickSheet(personId: $0.id, initial: $0) }
        .sheet(item: $logPerson) { LogMeetingSheet(person: $0) }
        .sheet(item: $schedulePerson) { ScheduleWithContactSheet(person: $0) }
        .sheet(item: $requestPerson) { person in
            if let member = person.member {
                TimeRequestSheet(username: member.username, displayName: person.name)
            }
        }
    }

    // MARK: - 아바타 줄

    private var strip: some View {
        HStack(alignment: .top, spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    VStack(spacing: 3) {
                        MeAvatar(user: auth.user, size: 38)
                            .overlay(Circle().strokeBorder(Theme.accent.opacity(0.4), lineWidth: 2))
                        Text("나")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        Text(" ")
                            .font(.system(size: 10))
                    }
                    ForEach(store.people.prefix(stripCount)) { person in
                        Button { quickPerson = person } label: {
                            VStack(spacing: 3) {
                                ContactAvatar(person: person, size: 38)
                                Text(person.name)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.primaryText)
                                    .lineLimit(1)
                                    .frame(maxWidth: 52)
                                Text(ContactFormat.daysSince(person.daysSince))
                                    .font(.system(size: 10))
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
            VStack(spacing: 10) {
                Button {
                    router.selection = .orbit
                } label: {
                    HStack(spacing: 2) {
                        Text("관계")
                        Image(systemName: "chevron.right")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                }
                .buttonStyle(.plain)
                Button {
                    withAnimation(.snappy) { collapsed = true }
                } label: {
                    Image(systemName: "chevron.up")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                        .frame(width: 28, height: 22)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("나의 오르빗 접기")
            }
            .padding(.leading, 8)
            .padding(.top, 4)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    /// 접힌 상태 — 겹친 아바타 몇 개와 펼치기
    private var collapsedRow: some View {
        Button {
            withAnimation(.snappy) { collapsed = false }
        } label: {
            HStack(spacing: 8) {
                HStack(spacing: -8) {
                    ForEach(store.people.prefix(4)) { person in
                        ContactAvatar(person: person, size: 22)
                            .overlay(Circle().strokeBorder(Theme.surface, lineWidth: 1.5))
                    }
                }
                Text("나의 오르빗")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                if !store.nudges.isEmpty {
                    Circle().fill(Theme.accent).frame(width: 6, height: 6)
                }
                Spacer()
                Image(systemName: "chevron.down")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Theme.surface, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("나의 오르빗 펼치기")
    }

    // MARK: - 안부 넛지

    private func nudgeCard(_ nudge: PeopleNudge, person: Contact) -> some View {
        HStack(alignment: .top, spacing: 10) {
            ContactAvatar(person: person, size: 32)
            VStack(alignment: .leading, spacing: 6) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(person.name)님과 마지막으로 만난 지 \(nudge.days)일")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.primaryText)
                    Text("짧은 안부나 시간 제안으로 다시 가까워져 볼까요?")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }
                HStack(spacing: 8) {
                    nudgeButton("시간 제안", symbol: "paperplane") {
                        if person.member != nil {
                            requestPerson = person
                        } else {
                            schedulePerson = person
                        }
                    }
                    nudgeButton("만났어요", symbol: "checkmark") {
                        logPerson = person
                    }
                }
            }
            Spacer(minLength: 0)
            Button {
                Task { _ = await store.update(person.id, ContactPatch(dismissNudge: true)) }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.secondaryText)
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("이 안부 알림 닫기")
        }
        .padding(12)
        .background(person.displayColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func nudgeButton(_ title: String, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Theme.surface, in: Capsule())
        }
        .buttonStyle(.plain)
    }
}
