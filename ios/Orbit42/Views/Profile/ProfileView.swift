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
    @Environment(\.openURL) private var openURL
    @State private var viewModel: PersonProfileViewModel
    @State private var showingEditProfile = false

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
                    bookingsLink
                    CalendarCardsSection(username: username, isMe: true)
                    slotsSection
                }
                .padding(16)
                .readableWidth()
            }
            .refreshable {
                await viewModel.load(force: true)
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

    /// 소셜 링크 — 편집 직후 즉시 반영되도록 auth.user 우선.
    private var socialLinkItems: [SocialLinkItem] {
        let links = auth.user?.socialLinks
            ?? viewModel.data?.user.socialLinks
            ?? [:]
        return SocialLinkKind.allCases.compactMap { kind in
            guard
                let raw = links[kind.rawValue]?.trimmingCharacters(in: .whitespaces),
                !raw.isEmpty,
                let url = URL(string: raw)
            else { return nil }
            return SocialLinkItem(kind: kind, url: url)
        }
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

            if !socialLinkItems.isEmpty {
                HStack(spacing: 10) {
                    ForEach(socialLinkItems) { link in
                        Button {
                            openURL(link.url)
                        } label: {
                            SocialIcon(kind: link.kind, size: 18)
                                .foregroundStyle(Theme.accent)
                                .frame(width: 34, height: 34)
                                .background(Theme.fill(0.08), in: Circle())
                        }
                        .accessibilityLabel(link.kind.label)
                    }
                }
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

    /// 내 예약 페이지 공유 — URL 만 넘긴다.
    ///
    /// 예전엔 안내 문구를 본문에 합쳐 단일 문자열로 공유했는데, 그러면 붙여넣기에
    /// 한글이 섞여 나와 주소창에 넣으면 404 가 난다. 미리보기 문구는 페이지의
    /// OG 태그가 담당하므로 링크만 넘기면 충분하다. (타임슬롯 공유도 URL 방식)
    private var shareURL: URL? {
        URL(string: "https://orbit42.org/\(username)")
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

            if let shareURL {
                ShareLink(item: shareURL) {
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
    }

    // MARK: - 예약 (구 예약 탭)

    private var bookingsLink: some View {
        NavigationLink {
            BookingsView(embedded: true)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle")
                    .font(.body)
                    .foregroundStyle(Theme.accent)
                    .frame(width: 26)
                VStack(alignment: .leading, spacing: 1) {
                    Text("예약")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                    Text("받은 예약과 내가 신청한 예약")
                        .font(.caption)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
            }
            .padding(14)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
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
