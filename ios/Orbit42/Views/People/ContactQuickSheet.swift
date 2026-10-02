import SwiftUI

/// 궤도에서 사람을 눌렀을 때의 빠른 시트 — 지금 할 수 있는 일(만났어요·일정 잡기·
/// 시간 요청)을 먼저, 자세한 기록은 한 번 더 들어가서.
struct ContactQuickSheet: View {
    @Environment(PeopleStore.self) private var store
    let personId: String
    /// 시트를 연 순간의 값 — 저장 뒤에는 store 의 최신 값으로 바꿔 보여준다.
    let initial: Contact

    @State private var showingLog = false
    @State private var showingSchedule = false
    @State private var showingTimeRequest = false
    @State private var showingDetail = false
    @State private var detent: PresentationDetent = .medium

    private var person: Contact { store.person(id: personId) ?? initial }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Button { showingDetail = true } label: { header }
                        .buttonStyle(.plain)

                    pills

                    actions

                    if let title = person.lastMeetingTitle, person.lastMetAt != nil {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("최근 만남")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.secondaryText)
                            HStack {
                                Text(title)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.primaryText)
                                    .lineLimit(1)
                                Spacer()
                                Text(ContactFormat.daysSince(person.daysSince))
                                    .font(.footnote)
                                    .foregroundStyle(Theme.secondaryText)
                            }
                        }
                        .peopleCard(padding: 14)
                    }

                    if let memo = person.memo, !memo.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("메모")
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Theme.secondaryText)
                            Text(memo)
                                .font(.subheadline)
                                .foregroundStyle(Theme.primaryText)
                                .lineLimit(4)
                        }
                        .peopleCard(padding: 14)
                    }
                }
                .padding(20)
            }
            .background(Theme.background.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(isPresented: $showingDetail) {
                ContactDetailView(personId: person.id, initial: person)
            }
            #if DEBUG
            .onAppear {
                if ProcessInfo.processInfo.environment["DEMO_PEOPLE_DETAIL"] == "1" { showingDetail = true }
            }
            #endif
        }
        .presentationDetents([.medium, .large], selection: $detent)
        // 자세히 들어가면 목록이 길어지니 시트를 끝까지 올린다.
        .onChange(of: showingDetail) { _, shown in
            if shown { detent = .large }
        }
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $showingLog) {
            LogMeetingSheet(person: person)
        }
        .sheet(isPresented: $showingSchedule) {
            ScheduleWithContactSheet(person: person)
        }
        .sheet(isPresented: $showingTimeRequest) {
            if let member = person.member {
                TimeRequestSheet(username: member.username, displayName: person.name)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            ContactAvatar(person: person, size: 60)
            VStack(alignment: .leading, spacing: 4) {
                Text(person.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                Text(person.subtitle)
                    .font(.subheadline)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(1)
            }
            Spacer()
            Text("자세히")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
        .contentShape(Rectangle())
    }

    private var pills: some View {
        HStack(spacing: 8) {
            ContactPill(
                symbol: "clock",
                text: person.daysSince.map { $0 == 0 ? "오늘 만남" : "\(ContactFormat.daysSince($0)) 만남" } ?? "만난 기록 없음"
            )
            if let next = person.nextMeetingDate {
                ContactPill(symbol: "calendar", text: "다음 \(ContactFormat.short(next))")
            } else if person.hoursTogether > 0 {
                ContactPill(symbol: "hourglass", text: "함께 \(ContactFormat.hours(person.hoursTogether))")
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 8) {
            ContactActionTile(symbol: "hand.wave", title: "만났어요", tint: person.displayColor) {
                showingLog = true
            }
            // 이메일이 없어도 일정은 잡을 수 있다 — 초대만 빠진다.
            ContactActionTile(symbol: "calendar.badge.plus", title: "일정 잡기", tint: Theme.accent) {
                showingSchedule = true
            }
            if person.member == nil {
                ContactActionTile(symbol: "text.alignleft", title: "기록·메모", tint: Theme.accent) {
                    showingDetail = true
                }
            }
            if let member = person.member {
                ContactActionTile(symbol: "clock.arrow.circlepath", title: "시간 요청", tint: Theme.accent) {
                    showingTimeRequest = true
                }
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
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(Theme.fill(0.06), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}
