import SwiftUI

/// 프로필 탭 — 내 공개 프로필.
/// `GET /api/v1/users/{내 username}` 으로 남에게 보이는 모습(카운트/평점/열린 슬롯)을 그대로 보여주고,
/// 이름·아바타·bio·관심사는 auth.user 로컬 정보를 우선해 즉시 반영한다.
/// 헤더 + [프로필 편집 / 프로필 공유] + 내 타임슬롯(탭 → 예약 화면 미리보기).
/// 설정은 우상단 톱니 → SettingsView.
struct ProfileView: View {
    @Environment(AuthViewModel.self) private var auth
    /// 안 읽은 알림 수 — 벨 뱃지 (탭 진입 시 갱신)
    @State private var unreadCount = 0

    var body: some View {
        NavigationStack {
            Group {
                if let username = auth.user?.username {
                    MyProfileContent(username: username)
                        .id(username) // 계정이 바뀌면 뷰모델도 새로
                } else {
                    Theme.background.ignoresSafeArea()
                }
            }
            .navigationTitle("프로필")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        NotificationsView { unreadCount = 0 }
                    } label: {
                        Image(systemName: "bell")
                            .foregroundStyle(Theme.accent)
                            .overlay(alignment: .topTrailing) {
                                if unreadCount > 0 {
                                    Text(unreadCount > 9 ? "9+" : "\(unreadCount)")
                                        .font(.system(size: 9, weight: .bold))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 4)
                                        .padding(.vertical, 1.5)
                                        .background(.red, in: Capsule())
                                        .offset(x: 8, y: -6)
                                }
                            }
                    }
                    .accessibilityLabel("알림")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink {
                        SettingsView()
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(Theme.accent)
                    }
                    .accessibilityLabel("설정")
                }
            }
            .task {
                if let response: NotificationsResponse = try? await APIClient.shared.get(
                    "/api/v1/notifications"
                ) {
                    unreadCount = response.unreadCount
                }
            }
        }
    }
}

// MARK: - 본문 (username 확정 후)

private struct MyProfileContent: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var viewModel: PersonProfileViewModel
    @State private var showingEditProfile = false
    /// 내 캘린더 목록 — nil 이면 로딩 전. 실패해도 섹션만 숨긴다 (부가 콘텐츠).
    @State private var calendars: [CalendarInfo]?

    init(username: String) {
        _viewModel = State(initialValue: PersonProfileViewModel(username: username))
    }

    private var username: String { viewModel.username }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    actionButtons
                    calendarsSection
                    slotsSection
                }
                .padding(16)
            }
            .refreshable {
                await viewModel.load(force: true)
                await loadCalendars()
            }
        }
        .sheet(isPresented: $showingEditProfile, onDismiss: {
            // 편집 저장(auth.user 갱신) 후 서버 기준 프로필도 다시 맞춘다.
            Task { await viewModel.load(force: true) }
        }) {
            if let user = auth.user {
                EditProfileSheet(user: user)
            }
        }
        .task {
            await viewModel.load()
            await loadCalendars()
        }
    }

    private func loadCalendars() async {
        do {
            let response: CalendarsResponse = try await APIClient.shared.get("/api/v1/calendars")
            calendars = response.calendars
        } catch {
            // 캘린더 섹션은 부가 콘텐츠 — 실패하면 그냥 숨긴다.
        }
    }

    // MARK: - 표시값 (로컬 auth.user 우선, 서버 응답 보완)

    private var displayName: String {
        auth.user?.preferredName ?? viewModel.data?.user.preferredName ?? username
    }

    private var bio: String? {
        if let bio = auth.user?.bio, !bio.isEmpty { return bio }
        if let bio = viewModel.data?.user.bio, !bio.isEmpty { return bio }
        return nil
    }

    private var avatarURL: URL? {
        auth.user?.avatarURL ?? viewModel.data?.user.avatarURL
    }

    private var interests: [String] {
        if let interests = auth.user?.interests, !interests.isEmpty { return interests }
        return viewModel.data?.user.interestTags ?? []
    }

    private var orbiting: Int? {
        viewModel.data?.orbiting ?? auth.user?.orbiting
    }

    private var orbiters: Int? {
        viewModel.data?.orbiters ?? auth.user?.orbiters
    }

    // MARK: - 헤더

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 16) {
                avatar
                VStack(alignment: .leading, spacing: 4) {
                    Text(displayName)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.primaryText)
                    Text("@\(username)")
                        .font(.subheadline)
                        .foregroundStyle(Theme.accent)
                }
                Spacer(minLength: 0)
            }

            if let bio {
                Text(bio)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }

            if !interests.isEmpty {
                interestChips(interests)
            }

            if orbiting != nil || orbiters != nil {
                HStack(spacing: 8) {
                    HStack(spacing: 6) {
                        NavigationLink {
                            ConnectionsView(username: username, initialType: .orbiting)
                        } label: {
                            Text("팔로잉 \(orbiting ?? 0)")
                                .monospacedDigit()
                        }
                        .buttonStyle(.plain)
                        Text("·")
                        NavigationLink {
                            ConnectionsView(username: username, initialType: .orbiters)
                        } label: {
                            Text("팔로워 \(orbiters ?? 0)")
                                .monospacedDigit()
                        }
                        .buttonStyle(.plain)
                    }
                    if let rating = viewModel.data?.rating, rating.count > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "star.fill")
                                .font(.caption2)
                                .foregroundStyle(.yellow)
                            Text("\(rating.averageText) (\(rating.count))")
                                .monospacedDigit()
                        }
                    }
                }
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private var avatar: some View {
        AsyncImage(url: avatarURL) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                ZStack {
                    Theme.accent.opacity(0.25)
                    Text(String(displayName.prefix(1)).uppercased())
                        .font(.largeTitle.weight(.semibold))
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .frame(width: 80, height: 80)
        .clipShape(Circle())
    }

    private func interestChips(_ interests: [String]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(interests, id: \.self) { interest in
                    Text(interest)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.accent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Theme.accent.opacity(0.15), in: Capsule())
                }
            }
        }
    }

    // MARK: - 프로필 편집 / 공유

    /// 내 예약 페이지 공유 문구 — 링크를 본문 맨 앞에 둔다 (메신저 미리보기용).
    /// item: URL + message: Text 조합은 공유 시트의 "복사"가 message 텍스트만
    /// 복사하는 iOS 동작이 있어 단일 문자열로 합친다.
    private var shareText: String {
        "https://orbit42.org/\(username)\n\n제 시간을 예약할 수 있는 페이지예요."
    }

    private var actionButtons: some View {
        HStack(spacing: 10) {
            Button {
                showingEditProfile = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil")
                        .font(.footnote)
                    Text("프로필 편집")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primaryText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.fill(0.08), in: Capsule())
            }

            ShareLink(item: shareText) {
                HStack(spacing: 6) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.footnote)
                    Text("프로필 공유")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accent.opacity(0.15), in: Capsule())
            }
        }
    }

    // MARK: - 내 캘린더

    @ViewBuilder
    private var calendarsSection: some View {
        if let calendars, !calendars.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("내 캘린더")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.secondaryText)
                    Spacer()
                    NavigationLink {
                        CalendarSettingsView()
                    } label: {
                        Text("관리")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                    }
                    .buttonStyle(.plain)
                }

                VStack(spacing: 0) {
                    ForEach(calendars) { calendar in
                        calendarRow(calendar)
                        if calendar.id != calendars.last?.id {
                            Divider().overlay(Theme.fill(0.06))
                        }
                    }
                }
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func calendarRow(_ calendar: CalendarInfo) -> some View {
        HStack(spacing: 10) {
            Circle()
                .fill(calendar.displayColor)
                .frame(width: 10, height: 10)
            Text(calendar.name)
                .font(.subheadline)
                .foregroundStyle(Theme.primaryText)
                .lineLimit(1)
            if !calendar.isNative {
                Text("Google")
                    .font(.caption2)
                    .foregroundStyle(Theme.secondaryText)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Theme.fill(0.08), in: Capsule())
            }
            Spacer(minLength: 8)
            if let purposeLabel = calendar.purpose.flatMap({ CalendarPurpose(rawValue: $0)?.label }) {
                Text(purposeLabel)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
            Text(visibilityLabel(calendar.visibility))
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 11)
    }

    private func visibilityLabel(_ visibility: String?) -> String {
        switch visibility {
        case "public": return "전체 공개"
        case "followers": return "팔로워 공개"
        default: return "비공개"
        }
    }

    // MARK: - 내 타임슬롯

    @ViewBuilder
    private var slotsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("내 타임슬롯")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)

            if let data = viewModel.data {
                if data.slots.isEmpty {
                    emptySlotsCard
                } else {
                    ForEach(data.slots) { slot in
                        NavigationLink {
                            // isMine 이라 예약 버튼 없이 미리보기로 동작 —
                            // 내 예약 페이지가 남에게 어떻게 보이는지 확인용.
                            SlotBookingView(username: username, slug: slot.slug)
                        } label: {
                            slotRow(slot)
                        }
                        .buttonStyle(.plain)
                    }
                    Text("탭하면 상대에게 보이는 예약 화면을 미리 볼 수 있어요")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }
            } else if viewModel.isLoading {
                HStack(spacing: 10) {
                    ProgressView()
                        .tint(Theme.accent)
                    Text("프로필을 불러오는 중이에요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            } else if let message = viewModel.errorMessage {
                VStack(spacing: 10) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 28, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text(message)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.secondaryText)
                    Button {
                        Task { await viewModel.load(force: true) }
                    } label: {
                        Text("다시 시도")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Theme.accent)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            .background(Theme.accent.opacity(0.15), in: Capsule())
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 24)
                .padding(.horizontal, 16)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    private var emptySlotsCard: some View {
        VStack(spacing: 8) {
            Image(systemName: "clock.badge.xmark")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("아직 열어둔 시간이 없어요")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.primaryText)
            Text("캘린더 탭의 타임슬롯에서 시간을 열어보세요")
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    private func slotRow(_ slot: TimeSlot) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                Text(slot.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.primaryText)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(slot.durationText)
                    Text("·")
                    Text(slot.isAuction ? "경매" : slot.priceText)
                }
                .font(.footnote)
                .foregroundStyle(Theme.secondaryText)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Theme.secondaryText)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    ProfileView()
        .environment(AuthViewModel())
        .tint(Theme.accent)
}
