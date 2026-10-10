import SwiftUI

/// 오르빗 탭 궤도 아래: 최근 만난 순 한 줄 + 안부 넛지.
/// (처음엔 캘린더 탭 위에 있었지만, 달력은 일정에 집중하도록 오르빗 탭으로 옮겼다.)
struct OrbitRecentStrip: View {
    @Environment(PeopleStore.self) private var store

    @State private var quickPerson: Contact?
    @State private var logPerson: Contact?
    @State private var schedulePerson: Contact?
    @State private var requestPerson: Contact?

    /// 최근에 만난 순 — 만난 기록이 없는 사람은 뒤로
    private var recent: [Contact] {
        store.people.sorted { ($0.daysSince ?? .max) < ($1.daysSince ?? .max) }
    }

    var body: some View {
        VStack(spacing: 8) {
            if !store.people.isEmpty {
                strip
            }
            ForEach(store.nudges, id: \.person.id) { item in
                nudgeCard(item.nudge, person: item.person)
            }
        }
        .sheet(item: $quickPerson) { ContactQuickSheet(personId: $0.id, initial: $0) }
        .sheet(item: $logPerson) { LogMeetingSheet(person: $0) }
        .sheet(item: $schedulePerson) { ScheduleWithContactSheet(person: $0) }
        .sheet(item: $requestPerson) { person in
            if let member = person.member {
                TimeRequestSheet(username: member.username, displayName: person.name)
            }
        }
    }

    // MARK: - 최근 만난 순

    private var strip: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("최근 만난 순")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(recent) { person in
                        Button { quickPerson = person } label: {
                            VStack(spacing: 3) {
                                ContactAvatar(person: person, size: 42)
                                Text(person.name)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(Theme.primaryText)
                                    .lineLimit(1)
                                    .frame(maxWidth: 56)
                                Text(ContactFormat.metOrNext(person))
                                    .font(.system(size: 10))
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
        .padding(12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
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
                    CheckInMenu(person: person) {
                        nudgeLabel("안부 보내기", symbol: "paperplane")
                    }
                    .buttonStyle(.plain)
                    nudgeButton("시간 제안", symbol: "calendar.badge.plus") {
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
            nudgeLabel(title, symbol: symbol)
        }
        .buttonStyle(.plain)
    }

    private func nudgeLabel(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Theme.primaryText)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Theme.surface, in: Capsule())
    }
}
