import SwiftUI

/// 타인 프로필 화면 — 헤더(아바타/이름/bio/관심사/오르빗/평점) + 팔로우 토글 +
/// 시간 요청 + 열린 슬롯 목록(탭 → 예약 화면).
struct PersonProfileView: View {
    @Environment(\.openURL) private var openURL
    @State private var viewModel: PersonProfileViewModel
    @State private var showingTimeRequest = false
    @State private var showingBlockConfirm = false

    init(username: String) {
        _viewModel = State(initialValue: PersonProfileViewModel(username: username))
    }

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            content
        }
        .navigationTitle("@\(viewModel.username)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let data = viewModel.data, !data.isMe {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if data.isBlocked {
                            Button {
                                Task { await viewModel.toggleBlock() }
                            } label: {
                                Label("차단 해제", systemImage: "hand.raised.slash")
                            }
                        } else {
                            Button(role: .destructive) {
                                showingBlockConfirm = true
                            } label: {
                                Label("차단하기", systemImage: "hand.raised")
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .foregroundStyle(Theme.primaryText)
                    }
                    .disabled(viewModel.isTogglingBlock)
                }
            }
        }
        .confirmationDialog(
            "차단하면 서로 팔로우가 해제되고, 검색·예약·시간 요청이 막혀요.",
            isPresented: $showingBlockConfirm,
            titleVisibility: .visible
        ) {
            Button("차단하기", role: .destructive) {
                Task { await viewModel.toggleBlock() }
            }
            Button("취소", role: .cancel) {}
        }
        .sheet(isPresented: $showingTimeRequest) {
            TimeRequestSheet(
                username: viewModel.username,
                displayName: viewModel.data?.user.preferredName ?? viewModel.username
            )
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
        .task {
            await viewModel.load()
        }
    }

    // MARK: - 상태별 콘텐츠

    @ViewBuilder
    private var content: some View {
        if let data = viewModel.data {
            loaded(data)
        } else if viewModel.isLoading {
            VStack(spacing: 12) {
                ProgressView()
                    .tint(Theme.accent)
                Text("프로필을 불러오는 중이에요")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let message = viewModel.errorMessage {
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
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Color.clear
        }
    }

    private func loaded(_ data: PersonProfileResponse) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header(data)
                if data.isBlocked {
                    // 차단 상태: 서버가 bio/관심사/슬롯을 비워서 주므로
                    // 헤더(아바타·이름·핸들)만 남고, 액션/슬롯 대신 안내를 보여준다.
                    blockedNotice
                } else {
                    if !data.isMe {
                        actionButtons(data)
                    }
                    CalendarCardsSection(username: viewModel.username, isMe: data.isMe)
                    slotsSection(data)
                }
            }
            .padding(16)
        }
        .refreshable {
            await viewModel.load(force: true)
        }
    }

    // MARK: - 차단 상태 안내

    private var blockedNotice: some View {
        VStack(spacing: 10) {
            Image(systemName: "hand.raised.fill")
                .font(.system(size: 28, weight: .light))
                .foregroundStyle(Theme.secondaryText)
            Text("차단한 사용자예요")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.primaryText)
            Text("차단을 해제하면 프로필과 열린 시간을 다시 볼 수 있어요.")
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.secondaryText)
            Button {
                Task { await viewModel.toggleBlock() }
            } label: {
                Text("차단 해제")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.primaryText)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Theme.fill(0.08), in: Capsule())
            }
            .disabled(viewModel.isTogglingBlock)
            .opacity(viewModel.isTogglingBlock ? 0.5 : 1)
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - 헤더

    private func header(_ data: PersonProfileResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 16) {
                DiscoverAvatar(url: data.user.avatarURL, name: data.user.preferredName, size: 64)
                VStack(alignment: .leading, spacing: 4) {
                    Text(data.user.preferredName)
                        .font(.headline)
                        .foregroundStyle(Theme.primaryText)
                    Text("@\(data.user.username)")
                        .font(.subheadline)
                        .foregroundStyle(Theme.accent)
                    HStack(spacing: 8) {
                        NavigationLink {
                            ConnectionsView(username: data.user.username, initialType: .orbiters)
                        } label: {
                            Text("팔로워 \(data.orbiters)")
                                .monospacedDigit()
                        }
                        .buttonStyle(.plain)
                        if let rating = data.rating, rating.count > 0 {
                            HStack(spacing: 2) {
                                Image(systemName: "star.fill")
                                    .font(.caption2)
                                    .foregroundStyle(.yellow)
                                Text("\(rating.averageText) (\(rating.count))")
                            }
                        }
                    }
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
                }
                Spacer(minLength: 0)
            }

            if let bio = data.user.bio, !bio.isEmpty {
                Text(bio)
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }

            if !data.user.interestTags.isEmpty {
                interestChips(data.user.interestTags)
            }

            let socialLinks = data.user.socialLinkItems
            if !socialLinks.isEmpty {
                socialLinksRow(socialLinks)
            }

            let experience = Array(data.user.experienceItems.prefix(3))
            if !experience.isEmpty {
                experienceSection(experience)
            }

            let education = Array(data.user.educationItems.prefix(2))
            if !education.isEmpty {
                educationSection(education)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - 소셜 링크 / 경력 / 학력

    private func socialLinksRow(_ links: [SocialLinkItem]) -> some View {
        HStack(spacing: 10) {
            ForEach(links) { link in
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

    private func experienceSection(_ items: [Experience]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("경력")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(item.company)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        if let role = item.role, !role.isEmpty {
                            Text(role)
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                    if let period = item.periodText {
                        Text(period)
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
        }
    }

    private func educationSection(_ items: [Education]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("학력")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(item.school)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Theme.primaryText)
                        if let detail = item.detailText {
                            Text(detail)
                                .font(.footnote)
                                .foregroundStyle(Theme.secondaryText)
                        }
                    }
                    if let period = item.periodText {
                        Text(period)
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(Theme.secondaryText)
                    }
                }
            }
        }
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

    // MARK: - 팔로우 / 시간 요청

    private func actionButtons(_ data: PersonProfileResponse) -> some View {
        HStack(spacing: 10) {
            Button {
                Task { await viewModel.toggleFollow() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: data.isFollowing ? "checkmark.circle.fill" : "plus.circle")
                        .font(.footnote)
                    Text(data.isFollowing ? "팔로잉" : "팔로우")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(data.isFollowing ? Theme.secondaryText : Theme.primaryText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    data.isFollowing
                        ? AnyShapeStyle(Theme.fill(0.08))
                        : AnyShapeStyle(Theme.accent),
                    in: Capsule()
                )
            }
            .disabled(viewModel.isTogglingFollow)
            .opacity(viewModel.isTogglingFollow ? 0.5 : 1)

            Button {
                showingTimeRequest = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "clock.badge.questionmark")
                        .font(.footnote)
                    Text("시간 요청")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Theme.accent.opacity(0.15), in: Capsule())
            }
        }
    }

    // MARK: - 열린 슬롯

    @ViewBuilder
    private func slotsSection(_ data: PersonProfileResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("열린 타임슬롯")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Theme.secondaryText)

            if data.slots.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "clock.badge.xmark")
                        .font(.system(size: 28, weight: .light))
                        .foregroundStyle(Theme.secondaryText)
                    Text("아직 열어둔 시간이 없어요")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.primaryText)
                    Text(data.isMe ? "슬롯 탭에서 시간을 열어보세요" : "시간 요청을 보내보세요")
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 28)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
            } else {
                ForEach(data.slots) { slot in
                    NavigationLink {
                        SlotBookingView(username: viewModel.username, slug: slot.slug)
                    } label: {
                        personSlotRow(slot)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func personSlotRow(_ slot: TimeSlot) -> some View {
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
    NavigationStack {
        PersonProfileView(username: "leo")
    }
    .tint(Theme.accent)
}
